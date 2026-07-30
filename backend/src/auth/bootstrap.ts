import { prisma } from "../db/client.js";
import { generateCode } from "../utils/code.js";
import type { KeycloakClaims } from "./keycloak.js";

/**
 * Al primo login Keycloak di un utente crea un Team personale (rinominabile
 * in seguito) e l'utente stesso. Ai login successivi ritorna semplicemente
 * l'utente/team gia' esistenti.
 */
export async function ensureUserForClaims(claims: KeycloakClaims) {
  const existing = await prisma.user.findUnique({
    where: { keycloakId: claims.sub },
    include: { team: true },
  });
  if (existing) return existing;

  const displayName = claims.name ?? claims.preferred_username ?? claims.email ?? "Il mio team";

  const team = await prisma.team.create({
    data: { name: `Team di ${displayName}`, inviteCode: generateCode() },
  });

  const user = await prisma.user.create({
    data: {
      keycloakId: claims.sub,
      email: claims.email,
      displayName,
      teamId: team.id,
    },
    include: { team: true },
  });

  return user;
}
