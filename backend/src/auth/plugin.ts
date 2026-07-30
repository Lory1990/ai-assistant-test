import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "./keycloak.js";
import { ensureUserForClaims } from "./bootstrap.js";

type AuthenticatedUser = Awaited<ReturnType<typeof ensureUserForClaims>>;

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  if (!token) {
    await reply.code(401).send({ error: "Token mancante" });
    return;
  }

  try {
    const claims = await verifyAccessToken(token);
    request.currentUser = await ensureUserForClaims(claims);
  } catch {
    await reply.code(401).send({ error: "Token non valido o scaduto" });
  }
}
