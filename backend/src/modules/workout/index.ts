import { prisma } from "../../db/client.js";
import { parseExerciseText, type ParsedExercise } from "./parser.js";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function logExerciseFromText(userId: string, text: string) {
  const exercise = parseExerciseText(text);
  return logExercise(userId, exercise);
}

export async function logExercise(userId: string, exercise: ParsedExercise) {
  const today = startOfDay(new Date());
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, loggedAt: { gte: today } },
    orderBy: { loggedAt: "desc" },
  });

  if (existing) {
    return prisma.workoutSession.update({
      where: { id: existing.id },
      data: { exercises: { push: exercise } },
    });
  }

  return prisma.workoutSession.create({
    data: { userId, exercises: [exercise] },
  });
}

export async function getSessionsSince(userId: string, since: Date) {
  return prisma.workoutSession.findMany({
    where: { userId, loggedAt: { gte: since } },
    orderBy: { loggedAt: "asc" },
  });
}

interface ExerciseVolume {
  totalVolume: number; // sum(sets * reps * weightKg)
  occurrences: number;
}

function computeVolumeByExercise(sessions: Awaited<ReturnType<typeof getSessionsSince>>): Map<string, ExerciseVolume> {
  const byName = new Map<string, ExerciseVolume>();
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const volume = (ex.sets ?? 1) * (ex.reps ?? 1) * (ex.weightKg ?? 0);
      const current = byName.get(ex.name) ?? { totalVolume: 0, occurrences: 0 };
      current.totalVolume += volume;
      current.occurrences += 1;
      byName.set(ex.name, current);
    }
  }
  return byName;
}

/**
 * Recap euristico MVP: confronta il volume di allenamento (serie*ripetizioni*kg)
 * per esercizio nel periodo corrente vs il periodo precedente della stessa
 * durata, e lo mette in relazione con gli obiettivi attivi di categoria "gym".
 * TODO: sostituire/arricchire con un LLM che generi un commento motivazionale
 * piu' naturale a partire su questi stessi dati aggregati.
 */
export async function generateRecap(userId: string, periodDays: number): Promise<string> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const [currentSessions, previousSessions, gymGoals] = await Promise.all([
    getSessionsSince(userId, periodStart),
    prisma.workoutSession.findMany({
      where: { userId, loggedAt: { gte: previousPeriodStart, lt: periodStart } },
    }),
    prisma.goal.findMany({ where: { userId, category: "gym", active: true } }),
  ]);

  if (currentSessions.length === 0) {
    return `Negli ultimi ${periodDays} giorni non hai registrato allenamenti. Vuoi riprendere?`;
  }

  const currentVolume = computeVolumeByExercise(currentSessions);
  const previousVolume = computeVolumeByExercise(previousSessions);

  const lines: string[] = [`📊 Recap allenamenti (ultimi ${periodDays} giorni) — ${currentSessions.length} sessioni:`];

  for (const [name, current] of currentVolume) {
    const previous = previousVolume.get(name);
    if (!previous || previous.totalVolume === 0) {
      lines.push(`• ${name}: volume ${Math.round(current.totalVolume)} (nessun dato precedente per confronto)`);
      continue;
    }
    const changePercent = ((current.totalVolume - previous.totalVolume) / previous.totalVolume) * 100;
    const trend = changePercent > 5 ? "in aumento 📈" : changePercent < -5 ? "in calo 📉" : "stabile ➡️";
    lines.push(`• ${name}: volume ${Math.round(current.totalVolume)} (${changePercent >= 0 ? "+" : ""}${Math.round(changePercent)}% vs periodo precedente) — ${trend}`);
  }

  if (gymGoals.length > 0) {
    lines.push("", "🎯 Obiettivi attivi:", ...gymGoals.map((g) => `• ${g.title}`));
  }

  return lines.join("\n");
}
