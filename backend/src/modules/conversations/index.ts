import { prisma } from "../../db/client.js";
import type { ChatMessage } from "../assistant/index.js";

export type ConversationChannel = "web" | "telegram";

/**
 * Quanti messaggi salvati vengono ripassati al modello. Lo storico su DB resta
 * completo: qui limitiamo solo il contesto attivo, perche' una conversazione
 * lunga mesi costerebbe token a ogni turno senza aggiungere nulla di utile.
 */
const CONTEXT_MESSAGE_LIMIT = 20;

const TITLE_MAX_LENGTH = 60;

/** Titolo derivato dal primo messaggio: nessuna chiamata al modello per una cosa che serve solo a ritrovare il thread. */
function titleFromFirstMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Nuova conversazione";
  return cleaned.length <= TITLE_MAX_LENGTH ? cleaned : `${cleaned.slice(0, TITLE_MAX_LENGTH - 1)}…`;
}

export async function createConversation(userId: string, channel: ConversationChannel, firstMessage: string) {
  return prisma.conversation.create({
    data: { userId, channel, title: titleFromFirstMessage(firstMessage) },
  });
}

export async function listConversations(userId: string, channel?: ConversationChannel) {
  return prisma.conversation.findMany({
    where: { userId, ...(channel ? { channel } : {}) },
    orderBy: { lastMessageAt: "desc" },
  });
}

/** Ritorna la conversazione con tutti i suoi messaggi, o null se non e' dell'utente. */
export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conversation) return null;

  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  return { conversation, messages };
}

export interface AppendMessageInput {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  toolNames?: string[];
  photoPath?: string;
}

export async function appendMessage(input: AppendMessageInput) {
  const [message] = await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        toolNames: input.toolNames ?? [],
        photoPath: input.photoPath,
      },
    }),
    prisma.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);
  return message;
}

/**
 * Gli ultimi messaggi della conversazione nel formato che l'assistente si
 * aspetta, in ordine cronologico. Le eventuali foto non vengono reinviate: il
 * modello ha gia' descritto l'immagine nella sua risposta, che resta nello
 * storico come testo.
 */
export async function getContextMessages(conversationId: string): Promise<ChatMessage[]> {
  const recent = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: CONTEXT_MESSAGE_LIMIT,
  });

  return recent
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const owned = await prisma.conversation.findFirst({ where: { id: conversationId, userId } });
  if (!owned) return false;

  // Mongo non ha cascade: i messaggi vanno rimossi a mano, prima del padre.
  await prisma.conversationMessage.deleteMany({ where: { conversationId } });
  await prisma.conversation.delete({ where: { id: conversationId } });
  return true;
}

/**
 * Conversazione attiva di un canale senza selezione esplicita (il bot Telegram):
 * riprende quella non archiviata piu' recente, o ne apre una nuova.
 */
export async function getOrCreateActiveConversation(
  userId: string,
  channel: ConversationChannel,
  firstMessage: string,
) {
  const active = await prisma.conversation.findFirst({
    where: { userId, channel, archived: false },
    orderBy: { lastMessageAt: "desc" },
  });
  return active ?? createConversation(userId, channel, firstMessage);
}

/** Chiude la conversazione attiva del canale, cosi' il messaggio successivo ne apre una nuova. */
export async function archiveActiveConversation(userId: string, channel: ConversationChannel): Promise<boolean> {
  const result = await prisma.conversation.updateMany({
    where: { userId, channel, archived: false },
    data: { archived: true },
  });
  return result.count > 0;
}
