export interface ParsedExercise {
  name: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
}

/**
 * Parsing MVP a regex per un testo libero tipo "panca piana 4x8 60kg".
 * TODO: sostituire con parsing via LLM per gestire frasi piu' naturali
 * ("oggi ho fatto 4 serie da 8 di panca a 60 chili").
 */
export function parseExerciseText(text: string): ParsedExercise {
  let remaining = text.trim();
  let sets: number | undefined;
  let reps: number | undefined;
  let weightKg: number | undefined;

  const setsRepsMatch = remaining.match(/(\d+)\s*x\s*(\d+)/i);
  if (setsRepsMatch) {
    sets = Number(setsRepsMatch[1]);
    reps = Number(setsRepsMatch[2]);
    remaining = remaining.replace(setsRepsMatch[0], "");
  }

  const weightMatch = remaining.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (weightMatch) {
    weightKg = Number(weightMatch[1].replace(",", "."));
    remaining = remaining.replace(weightMatch[0], "");
  }

  const name = remaining.replace(/\s+/g, " ").trim();

  return { name: name || text.trim(), sets, reps, weightKg };
}
