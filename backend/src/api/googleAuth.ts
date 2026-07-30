import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { redis } from "../cache/redis.js";
import { generateCode } from "../utils/code.js";
import { env } from "../config/env.js";
import {
  getGoogleAuthUrl,
  completeGoogleConnection,
  getGoogleAccountStatus,
  disconnectGoogleAccount,
} from "../modules/googleAuth/index.js";

const STATE_TTL_SECONDS = 10 * 60;
const STATE_KEY_PREFIX = "google-oauth-state:";

export function registerGoogleAuthRoutes(app: FastifyInstance): void {
  app.get("/api/integrations/google/status", { preHandler: authenticate }, async (request) => {
    return getGoogleAccountStatus(request.currentUser!.id);
  });

  app.get("/api/integrations/google/connect", { preHandler: authenticate }, async (request, reply) => {
    const state = generateCode(24);
    try {
      await redis.set(`${STATE_KEY_PREFIX}${state}`, request.currentUser!.id, "EX", STATE_TTL_SECONDS);
    } catch {
      return reply.code(502).send({ error: "Redis non raggiungibile: impossibile avviare il collegamento Google." });
    }

    try {
      return { url: getGoogleAuthUrl(state) };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // Callback colpito direttamente dal browser dopo il redirect di Google:
  // non passa per il preHandler "authenticate" (nessun Bearer token qui),
  // l'utente viene identificato tramite lo state salvato al passo /connect.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/integrations/google/callback",
    async (request, reply) => {
      const { code, state, error } = request.query;
      const redirectBase = `${env.frontendUrl}/profile`;

      if (error) return reply.redirect(`${redirectBase}?google=error&reason=${encodeURIComponent(error)}`);
      if (!code || !state) return reply.redirect(`${redirectBase}?google=error&reason=missing_params`);

      const userId = await redis.get(`${STATE_KEY_PREFIX}${state}`).catch(() => null);
      if (!userId) return reply.redirect(`${redirectBase}?google=error&reason=invalid_state`);
      await redis.del(`${STATE_KEY_PREFIX}${state}`).catch(() => {});

      try {
        await completeGoogleConnection(userId, code);
        return reply.redirect(`${redirectBase}?google=connected`);
      } catch (err) {
        return reply.redirect(`${redirectBase}?google=error&reason=${encodeURIComponent((err as Error).message)}`);
      }
    },
  );

  app.post("/api/integrations/google/disconnect", { preHandler: authenticate }, async (request) => {
    await disconnectGoogleAccount(request.currentUser!.id);
    return { ok: true };
  });
}
