import { getAiProvider } from "../../ai/client.js";
import type { AiToolDefinition } from "../../ai/types.js";

export interface PlannedMeal {
  name: string;
  description: string;
  grams?: number;
  estimatedCalories: number;
}

export interface ShoppingListEntry {
  name: string;
  quantity?: string;
}

export interface MealPlanResult {
  meals: PlannedMeal[];
  shoppingList: ShoppingListEntry[];
}

const SUBMIT_MEAL_PLAN_TOOL: AiToolDefinition = {
  name: "submit_meal_plan",
  description: "Invia il piano alimentare generato e la lista della spesa corrispondente.",
  inputSchema: {
    type: "object",
    properties: {
      meals: {
        type: "array",
        description: "I pasti proposti per la giornata (colazione, pranzo, cena, eventuali spuntini).",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: 'es. "Colazione", "Pranzo", "Cena", "Spuntino"' },
            description: { type: "string", description: "Cosa mangiare, in una frase." },
            grams: { type: "number", description: "Grammatura indicativa totale del pasto." },
            estimatedCalories: { type: "number", description: "Calorie stimate del pasto." },
          },
          required: ["name", "description", "estimatedCalories"],
        },
      },
      shoppingList: {
        type: "array",
        description: "Ingredienti da comprare per realizzare tutti i pasti del piano.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "string", description: 'es. "500g", "2 pezzi", "1 confezione"' },
          },
          required: ["name"],
        },
      },
    },
    required: ["meals", "shoppingList"],
  },
};

export async function generateMealPlan(request: string, goalsContext: string[]): Promise<MealPlanResult> {
  const provider = getAiProvider();

  const contextLines = goalsContext.length > 0 ? `Obiettivi attivi della famiglia:\n${goalsContext.map((g) => `- ${g}`).join("\n")}\n\n` : "";

  const turn = await provider.complete({
    maxTokens: 2048,
    tools: [SUBMIT_MEAL_PLAN_TOOL],
    forceTool: SUBMIT_MEAL_PLAN_TOOL.name,
    messages: [
      {
        role: "user",
        content:
          `Sei un nutrizionista che prepara un piano alimentare per una giornata, in italiano.\n\n${contextLines}` +
          `Richiesta della famiglia: "${request}"\n\n` +
          "Proponi colazione, pranzo, cena ed eventuali spuntini con grammature e calorie stimate realistiche, " +
          "e la lista della spesa con gli ingredienti necessari per prepararli. Usa il tool submit_meal_plan.",
      },
    ],
  });

  const call = turn.toolCalls.find((c) => c.name === SUBMIT_MEAL_PLAN_TOOL.name);
  if (!call) {
    throw new Error("Il modello non ha restituito un piano alimentare valido.");
  }

  return call.input as MealPlanResult;
}
