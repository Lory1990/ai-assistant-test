import { prisma } from "../../db/client.js";
import { lookupCalories } from "./calorieLookup.js";

export interface LogMealInput {
  userId: string;
  description: string;
  grams?: number;
  photoPath?: string;
}

/**
 * TODO: description/grams qui sono gia' estratti a monte (dal router NLU).
 * In una versione successiva questo modulo potrebbe fare da solo il parsing
 * del testo libero ("150g di pasta al pomodoro") usando l'LLM.
 */
export async function logMeal(input: LogMealInput) {
  const estimate = await lookupCalories(input.description, input.grams);

  const meal = await prisma.meal.create({
    data: {
      userId: input.userId,
      description: input.description,
      grams: input.grams,
      photoPath: input.photoPath,
      calories: estimate?.calories,
    },
  });

  return meal;
}

export async function getTodayMeals(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.meal.findMany({
    where: { userId, loggedAt: { gte: startOfDay } },
    orderBy: { loggedAt: "asc" },
  });
}
