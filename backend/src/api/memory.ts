import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { listMemories, remember, forget } from "../modules/memory/index.js";

interface RememberBody {
  content: string;
  category?: string;
}

/**
 * La memoria e' personale: nessuna di queste rotte guarda il team, e non c'e'
 * broadcast: quello che l'assistente sa di te non deve comparire sugli schermi
 * degli altri.
 */
export function registerMemoryRoutes(app: FastifyInstance): void {
  app.get("/api/memory", { preHandler: authenticate }, async (request) => {
    return listMemories(request.currentUser!.id);
  });

  app.post<{ Body: RememberBody }>("/api/memory", { preHandler: authenticate }, async (request, reply) => {
    const { content, category } = request.body ?? {};
    if (!content?.trim()) return reply.code(400).send({ error: "content è obbligatorio" });
    try {
      return await remember({ userId: request.currentUser!.id, content, category, source: "user" });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/memory/:id", { preHandler: authenticate }, async (request, reply) => {
    const deleted = await forget(request.currentUser!.id, request.params.id);
    if (!deleted) return reply.code(404).send({ error: "Fatto non trovato." });
    return { ok: true };
  });
}
