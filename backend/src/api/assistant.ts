import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { chat } from "../modules/assistant/index.js";
import {
  appendMessage,
  createConversation,
  deleteConversation,
  getContextMessages,
  getConversation,
  listConversations,
} from "../modules/conversations/index.js";
import { broadcastToTeam } from "../ws/index.js";

interface ChatBody {
  /** Assente al primo messaggio: la conversazione viene creata al volo. */
  conversationId?: string;
  message: string;
}

export function registerAssistantRoutes(app: FastifyInstance): void {
  app.get("/api/conversations", { preHandler: authenticate }, async (request) => {
    return listConversations(request.currentUser!.id, "web");
  });

  app.get<{ Params: { id: string } }>("/api/conversations/:id", { preHandler: authenticate }, async (request, reply) => {
    const found = await getConversation(request.currentUser!.id, request.params.id);
    if (!found) return reply.code(404).send({ error: "Conversazione non trovata." });
    return found;
  });

  app.delete<{ Params: { id: string } }>("/api/conversations/:id", { preHandler: authenticate }, async (request, reply) => {
    const deleted = await deleteConversation(request.currentUser!.id, request.params.id);
    if (!deleted) return reply.code(404).send({ error: "Conversazione non trovata." });
    return { ok: true };
  });

  /**
   * Il client manda solo il messaggio nuovo: la history la ricostruisce il
   * server dalla conversazione salvata, cosi' non puo' divergere da cio' che
   * risulta a DB ne' essere manipolata dal browser.
   */
  app.post<{ Body: ChatBody }>("/api/assistant/chat", { preHandler: authenticate }, async (request, reply) => {
    const { conversationId, message } = request.body ?? {};
    if (!message?.trim()) {
      return reply.code(400).send({ error: "message è obbligatorio e non può essere vuoto" });
    }

    const user = request.currentUser!;
    const text = message.trim();

    let conversation;
    if (conversationId) {
      const found = await getConversation(user.id, conversationId);
      if (!found) return reply.code(404).send({ error: "Conversazione non trovata." });
      conversation = found.conversation;
    } else {
      conversation = await createConversation(user.id, "web", text);
    }

    // Il messaggio dell'utente si salva subito: se la chiamata al modello
    // fallisce, quello che ha scritto non va perso.
    await appendMessage({ conversationId: conversation.id, role: "user", content: text });

    try {
      const history = await getContextMessages(conversation.id);
      const result = await chat({ userId: user.id, teamId: user.teamId }, history);

      await appendMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: result.reply,
        toolNames: result.toolCalls.map((t) => t.name),
      });

      if (result.toolCalls.length > 0) {
        broadcastToTeam(user.teamId, { type: "data-updated", reason: "assistant-tool-call" });
      }
      return { ...result, conversationId: conversation.id };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message, conversationId: conversation.id });
    }
  });
}
