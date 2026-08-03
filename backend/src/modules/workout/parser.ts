export interface ParsedExercise {
  name: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
  notes?: string;
}

/** Come si scrive un esercizio in chat: "panca piana 4x8 @ 60kg", "rematore 10 rip". */
export function formatExercise(exercise: ParsedExercise): string {
  const parts = [exercise.name];
  if (exercise.sets && exercise.reps) parts.push(`${exercise.sets}x${exercise.reps}`);
  else if (exercise.sets) parts.push(`${exercise.sets} serie`);
  else if (exercise.reps) parts.push(`${exercise.reps} rip`);
  if (exercise.weightKg) parts.push(`@ ${exercise.weightKg}kg`);
  return parts.join(" ");
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
