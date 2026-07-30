import { prisma } from "../../db/client.js";

/**
 * Diario personale: deliberatamente non esposto come tool all'assistente AI
 * (a differenza di pasti/obiettivi/allenamenti). E' l'unico spazio della
 * dashboard pensato per restare privato anche dall'IA, non solo dal team.
 */
export async function addEntry(userId: string, content: string, mood?: string) {
  return prisma.diaryEntry.create({ data: { userId, content, mood } });
}

export async function listEntries(userId: string, limit = 50) {
  return prisma.diaryEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function removeEntry(userId: string, entryId: string) {
  return prisma.diaryEntry.deleteMany({ where: { id: entryId, userId } });
}
