import { prisma } from "../../db/client.js";

/**
 * Quanti fatti finiscono nel prompt. I fatti vengono riletti a ogni turno di
 * ogni conversazione, quindi il costo e' ricorrente: meglio un tetto basso e
 * una memoria curata che un elenco che cresce senza fine.
 */
const PROMPT_FACT_LIMIT = 40;

const MAX_CONTENT_LENGTH = 300;

export interface RememberInput {
  userId: string;
  content: string;
  category?: string;
  source?: "user" | "assistant";
}

export async function remember(input: RememberInput) {
  const content = input.content.trim();
  if (!content) throw new Error("Il fatto da ricordare non può essere vuoto.");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Un fatto non può superare i ${MAX_CONTENT_LENGTH} caratteri: riassumilo.`);
  }

  // Un fatto identico ripetuto non va duplicato: capita che l'assistente
  // riprovi a ricordare qualcosa che gli era gia' stato detto.
  const existing = await prisma.userMemory.findFirst({
    where: { userId: input.userId, content: { equals: content, mode: "insensitive" } },
  });
  if (existing) return existing;

  return prisma.userMemory.create({
    data: {
      userId: input.userId,
      content,
      category: input.category?.trim() || undefined,
      source: input.source ?? "assistant",
    },
  });
}

export function listMemories(userId: string) {
  return prisma.userMemory.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function forget(userId: string, memoryId: string): Promise<boolean> {
  const result = await prisma.userMemory.deleteMany({ where: { id: memoryId, userId } });
  return result.count > 0;
}

/** Cancella per contenuto: e' cosi' che l'assistente puo' dimenticare, senza conoscere gli id. */
export async function forgetByContent(userId: string, text: string): Promise<number> {
  const result = await prisma.userMemory.deleteMany({
    where: { userId, content: { contains: text.trim(), mode: "insensitive" } },
  });
  return result.count;
}

/**
 * I fatti dell'utente in forma compatta per il system prompt. Stringa vuota se
 * non ce n'e' nessuno, cosi' il chiamante non aggiunge una sezione inutile.
 */
export async function getMemoryForPrompt(userId: string): Promise<string> {
  const memories = await prisma.userMemory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PROMPT_FACT_LIMIT,
    select: { content: true, category: true },
  });
  if (memories.length === 0) return "";

  const lines = memories.map((m) => (m.category ? `- [${m.category}] ${m.content}` : `- ${m.content}`));
  return lines.join("\n");
}
