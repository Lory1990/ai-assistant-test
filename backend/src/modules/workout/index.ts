import { prisma } from "../../db/client.js";
import { getActiveTrainingPlan, getTrainingToday } from "../plans/training.js";
import { formatExercise, parseExerciseText, type ParsedExercise } from "./parser.js";
import { resolveDay, toDayRef, type PlanDayRef } from "./planDay.js";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Quale giorno di scheda si sta eseguendo, quando la sessione ce l'ha attribuito. */
export interface AttributedDay extends PlanDayRef {
  planName: string;
}

/**
 * La scheda non e' deducibile: i giorni tra cui scegliere, da girare all'utente.
 * `suggested` e' quello che toccherebbe secondo la rotazione — un default da
 * proporre, non una risposta: e' proprio l'incertezza che fa nascere la domanda.
 */
export interface PlanDayQuestion {
  planName: string;
  options: PlanDayRef[];
  suggested: PlanDayRef | null;
}

export interface LogExerciseResult {
  session: Awaited<ReturnType<typeof prisma.workoutSession.create>>;
  exercise: ParsedExercise;
  /** true se l'esercizio e' finito in una sessione di oggi gia' aperta. */
  appended: boolean;
  day: AttributedDay | null;
  question: PlanDayQuestion | null;
}

export async function logExerciseFromText(userId: string, teamId: string, text: string): Promise<LogExerciseResult> {
  return logExercise(userId, teamId, parseExerciseText(text));
}

/**
 * Registra un esercizio nella sessione di oggi: la apre se non c'e', altrimenti
 * ci aggiunge l'esercizio.
 *
 * Alla prima registrazione della giornata la sessione viene "timbrata" con il
 * giorno di scheda che si sta eseguendo, ed e' quella timbratura a fare
 * avanzare la rotazione (domani tocchera' il giorno dopo). Il giorno si deduce
 * solo quando e' deducibile davvero — dagli esercizi registrati, o perche' la
 * scheda ne ha uno solo. Se resta ambiguo l'esercizio si registra comunque (il
 * dato non si perde mai) e la domanda torna a chi chiama, che la fara'
 * all'utente: la risposta si salva con setSessionPlanDay. Allenarsi fuori
 * scheda resta possibile — e' semplicemente una sessione senza attribuzione.
 */
export async function logExercise(userId: string, teamId: string, exercise: ParsedExercise): Promise<LogExerciseResult> {
  const today = startOfDay(new Date());
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, loggedAt: { gte: today } },
    orderBy: { loggedAt: "desc" },
  });

  if (existing) {
    const session = await prisma.workoutSession.update({
      where: { id: existing.id },
      data: { exercises: { push: exercise } },
    });
    // L'attribuzione di una sessione aperta non si tocca: e' stata decisa (o
    // lasciata vuota di proposito) quando la sessione e' nata, e non e' un
    // esercizio in piu' a doverla ribaltare in silenzio.
    return { session, exercise, appended: true, day: await describeDay(session), question: null };
  }

  const planned = await getTrainingToday(userId);
  const create = (planId: string | null, planDayOrder: number | null) =>
    prisma.workoutSession.create({ data: { userId, teamId, exercises: [exercise], planId, planDayOrder } });

  if (!planned) {
    return { session: await create(null, null), exercise, appended: false, day: null, question: null };
  }

  const { plan } = planned;
  const { day, options } = resolveDay(plan.days, exercise.name);

  if (day) {
    return {
      session: await create(plan.id, day.order),
      exercise,
      appended: false,
      day: { planName: plan.name, order: day.order, name: day.name },
      question: null,
    };
  }

  // Nessuna certezza: si registra senza scheda e si chiede.
  return {
    session: await create(null, null),
    exercise,
    appended: false,
    day: null,
    question: {
      planName: plan.name,
      options,
      suggested: options.find((option) => option.order === planned.day.order) ?? null,
    },
  };
}

/**
 * Registra su quale giorno di scheda sta la sessione di oggi: la risposta alla
 * domanda di logExercise. Vale anche a correggere un giorno dedotto male, ed
 * essendo la timbratura che regge la rotazione, sistema anche i giorni dopo.
 */
export async function setSessionPlanDay(
  userId: string,
  dayOrder: number,
): Promise<
  | { ok: true; day: AttributedDay }
  | { ok: false; reason: "no-session" }
  | { ok: false; reason: "no-plan" }
  | { ok: false; reason: "no-day"; planName: string; options: PlanDayRef[] }
> {
  const session = await prisma.workoutSession.findFirst({
    where: { userId, loggedAt: { gte: startOfDay(new Date()) } },
    orderBy: { loggedAt: "desc" },
  });
  if (!session) return { ok: false, reason: "no-session" };

  const plan = await getActiveTrainingPlan(userId);
  if (!plan) return { ok: false, reason: "no-plan" };

  const day = plan.days.find((d) => d.order === dayOrder);
  if (!day) return { ok: false, reason: "no-day", planName: plan.name, options: plan.days.map(toDayRef) };

  await prisma.workoutSession.update({
    where: { id: session.id },
    data: { planId: plan.id, planDayOrder: day.order },
  });
  return { ok: true, day: { planName: plan.name, order: day.order, name: day.name } };
}

async function describeDay(session: { planId: string | null; planDayOrder: number | null }): Promise<AttributedDay | null> {
  if (!session.planId || session.planDayOrder === null) return null;
  const plan = await prisma.trainingPlan.findUnique({ where: { id: session.planId } });
  const day = plan?.days.find((d) => d.order === session.planDayOrder);
  return plan && day ? { planName: plan.name, order: day.order, name: day.name } : null;
}

/** Conferma da mandare all'utente, con la domanda sulla scheda quando serve. */
export function formatLogResult(result: LogExerciseResult): string {
  const lines = [`Esercizio registrato: ${formatExercise(result.exercise)}`];
  if (result.day) {
    lines[0] += ` — ${result.day.planName}, giorno ${result.day.order} (${result.day.name})`;
  }

  if (result.question) {
    const { planName, options, suggested } = result.question;
    lines.push(
      `Quale giorno della scheda "${planName}" stai eseguendo?`,
      ...options.map((day) => `${day.order}) ${day.name}${suggested?.order === day.order ? " — il prossimo della rotazione" : ""}`),
    );
  }

  return lines.join("\n");
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
