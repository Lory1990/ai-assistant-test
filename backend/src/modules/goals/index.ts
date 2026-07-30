import { prisma } from "../../db/client.js";

export interface CreateGoalInput {
  userId: string;
  teamId: string;
  title: string;
  description?: string;
  category?: "general" | "gym";
  /** "personal": visibile solo a chi lo crea. "team": visibile a tutto il team. Default "team". */
  scope?: "personal" | "team";
  dueDate?: Date;
  priority?: "low" | "medium" | "high";
  important?: boolean;
}

export async function createGoal(input: CreateGoalInput) {
  return prisma.goal.create({
    data: {
      userId: input.userId,
      teamId: input.teamId,
      title: input.title,
      description: input.description,
      category: input.category ?? "general",
      scope: input.scope ?? "team",
      dueDate: input.dueDate,
      priority: input.priority ?? "medium",
      important: input.important ?? false,
    },
  });
}

function goalOrderBy() {
  return [{ important: "desc" as const }, { dueDate: "asc" as const }, { createdAt: "desc" as const }];
}

/**
 * Gli obiettivi si dividono in due liste distinte: quelli di team (condivisi,
 * visibili a tutti i membri) e quelli personali (visibili solo a chi li ha
 * creati), anche se registrati dallo stesso team.
 */
export async function listGoals(teamId: string, userId: string, category?: "general" | "gym") {
  const [teamGoals, personalGoals] = await Promise.all([
    prisma.goal.findMany({
      where: { teamId, active: true, scope: "team", ...(category ? { category } : {}) },
      include: { user: true },
      orderBy: goalOrderBy(),
    }),
    prisma.goal.findMany({
      where: { userId, active: true, scope: "personal", ...(category ? { category } : {}) },
      include: { user: true },
      orderBy: goalOrderBy(),
    }),
  ]);
  return { teamGoals, personalGoals };
}

/**
 * TODO: qui va l'LLM che, dato l'obiettivo e lo storico azioni, genera il
 * prossimo messaggio motivazionale e la data/ora in cui schedularlo.
 * Per ora crea un'azione placeholder a scopo di test.
 */
export async function scheduleNextAction(goalId: string) {
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return prisma.goalAction.create({
    data: {
      goalId,
      message: "TODO: generare messaggio motivazionale via LLM in base al progresso dell'obiettivo.",
      scheduledAt,
    },
  });
}

export async function getDueActions(now: Date) {
  return prisma.goalAction.findMany({
    where: { scheduledAt: { lte: now }, sentAt: null },
    include: { goal: { include: { team: { include: { members: true } } } } },
  });
}

export async function markActionSent(actionId: string) {
  return prisma.goalAction.update({ where: { id: actionId }, data: { sentAt: new Date() } });
}
