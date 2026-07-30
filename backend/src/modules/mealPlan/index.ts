import { generateMealPlan as callAi } from "./client.js";
import { logMeal } from "../food/index.js";
import { addItems } from "../shoppingList/index.js";
import { listGoals } from "../goals/index.js";

/**
 * Genera un piano alimentare per la giornata via AI, lo salva come pasti
 * pianificati (Meal.planned=true) di oggi e aggiunge gli ingredienti mancanti
 * alla lista della spesa condivisa del team.
 */
export async function createMealPlan(userId: string, teamId: string, request: string): Promise<string> {
  const { teamGoals, personalGoals } = await listGoals(teamId, userId);
  const goalsContext = [...teamGoals, ...personalGoals].map((g) => `[${g.category}] ${g.title}`);

  const plan = await callAi(request, goalsContext);

  for (const meal of plan.meals) {
    await logMeal({
      userId,
      teamId,
      description: `${meal.name}: ${meal.description}`,
      grams: meal.grams,
      calories: meal.estimatedCalories,
      planned: true,
    });
  }

  await addItems(teamId, plan.shoppingList);

  const totalCalories = plan.meals.reduce((sum, m) => sum + m.estimatedCalories, 0);
  const mealLines = plan.meals.map((m) => `• ${m.name}: ${m.description} — ${Math.round(m.estimatedCalories)} kcal`);

  return [
    `🍽️ Piano alimentare generato (${Math.round(totalCalories)} kcal totali) e salvato tra i pasti di oggi:`,
    ...mealLines,
    "",
    `🛒 Lista della spesa aggiornata con ${plan.shoppingList.length} articoli — usa /spesa per vederla.`,
  ].join("\n");
}
