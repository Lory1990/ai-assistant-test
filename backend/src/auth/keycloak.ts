import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";

const jwks = createRemoteJWKSet(new URL(`${env.keycloakInternalUrl}/protocol/openid-connect/certs`));

export interface KeycloakClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
}

export async function verifyAccessToken(token: string): Promise<KeycloakClaims> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: env.keycloakIssuerUrl,
  });
  return payload as unknown as KeycloakClaims;
}
