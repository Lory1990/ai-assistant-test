import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import {
  createPlan,
  deletePlan,
  listPlans,
  scheduleItem,
  setItemStatus,
  type ItemStatus,
} from "../modules/marketing/index.js";

const ITEM_STATUSES: ItemStatus[] = ["idea", "approved", "discarded"];

interface CreatePlanBody {
  name?: string;
  brief: string;
  audience?: string;
  tone?: string;
  objective?: string;
  channels: string[];
  periodStart: string;
  periodEnd: string;
  itemsPerWeek?: number;
}

interface ScheduleItemBody {
  socialAccountId: string;
  scheduledAt?: string;
  mediaPath?: string;
}

/**
 * Rotte del piano editoriale. Tutte scoped sull'utente autenticato e nessuna
 * sul team: il marketing e' personale (vedi `modules/marketing/index.ts`).
 */
export function registerMarketingRoutes(app: FastifyInstance): void {
  app.get("/api/marketing/plans", { preHandler: authenticate }, async (request) => {
    return listPlans(request.currentUser!.id);
  });

  app.post<{ Body: CreatePlanBody }>("/api/marketing/plans", { preHandler: authenticate }, async (request, reply) => {
    const { name, brief, audience, tone, objective, channels, periodStart, periodEnd, itemsPerWeek } = request.body;
    if (!brief?.trim()) return reply.code(400).send({ error: "brief è obbligatorio" });
    if (!Array.isArray(channels) || channels.length === 0) {
      return reply.code(400).send({ error: "Indica almeno un canale su cui pubblicare." });
    }
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return reply.code(400).send({ error: "periodStart e periodEnd devono essere date valide" });
    }

    try {
      return await createPlan(request.currentUser!.id, {
        name,
        brief: brief.trim(),
        audience: audience?.trim() || undefined,
        tone: tone?.trim() || undefined,
        objective: objective?.trim() || undefined,
        channels,
        periodStart: start,
        periodEnd: end,
        itemsPerWeek,
      });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/marketing/plans/:id", { preHandler: authenticate }, async (request, reply) => {
    try {
      await deletePlan(request.currentUser!.id, request.params.id);
      return { ok: true };
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message });
    }
  });

  // POST e non PATCH: il preflight CORS del backend dichiara esplicitamente i
  // metodi ammessi e PATCH non è tra quelli.
  app.post<{ Params: { id: string }; Body: { status: ItemStatus } }>(
    "/api/marketing/items/:id/status",
    { preHandler: authenticate },
    async (request, reply) => {
      const { status } = request.body;
      if (!ITEM_STATUSES.includes(status)) {
        return reply.code(400).send({ error: `status deve essere uno di: ${ITEM_STATUSES.join(", ")}` });
      }
      try {
        return await setItemStatus(request.currentUser!.id, request.params.id, status);
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: ScheduleItemBody }>(
    "/api/marketing/items/:id/schedule",
    { preHandler: authenticate },
    async (request, reply) => {
      const { socialAccountId, scheduledAt, mediaPath } = request.body;
      if (!socialAccountId) return reply.code(400).send({ error: "socialAccountId è obbligatorio" });
      try {
        return await scheduleItem(request.currentUser!.id, request.params.id, {
          socialAccountId,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          mediaPath,
        });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    },
  );
}
