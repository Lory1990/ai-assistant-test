import { prisma } from "../../db/client.js";

export async function createGoal(userId: string, title: string, description?: string, category: "general" | "gym" = "general") {
  return prisma.goal.create({ data: { userId, title, description, category } });
}

export async function listActiveGoals(userId: string, category?: "general" | "gym") {
  return prisma.goal.findMany({ where: { userId, active: true, ...(category ? { category } : {}) } });
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
    include: { goal: { include: { user: true } } },
  });
}

export async function markActionSent(actionId: string) {
  return prisma.goalAction.update({ where: { id: actionId }, data: { sentAt: new Date() } });
}
