import { env } from "../../config/env.js";

export interface CalorieEstimate {
  calories: number;
  source: string;
}

/**
 * Stub di lookup calorie su un DB esterno (es. Nutritionix natural language endpoint).
 * Se le credenziali non sono configurate, ritorna null: il chiamante deve gestire
 * il caso "calorie non disponibili" senza bloccare il logging del pasto.
 */
export async function lookupCalories(description: string, grams?: number): Promise<CalorieEstimate | null> {
  if (!env.calorieApi.appId || !env.calorieApi.appKey) {
    return null;
  }

  const query = grams ? `${grams}g ${description}` : description;

  const res = await fetch("https://trackapi.nutritionix.com/v2/natural/nutrients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": env.calorieApi.appId,
      "x-app-key": env.calorieApi.appKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as any;
  const calories = data?.foods?.[0]?.nf_calories;
  if (typeof calories !== "number") return null;

  return { calories, source: "nutritionix" };
}
