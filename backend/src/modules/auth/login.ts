import { env } from "../../config/env.js";
import { tokenEndpoint, logoutEndpoint, publicAuthorizeEndpoint, requireBackendClientConfig } from "./keycloakUrls.js";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Secondi di validita' dell'access token, per programmare il rinnovo lato client. */
  expiresIn: number;
}

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface KeycloakErrorResponse {
  error?: string;
  error_description?: string;
}

/** Errore con status HTTP da propagare al client (credenziali sbagliate = 401, non 500). */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

/**
 * @param invalidGrantMessage messaggio da mostrare se Keycloak risponde
 * invalid_grant: i suoi sono in inglese, e questo e' l'errore che l'utente
 * vede piu' spesso (password sbagliata).
 */
async function postToTokenEndpoint(params: Record<string, string>, invalidGrantMessage: string): Promise<TokenSet> {
  const { clientId, clientSecret } = requireBackendClientConfig();
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as KeycloakErrorResponse;
    // invalid_grant copre sia credenziali sbagliate sia refresh token scaduto:
    // in entrambi i casi e' il client che deve rifare il login, non un 500.
    if (body.error === "invalid_grant") throw new AuthError(invalidGrantMessage, 401);
    throw new AuthError(`Keycloak ha rifiutato la richiesta: ${res.status} ${body.error_description ?? body.error ?? ""}`, 502);
  }

  const data = (await res.json()) as KeycloakTokenResponse;
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

/** Login email + password (direct access grant): la schermata resta nella nostra app. */
export function loginWithPassword(email: string, password: string): Promise<TokenSet> {
  return postToTokenEndpoint(
    { grant_type: "password", scope: "openid", username: email, password },
    "Email o password non corretti.",
  );
}

export function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return postToTokenEndpoint(
    { grant_type: "refresh_token", refresh_token: refreshToken },
    "Sessione scaduta: accedi di nuovo.",
  );
}

/** Scambia il code ricevuto dopo il redirect social. */
export function exchangeAuthorizationCode(code: string): Promise<TokenSet> {
  return postToTokenEndpoint(
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: env.keycloakBackendClient.socialRedirectUri,
    },
    "Login social non completato: riprova.",
  );
}

/** Invalida il refresh token lato Keycloak, cosi' il logout chiude davvero la sessione. */
export async function revokeSession(refreshToken: string): Promise<void> {
  const { clientId, clientSecret } = requireBackendClientConfig();
  await fetch(logoutEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
}

/** URL a cui mandare il browser per il login tramite un identity provider social. */
export function buildSocialLoginUrl(providerAlias: string, state: string): string {
  const { clientId } = requireBackendClientConfig();
  const url = new URL(publicAuthorizeEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", env.keycloakBackendClient.socialRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid");
  url.searchParams.set("state", state);
  // Salta la pagina di scelta del provider: va diritto su Google/Facebook.
  url.searchParams.set("kc_idp_hint", providerAlias);
  return url.toString();
}
