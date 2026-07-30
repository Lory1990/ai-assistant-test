import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { addEntry, listEntries, removeEntry } from "../modules/diary/index.js";

interface CreateDiaryEntryBody {
  content: string;
  mood?: string;
}

export function registerDiaryRoutes(app: FastifyInstance): void {
  app.get("/api/diary", { preHandler: authenticate }, async (request) => {
    return listEntries(request.currentUser!.id);
  });

  app.post<{ Body: CreateDiaryEntryBody }>("/api/diary", { preHandler: authenticate }, async (request, reply) => {
    const content = request.body.content?.trim();
    if (!content) return reply.code(400).send({ error: "content è obbligatorio" });
    return addEntry(request.currentUser!.id, content, request.body.mood);
  });

  app.delete<{ Params: { id: string } }>("/api/diary/:id", { preHandler: authenticate }, async (request) => {
    await removeEntry(request.currentUser!.id, request.params.id);
    return { ok: true };
  });
}
