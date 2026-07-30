import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { redis } from "../cache/redis.js";
import { generateCode } from "../utils/code.js";
import { env } from "../config/env.js";
import { getMetaAuthUrl, completeMetaConnection, listSocialAccounts, disconnectSocialAccount } from "../modules/social/metaAuth.js";
import { schedulePost, listPosts, cancelPost } from "../modules/social/index.js";
import { saveSocialMedia } from "../modules/social/mediaStorage.js";

const STATE_TTL_SECONDS = 10 * 60;
const STATE_KEY_PREFIX = "meta-oauth-state:";

interface SchedulePostBody {
  socialAccountId: string;
  content: string;
  scheduledAt: string;
  mediaPath?: string;
}

export function registerSocialRoutes(app: FastifyInstance): void {
  app.get("/api/integrations/meta/status", { preHandler: authenticate }, async (request) => {
    return listSocialAccounts(request.currentUser!.id);
  });

  app.get("/api/integrations/meta/connect", { preHandler: authenticate }, async (request, reply) => {
    const state = generateCode(24);
    try {
      await redis.set(`${STATE_KEY_PREFIX}${state}`, request.currentUser!.id, "EX", STATE_TTL_SECONDS);
    } catch {
      return reply.code(502).send({ error: "Redis non raggiungibile: impossibile avviare il collegamento Meta." });
    }

    try {
      return { url: getMetaAuthUrl(state) };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // Callback colpito direttamente dal browser dopo il redirect di Meta: nessun
  // Bearer token, l'utente e' identificato tramite lo state salvato a /connect.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/integrations/meta/callback",
    async (request, reply) => {
      const { code, state, error } = request.query;
      const redirectBase = `${env.frontendUrl}/social`;

      if (error) return reply.redirect(`${redirectBase}?meta=error&reason=${encodeURIComponent(error)}`);
      if (!code || !state) return reply.redirect(`${redirectBase}?meta=error&reason=missing_params`);

      const userId = await redis.get(`${STATE_KEY_PREFIX}${state}`).catch(() => null);
      if (!userId) return reply.redirect(`${redirectBase}?meta=error&reason=invalid_state`);
      await redis.del(`${STATE_KEY_PREFIX}${state}`).catch(() => {});

      try {
        await completeMetaConnection(userId, code);
        return reply.redirect(`${redirectBase}?meta=connected`);
      } catch (err) {
        return reply.redirect(`${redirectBase}?meta=error&reason=${encodeURIComponent((err as Error).message)}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>("/api/integrations/meta/:id", { preHandler: authenticate }, async (request) => {
    await disconnectSocialAccount(request.currentUser!.id, request.params.id);
    return { ok: true };
  });

  app.post("/api/social/media", { preHandler: authenticate }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "Nessun file caricato." });
    const buffer = await file.toBuffer();
    const filename = `${Date.now()}-${file.filename}`;
    const mediaPath = await saveSocialMedia(buffer, filename);
    return { mediaPath };
  });

  app.get("/api/social/posts", { preHandler: authenticate }, async (request) => {
    return listPosts(request.currentUser!.id);
  });

  app.post<{ Body: SchedulePostBody }>("/api/social/posts", { preHandler: authenticate }, async (request, reply) => {
    const { socialAccountId, content, scheduledAt, mediaPath } = request.body;
    if (!socialAccountId || !content?.trim() || !scheduledAt) {
      return reply.code(400).send({ error: "socialAccountId, content e scheduledAt sono obbligatori" });
    }
    try {
      return await schedulePost({
        userId: request.currentUser!.id,
        socialAccountId,
        content: content.trim(),
        scheduledAt: new Date(scheduledAt),
        mediaPath,
      });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/social/posts/:id", { preHandler: authenticate }, async (request) => {
    await cancelPost(request.currentUser!.id, request.params.id);
    return { ok: true };
  });
}
