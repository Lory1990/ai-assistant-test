import { prisma } from "../../db/client.js";
import {
  PlanOverlapError,
  endOfDay,
  nextDayOrder,
  resolveWindow,
  startOfDay,
  withOrder,
  type ValidityWindow,
} from "./validity.js";

export interface NutritionMealInput {
  /** "colazione" | "spuntino" | "pranzo" | "merenda" | "cena" — non chiuso. */
  slot: string;
  description: string;
  grams?: number | null;
  calories?: number | null;
}

export interface NutritionDayInput {
  name: string;
  notes?: string | null;
  meals: NutritionMealInput[];
}

export interface NutritionPlanInput {
  name: string;
  notes?: string | null;
  validFrom: Date;
  /** null = aperta, fino a nuovo ordine. */
  validTo?: Date | null;
  days: NutritionDayInput[];
}

function toDays(days: NutritionDayInput[]) {
  return withOrder(days).map((day) => ({
    order: day.order,
    name: day.name.trim(),
    notes: day.notes?.trim() || null,
    meals: day.meals.map((meal) => ({
      slot: meal.slot.trim(),
      description: meal.description.trim(),
      grams: meal.grams ?? null,
      calories: meal.calories ?? null,
    })),
  }));
}

async function windowsOf(userId: string): Promise<ValidityWindow[]> {
  return prisma.nutritionPlan.findMany({
    where: { userId },
    select: { id: true, name: true, validFrom: true, validTo: true },
  });
}

export async function listNutritionPlans(userId: string) {
  return prisma.nutritionPlan.findMany({
    where: { userId },
    orderBy: { validFrom: "desc" },
  });
}

/** La scheda valida a una certa data: al massimo una, per costruzione. */
export async function getActiveNutritionPlan(userId: string, at: Date = new Date()) {
  return prisma.nutritionPlan.findFirst({
    where: {
      userId,
      validFrom: { lte: at },
      OR: [{ validTo: null }, { validTo: { gte: at } }],
    },
  });
}

export async function createNutritionPlan(userId: string, input: NutritionPlanInput) {
  const { validFrom, validTo, toClose } = resolveWindow(await windowsOf(userId), input.validFrom, input.validTo ?? null);

  for (const plan of toClose) {
    await prisma.nutritionPlan.update({ where: { id: plan.id }, data: { validTo: plan.validTo } });
  }

  return prisma.nutritionPlan.create({
    data: {
      userId,
      name: input.name.trim(),
      notes: input.notes?.trim() || null,
      validFrom,
      validTo,
      days: toDays(input.days),
    },
  });
}

export async function updateNutritionPlan(userId: string, planId: string, input: NutritionPlanInput) {
  const existing = await prisma.nutritionPlan.findFirst({ where: { id: planId, userId } });
  if (!existing) return null;

  const { validFrom, validTo, toClose } = resolveWindow(
    await windowsOf(userId),
    input.validFrom,
    input.validTo ?? null,
    planId,
  );

  for (const plan of toClose) {
    await prisma.nutritionPlan.update({ where: { id: plan.id }, data: { validTo: plan.validTo } });
  }

  return prisma.nutritionPlan.update({
    where: { id: planId },
    data: {
      name: input.name.trim(),
      notes: input.notes?.trim() || null,
      validFrom,
      validTo,
      days: toDays(input.days),
    },
  });
}

/** I pasti gia' generati restano: sono storia condivisa col team, come per le schede di allenamento. */
export async function deleteNutritionPlan(userId: string, planId: string) {
  return prisma.nutritionPlan.deleteMany({ where: { id: planId, userId } });
}

export interface NutritionToday {
  plan: NonNullable<Awaited<ReturnType<typeof getActiveNutritionPlan>>>;
  day: { order: number; name: string; notes: string | null; meals: unknown[] };
  /** true se i pasti di oggi sono gia' stati generati da questa scheda. */
  applied: boolean;
}

/**
 * Che giorno della scheda alimentare tocca oggi. Stessa regola della scheda
 * di allenamento: si guarda l'ultimo pasto generato da questa scheda. Se e'
 * di oggi si resta su quel giorno (i pasti sono gia' in tavola), altrimenti
 * si passa al successivo della rotazione.
 */
export async function getNutritionToday(userId: string, at: Date = new Date()): Promise<NutritionToday | null> {
  const plan = await getActiveNutritionPlan(userId, at);
  if (!plan || plan.days.length === 0) return null;

  const lastMeal = await prisma.meal.findFirst({
    where: { userId, planId: plan.id, planDayOrder: { not: null } },
    orderBy: { loggedAt: "desc" },
  });

  const appliedToday = lastMeal !== null && lastMeal.loggedAt >= startOfDay(at) && lastMeal.loggedAt <= endOfDay(at);

  const order = appliedToday
    ? lastMeal!.planDayOrder!
    : nextDayOrder(lastMeal?.planDayOrder ?? null, plan.days.length);

  const day = plan.days.find((d) => d.order === order) ?? plan.days[0];
  return { plan, day, applied: appliedToday };
}

/**
 * Materializza il giorno di oggi della scheda in pasti pianificati
 * (Meal.planned=true), che e' la forma che dashboard, bot e recap gia'
 * sanno leggere: la scheda resta il modello ricorrente, i Meal restano il
 * registro della singola giornata.
 *
 * Idempotente sulla giornata: se i pasti di oggi sono gia' stati generati non
 * ne crea altri, cosi' premere due volte il pulsante non raddoppia la dieta.
 */
export async function applyNutritionToday(userId: string, teamId: string, at: Date = new Date()) {
  const today = await getNutritionToday(userId, at);
  if (!today) return { created: 0, day: null, alreadyApplied: false };
  if (today.applied) return { created: 0, day: today.day, alreadyApplied: true };

  const meals = today.day.meals as { slot: string; description: string; grams: number | null; calories: number | null }[];

  await prisma.meal.createMany({
    data: meals.map((meal) => ({
      userId,
      teamId,
      description: `${meal.slot}: ${meal.description}`,
      grams: meal.grams,
      calories: meal.calories,
      planned: true,
      planId: today.plan.id,
      planDayOrder: today.day.order,
    })),
  });

  return { created: meals.length, day: today.day, alreadyApplied: false };
}

export { PlanOverlapError };
