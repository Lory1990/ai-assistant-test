import type { FastifyInstance, FastifyReply } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { PlanOverlapError } from "../modules/plans/validity.js";
import {
  createTrainingPlan,
  deleteTrainingPlan,
  getTrainingToday,
  listTrainingPlans,
  updateTrainingPlan,
  type TrainingPlanInput,
} from "../modules/plans/training.js";
import {
  applyNutritionToday,
  createNutritionPlan,
  deleteNutritionPlan,
  getNutritionToday,
  listNutritionPlans,
  updateNutritionPlan,
  type NutritionPlanInput,
} from "../modules/plans/nutrition.js";

interface PlanBody {
  name?: string;
  notes?: string | null;
  validFrom?: string;
  validTo?: string | null;
  days?: unknown;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Il periodo e' l'unica parte del corpo che vale la pena validare a mano: i
 * giorni li normalizza gia' il modulo (ordine dalla posizione, trim dei
 * campi), e una scheda senza giorni e' legittima — si crea il contenitore
 * con le date e la si riempie dopo.
 */
function readWindow(body: PlanBody, reply: FastifyReply): { name: string; validFrom: Date; validTo: Date | null } | null {
  const name = body.name?.trim();
  if (!name) {
    reply.code(400).send({ error: "name è obbligatorio" });
    return null;
  }
  const validFrom = parseDate(body.validFrom);
  if (!validFrom) {
    reply.code(400).send({ error: "validFrom è obbligatoria e deve essere una data valida" });
    return null;
  }
  // validTo assente o null = scheda aperta, fino a nuovo ordine.
  const validTo = parseDate(body.validTo);
  if (body.validTo && !validTo) {
    reply.code(400).send({ error: "validTo non è una data valida" });
    return null;
  }
  return { name, validFrom, validTo };
}

/** La sovrapposizione e' un conflitto sullo stato, non un errore di sintassi: 409, non 500. */
async function handleOverlap<T>(reply: FastifyReply, run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof PlanOverlapError) {
      await reply.code(409).send({ error: err.message });
      return undefined;
    }
    throw err;
  }
}

export function registerPlanRoutes(app: FastifyInstance): void {
  // --- Schede di allenamento -------------------------------------------------

  app.get("/api/plans/training", { preHandler: authenticate }, async (request) => {
    return listTrainingPlans(request.currentUser!.id);
  });

  app.get("/api/plans/training/today", { preHandler: authenticate }, async (request) => {
    return getTrainingToday(request.currentUser!.id);
  });

  app.post<{ Body: PlanBody }>("/api/plans/training", { preHandler: authenticate }, async (request, reply) => {
    const window = readWindow(request.body, reply);
    if (!window) return;
    const input: TrainingPlanInput = {
      ...window,
      notes: request.body.notes ?? null,
      days: (request.body.days as TrainingPlanInput["days"]) ?? [],
    };
    return handleOverlap(reply, () => createTrainingPlan(request.currentUser!.id, input));
  });

  app.put<{ Params: { id: string }; Body: PlanBody }>(
    "/api/plans/training/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const window = readWindow(request.body, reply);
      if (!window) return;
      const input: TrainingPlanInput = {
        ...window,
        notes: request.body.notes ?? null,
        days: (request.body.days as TrainingPlanInput["days"]) ?? [],
      };
      const updated = await handleOverlap(reply, () =>
        updateTrainingPlan(request.currentUser!.id, request.params.id, input),
      );
      if (updated === undefined) return;
      if (updated === null) return reply.code(404).send({ error: "Scheda non trovata" });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>("/api/plans/training/:id", { preHandler: authenticate }, async (request) => {
    await deleteTrainingPlan(request.currentUser!.id, request.params.id);
    return { ok: true };
  });

  // --- Schede alimentari -----------------------------------------------------

  app.get("/api/plans/nutrition", { preHandler: authenticate }, async (request) => {
    return listNutritionPlans(request.currentUser!.id);
  });

  app.get("/api/plans/nutrition/today", { preHandler: authenticate }, async (request) => {
    return getNutritionToday(request.currentUser!.id);
  });

  app.post("/api/plans/nutrition/today/apply", { preHandler: authenticate }, async (request) => {
    const user = request.currentUser!;
    return applyNutritionToday(user.id, user.teamId);
  });

  app.post<{ Body: PlanBody }>("/api/plans/nutrition", { preHandler: authenticate }, async (request, reply) => {
    const window = readWindow(request.body, reply);
    if (!window) return;
    const input: NutritionPlanInput = {
      ...window,
      notes: request.body.notes ?? null,
      days: (request.body.days as NutritionPlanInput["days"]) ?? [],
    };
    return handleOverlap(reply, () => createNutritionPlan(request.currentUser!.id, input));
  });

  app.put<{ Params: { id: string }; Body: PlanBody }>(
    "/api/plans/nutrition/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const window = readWindow(request.body, reply);
      if (!window) return;
      const input: NutritionPlanInput = {
        ...window,
        notes: request.body.notes ?? null,
        days: (request.body.days as NutritionPlanInput["days"]) ?? [],
      };
      const updated = await handleOverlap(reply, () =>
        updateNutritionPlan(request.currentUser!.id, request.params.id, input),
      );
      if (updated === undefined) return;
      if (updated === null) return reply.code(404).send({ error: "Scheda non trovata" });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>("/api/plans/nutrition/:id", { preHandler: authenticate }, async (request) => {
    await deleteNutritionPlan(request.currentUser!.id, request.params.id);
    return { ok: true };
  });
}
