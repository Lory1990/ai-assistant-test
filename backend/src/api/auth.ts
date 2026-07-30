import type { FastifyInstance, FastifyReply } from "fastify";
import { redis } from "../cache/redis.js";
import { generateCode } from "../utils/code.js";
import { env } from "../config/env.js";
import {
  loginWithPassword,
  refreshTokens,
  revokeSession,
  exchangeAuthorizationCode,
  buildSocialLoginUrl,
  AuthError,
  type TokenSet,
} from "../modules/auth/login.js";
import { registerUser, sendPasswordResetEmail, listSocialProviders } from "../modules/auth/keycloakAdmin.js";

const STATE_TTL_SECONDS = 10 * 60;
const STATE_KEY_PREFIX = "kc-social-state:";
// I token del login social vengono parcheggiati in Redis dietro un codice
// opaco monouso, e il browser li ritira con una POST: evita di far transitare
// access/refresh token nella query string del redirect.
const HANDOFF_TTL_SECONDS = 60;
const HANDOFF_KEY_PREFIX = "kc-social-handoff:";

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody extends LoginBody {
  displayName?: string;
}

interface RefreshBody {
  refreshToken: string;
}

function sendAuthError(reply: FastifyReply, err: unknown) {
  if (err instanceof AuthError) return reply.code(err.statusCode).send({ error: err.message });
  return reply.code(500).send({ error: (err as Error).message });
}

export function registerAuthRoutes(app: FastifyInstance): void {
  // Tutte le rotte qui sono deliberatamente senza preHandler "authenticate":
  // servono proprio a ottenere il primo token.

  app.post<{ Body: LoginBody }>("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body ?? {};
    if (!email?.trim() || !password) {
      return reply.code(400).send({ error: "Email e password sono obbligatorie." });
    }
    try {
      return await loginWithPassword(email.trim(), password);
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post<{ Body: RegisterBody }>("/api/auth/register", async (request, reply) => {
    const { email, password, displayName } = request.body ?? {};
    if (!email?.trim() || !password) {
      return reply.code(400).send({ error: "Email e password sono obbligatorie." });
    }
    try {
      await registerUser({ email: email.trim(), password, displayName: displayName?.trim() });
      // Login immediato: l'utente non deve reinserire quello che ha appena scritto.
      return await loginWithPassword(email.trim(), password);
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post<{ Body: { email: string } }>("/api/auth/forgot-password", async (request, reply) => {
    const { email } = request.body ?? {};
    if (!email?.trim()) return reply.code(400).send({ error: "Email obbligatoria." });
    try {
      await sendPasswordResetEmail(email.trim());
      return { ok: true };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post<{ Body: RefreshBody }>("/api/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body ?? {};
    if (!refreshToken) return reply.code(400).send({ error: "refreshToken obbligatorio." });
    try {
      return await refreshTokens(refreshToken);
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post<{ Body: RefreshBody }>("/api/auth/logout", async (request, reply) => {
    const { refreshToken } = request.body ?? {};
    if (refreshToken) await revokeSession(refreshToken).catch(() => {});
    return reply.send({ ok: true });
  });

  app.get("/api/auth/providers", async (_request, reply) => {
    try {
      return await listSocialProviders();
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.get<{ Params: { provider: string } }>("/api/auth/social/:provider", async (request, reply) => {
    const providers = await listSocialProviders().catch(() => []);
    if (!providers.some((p) => p.alias === request.params.provider)) {
      return reply.code(400).send({
        error:
          `L'identity provider "${request.params.provider}" non è configurato nel realm Keycloak: ` +
          "aggiungilo in Identity providers e reinserisci Client ID/Secret dell'app Google o Facebook.",
      });
    }

    const state = generateCode(24);
    try {
      await redis.set(`${STATE_KEY_PREFIX}${state}`, request.params.provider, "EX", STATE_TTL_SECONDS);
    } catch {
      return reply.code(502).send({ error: "Redis non raggiungibile: impossibile avviare il login social." });
    }

    try {
      return { url: buildSocialLoginUrl(request.params.provider, state) };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  // Colpito dal browser dopo il redirect di Keycloak. Non puo' restituire JSON:
  // deve rimandare l'utente sul frontend, che ritira i token con l'handoff.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/auth/social/callback",
    async (request, reply) => {
      const { code, state, error } = request.query;
      const redirectBase = `${env.frontendUrl}/auth/callback`;

      if (error) return reply.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
      if (!code || !state) return reply.redirect(`${redirectBase}?error=missing_params`);

      const provider = await redis.get(`${STATE_KEY_PREFIX}${state}`).catch(() => null);
      if (!provider) return reply.redirect(`${redirectBase}?error=invalid_state`);
      await redis.del(`${STATE_KEY_PREFIX}${state}`).catch(() => {});

      try {
        const tokens = await exchangeAuthorizationCode(code);
        const handoff = generateCode(32);
        await redis.set(`${HANDOFF_KEY_PREFIX}${handoff}`, JSON.stringify(tokens), "EX", HANDOFF_TTL_SECONDS);
        return reply.redirect(`${redirectBase}?handoff=${handoff}`);
      } catch (err) {
        return reply.redirect(`${redirectBase}?error=${encodeURIComponent((err as Error).message)}`);
      }
    },
  );

  app.post<{ Body: { handoff: string } }>("/api/auth/social/handoff", async (request, reply) => {
    const { handoff } = request.body ?? {};
    if (!handoff) return reply.code(400).send({ error: "handoff obbligatorio." });

    const key = `${HANDOFF_KEY_PREFIX}${handoff}`;
    const raw = await redis.get(key).catch(() => null);
    if (!raw) return reply.code(400).send({ error: "Login social scaduto: riprova." });
    await redis.del(key).catch(() => {});

    return JSON.parse(raw) as TokenSet;
  });
}
