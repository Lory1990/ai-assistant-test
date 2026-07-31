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

export interface TrainingExerciseInput {
  name: string;
  sets?: number | null;
  reps?: string | null;
  weightKg?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
}

export interface TrainingDayInput {
  name: string;
  notes?: string | null;
  exercises: TrainingExerciseInput[];
}

export interface TrainingPlanInput {
  name: string;
  notes?: string | null;
  validFrom: Date;
  /** null = aperta, fino a nuovo ordine. */
  validTo?: Date | null;
  days: TrainingDayInput[];
}

function toDays(days: TrainingDayInput[]) {
  return withOrder(days).map((day) => ({
    order: day.order,
    name: day.name.trim(),
    notes: day.notes?.trim() || null,
    exercises: day.exercises.map((ex) => ({
      name: ex.name.trim(),
      sets: ex.sets ?? null,
      reps: ex.reps?.trim() || null,
      weightKg: ex.weightKg ?? null,
      restSeconds: ex.restSeconds ?? null,
      notes: ex.notes?.trim() || null,
    })),
  }));
}

async function windowsOf(userId: string): Promise<ValidityWindow[]> {
  const plans = await prisma.trainingPlan.findMany({
    where: { userId },
    select: { id: true, name: true, validFrom: true, validTo: true },
  });
  return plans;
}

export async function listTrainingPlans(userId: string) {
  return prisma.trainingPlan.findMany({
    where: { userId },
    orderBy: { validFrom: "desc" },
  });
}

/** La scheda valida a una certa data: al massimo una, per costruzione. */
export async function getActiveTrainingPlan(userId: string, at: Date = new Date()) {
  return prisma.trainingPlan.findFirst({
    where: {
      userId,
      validFrom: { lte: at },
      OR: [{ validTo: null }, { validTo: { gte: at } }],
    },
  });
}

export async function createTrainingPlan(userId: string, input: TrainingPlanInput) {
  const { validFrom, validTo, toClose } = resolveWindow(await windowsOf(userId), input.validFrom, input.validTo ?? null);

  for (const plan of toClose) {
    await prisma.trainingPlan.update({ where: { id: plan.id }, data: { validTo: plan.validTo } });
  }

  return prisma.trainingPlan.create({
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

export async function updateTrainingPlan(userId: string, planId: string, input: TrainingPlanInput) {
  const existing = await prisma.trainingPlan.findFirst({ where: { id: planId, userId } });
  if (!existing) return null;

  const { validFrom, validTo, toClose } = resolveWindow(
    await windowsOf(userId),
    input.validFrom,
    input.validTo ?? null,
    planId,
  );

  for (const plan of toClose) {
    await prisma.trainingPlan.update({ where: { id: plan.id }, data: { validTo: plan.validTo } });
  }

  return prisma.trainingPlan.update({
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

/**
 * Le sessioni gia' registrate non vengono toccate: mantengono planId e
 * planDayOrder di una scheda che non esiste piu'. E' voluto — sono un dato
 * del team e la storia di cosa si e' fatto non deve cambiare perche' si e'
 * buttata via la scheda.
 */
export async function deleteTrainingPlan(userId: string, planId: string) {
  return prisma.trainingPlan.deleteMany({ where: { id: planId, userId } });
}

export interface TrainingToday {
  plan: NonNullable<Awaited<ReturnType<typeof getActiveTrainingPlan>>>;
  day: { order: number; name: string; notes: string | null; exercises: unknown[] };
  /** true se oggi si e' gia' registrato qualcosa su questo giorno. */
  started: boolean;
}

/**
 * Che giorno della scheda tocca oggi. Nessun contatore da tenere allineato:
 * si guarda l'ultima sessione registrata su questa scheda. Se e' di oggi si
 * resta su quel giorno (allenamento in corso, si stanno aggiungendo
 * esercizi); altrimenti si passa al successivo della rotazione.
 */
export async function getTrainingToday(userId: string, at: Date = new Date()): Promise<TrainingToday | null> {
  const plan = await getActiveTrainingPlan(userId, at);
  if (!plan || plan.days.length === 0) return null;

  const lastSession = await prisma.workoutSession.findFirst({
    where: { userId, planId: plan.id, planDayOrder: { not: null } },
    orderBy: { loggedAt: "desc" },
  });

  const startedToday =
    lastSession !== null && lastSession.loggedAt >= startOfDay(at) && lastSession.loggedAt <= endOfDay(at);

  const order = startedToday
    ? lastSession!.planDayOrder!
    : nextDayOrder(lastSession?.planDayOrder ?? null, plan.days.length);

  const day = plan.days.find((d) => d.order === order) ?? plan.days[0];
  return { plan, day, started: startedToday };
}

export { PlanOverlapError };
