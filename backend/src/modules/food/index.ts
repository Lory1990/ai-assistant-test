import { prisma } from "../../db/client.js";
import { lookupCalories } from "./calorieLookup.js";

export interface LogMealInput {
  userId: string;
  teamId: string;
  description: string;
  grams?: number;
  photoPath?: string;
  /** Se gia' nota (es. da un piano alimentare AI), salta il lookup su DB calorie esterno. */
  calories?: number;
  /** true se e' un pasto pianificato (non ancora mangiato), es. generato da un piano AI. */
  planned?: boolean;
}

/**
 * TODO: description/grams qui sono gia' estratti a monte (dal router NLU).
 * In una versione successiva questo modulo potrebbe fare da solo il parsing
 * del testo libero ("150g di pasta al pomodoro") usando l'LLM.
 */
export async function logMeal(input: LogMealInput) {
  const calories = input.calories ?? (await lookupCalories(input.description, input.grams))?.calories;

  const meal = await prisma.meal.create({
    data: {
      userId: input.userId,
      teamId: input.teamId,
      description: input.description,
      grams: input.grams,
      photoPath: input.photoPath,
      calories,
      planned: input.planned ?? false,
    },
  });

  return meal;
}

/**
 * Aggancia una foto al pasto piu' recente dell'utente che non ne ha ancora
 * una, se registrato negli ultimi 2 minuti. Serve quando il pasto viene
 * creato dall'assistente AI (tool call) a partire da una foto Telegram: il
 * tool non conosce il path del file salvato su disco, quindi lo colleghiamo
 * dopo, invece di far gestire anche quello al modello.
 */
export async function attachPhotoToLatestMeal(userId: string, photoPath: string): Promise<boolean> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const meal = await prisma.meal.findFirst({
    where: { userId, photoPath: null, loggedAt: { gte: twoMinutesAgo } },
    orderBy: { loggedAt: "desc" },
  });
  if (!meal) return false;
  await prisma.meal.update({ where: { id: meal.id }, data: { photoPath } });
  return true;
}

/**
 * Pasti di tutto il team (non solo di chi chiama): il tracciamento
 * alimentare e' condiviso tra i membri, come deciso per il concetto di Team.
 * Include sia i pasti gia' mangiati sia quelli pianificati (planned=true).
 */
export async function getTodayMeals(teamId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.meal.findMany({
    where: { teamId, loggedAt: { gte: startOfDay } },
    orderBy: { loggedAt: "asc" },
    include: { user: true },
  });
}
