import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { addHolding, removeHolding, getPortfolio } from "../modules/investments/index.js";

interface AddHoldingBody {
  symbol: string;
  quantity: number;
  costBasis?: number;
}

export function registerInvestmentsRoutes(app: FastifyInstance): void {
  app.get("/api/investments", { preHandler: authenticate }, async (request) => {
    return getPortfolio(request.currentUser!.id);
  });

  app.post<{ Body: AddHoldingBody }>("/api/investments", { preHandler: authenticate }, async (request, reply) => {
    const { symbol, quantity, costBasis } = request.body;
    if (!symbol?.trim() || !quantity || quantity <= 0) {
      return reply.code(400).send({ error: "symbol e quantity (> 0) sono obbligatori" });
    }
    const holding = await addHolding(request.currentUser!.id, symbol.trim(), quantity, costBasis);
    return holding;
  });

  app.delete<{ Params: { id: string } }>("/api/investments/:id", { preHandler: authenticate }, async (request) => {
    await removeHolding(request.currentUser!.id, request.params.id);
    return { ok: true };
  });
}
