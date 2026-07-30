import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { chat, type ChatMessage } from "../modules/assistant/index.js";
import { broadcastToTeam } from "../ws/index.js";

interface ChatBody {
  messages: ChatMessage[];
}

const MAX_HISTORY_MESSAGES = 20;

export function registerAssistantRoutes(app: FastifyInstance): void {
  app.post<{ Body: ChatBody }>("/api/assistant/chat", { preHandler: authenticate }, async (request, reply) => {
    const { messages } = request.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: "messages è obbligatorio e non può essere vuoto" });
    }

    const user = request.currentUser!;
    try {
      const result = await chat({ userId: user.id, teamId: user.teamId }, messages.slice(-MAX_HISTORY_MESSAGES));
      if (result.toolCalls.length > 0) {
        broadcastToTeam(user.teamId, { type: "data-updated", reason: "assistant-tool-call" });
      }
      return result;
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });
}
