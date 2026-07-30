import Anthropic from "@anthropic-ai/sdk";
import { getAiClient } from "../../ai/client.js";

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

const SUBMIT_MEAL_PLAN_TOOL: Anthropic.Tool = {
  name: "submit_meal_plan",
  description: "Invia il piano alimentare generato e la lista della spesa corrispondente.",
  input_schema: {
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
  const { client, model } = getAiClient();

  const contextLines = goalsContext.length > 0 ? `Obiettivi attivi della famiglia:\n${goalsContext.map((g) => `- ${g}`).join("\n")}\n\n` : "";

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    tools: [SUBMIT_MEAL_PLAN_TOOL],
    tool_choice: { type: "tool", name: "submit_meal_plan" },
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

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Il modello non ha restituito un piano alimentare valido.");
  }

  return toolUse.input as MealPlanResult;
}
