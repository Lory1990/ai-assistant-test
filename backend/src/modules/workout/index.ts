import { prisma } from "../../db/client.js";
import { getTrainingToday } from "../plans/training.js";
import { parseExerciseText, type ParsedExercise } from "./parser.js";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function logExerciseFromText(userId: string, teamId: string, text: string) {
  const exercise = parseExerciseText(text);
  return logExercise(userId, teamId, exercise);
}

export async function logExercise(userId: string, teamId: string, exercise: ParsedExercise) {
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

  // Prima sessione di oggi: se c'e' una scheda attiva la timbriamo qui, ed e'
  // proprio questa timbratura che fa avanzare la rotazione (il giorno di
  // domani sara' quello dopo). Registrare senza scheda resta possibile.
  const planned = await getTrainingToday(userId);

  return prisma.workoutSession.create({
    data: {
      userId,
      teamId,
      exercises: [exercise],
      planId: planned?.plan.id ?? null,
      planDayOrder: planned?.day.order ?? null,
    },
  });
}

/** Sessioni di tutto il team, non solo di un singolo utente (condivisione decisa per il Team). */
export async function getSessionsSince(teamId: string, since: Date) {
  return prisma.workoutSession.findMany({
    where: { teamId, loggedAt: { gte: since } },
    orderBy: { loggedAt: "asc" },
    include: { user: true },
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

function countSessionsByMember(sessions: Awaited<ReturnType<typeof getSessionsSince>>): Map<string, number> {
  const byMember = new Map<string, number>();
  for (const session of sessions) {
    const name = session.user.displayName ?? session.user.telegramId ?? session.userId;
    byMember.set(name, (byMember.get(name) ?? 0) + 1);
  }
  return byMember;
}

/**
 * Recap euristico MVP a livello di team: confronta il volume di allenamento
 * (serie*ripetizioni*kg) per esercizio, aggregato su tutti i membri, nel
 * periodo corrente vs il periodo precedente della stessa durata, e lo mette
 * in relazione con gli obiettivi attivi di categoria "gym" del team.
 * TODO: sostituire/arricchire con un LLM che generi un commento motivazionale
 * piu' naturale a partire su questi stessi dati aggregati.
 */
export async function generateRecap(teamId: string, periodDays: number): Promise<string> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const [currentSessions, previousSessions, gymGoals] = await Promise.all([
    getSessionsSince(teamId, periodStart),
    prisma.workoutSession.findMany({
      where: { teamId, loggedAt: { gte: previousPeriodStart, lt: periodStart } },
      include: { user: true },
    }),
    prisma.goal.findMany({ where: { teamId, category: "gym", active: true } }),
  ]);

  if (currentSessions.length === 0) {
    return `Negli ultimi ${periodDays} giorni il team non ha registrato allenamenti. Volete riprendere?`;
  }

  const currentVolume = computeVolumeByExercise(currentSessions);
  const previousVolume = computeVolumeByExercise(previousSessions);
  const sessionsByMember = countSessionsByMember(currentSessions);

  const lines: string[] = [
    `📊 Recap allenamenti del team (ultimi ${periodDays} giorni) — ${currentSessions.length} sessioni:`,
    ...Array.from(sessionsByMember, ([name, count]) => `👤 ${name}: ${count} sessioni`),
    "",
  ];

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
