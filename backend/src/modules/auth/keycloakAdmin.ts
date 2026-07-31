import { adminRealmEndpoint, tokenEndpoint, requireBackendClientConfig } from "./keycloakUrls.js";
import { AuthError } from "./login.js";

interface ServiceAccountToken {
  token: string;
  expiresAt: number;
}

let cachedToken: ServiceAccountToken | null = null;

/**
 * Token del service account del client backend, usato per l'Admin API.
 * Cachato in memoria fino a 30 secondi dalla scadenza: le operazioni admin
 * (registrazione, reset password) sono rare, non vale un giro di rete in piu'
 * a ogni chiamata.
 */
async function getServiceAccountToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const { clientId, clientSecret } = requireBackendClientConfig();
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    throw new AuthError(
      `Service account Keycloak non utilizzabile (${res.status}): verifica che il client "${clientId}" abbia ` +
        "Service Accounts abilitato e i ruoli realm-management (manage-users, view-users, view-identity-providers).",
      502,
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getServiceAccountToken();
  return fetch(`${adminRealmEndpoint}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}

export interface RegisterUserInput {
  email: string;
  password: string;
  displayName?: string;
}

// Keycloak rifiuta le password che violano la policy del realm con un codice
// e un messaggio in inglese: qui traduciamo quelli che l'utente puo' davvero
// incontrare in fase di registrazione.
const PASSWORD_POLICY_MESSAGES: Record<string, string> = {
  invalidPasswordMinLengthMessage: "La password deve essere lunga almeno 10 caratteri.",
  invalidPasswordNotUsernameMessage: "La password non può essere uguale al tuo nome utente.",
  invalidPasswordNotEmailMessage: "La password non può essere uguale alla tua email.",
  invalidPasswordMinDigitsMessage: "La password deve contenere almeno una cifra.",
  invalidPasswordMinLowerCaseCharsMessage: "La password deve contenere almeno una lettera minuscola.",
  invalidPasswordMinUpperCaseCharsMessage: "La password deve contenere almeno una lettera maiuscola.",
  invalidPasswordMinSpecialCharsMessage: "La password deve contenere almeno un carattere speciale.",
  invalidPasswordHistoryMessage: "Questa password è già stata usata in passato: scegline un'altra.",
};

function describeRegistrationFailure(status: number, rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as { error?: string; error_description?: string; errorMessage?: string };
    const translated = parsed.error ? PASSWORD_POLICY_MESSAGES[parsed.error] : undefined;
    if (translated) return translated;
    const detail = parsed.error_description ?? parsed.errorMessage ?? parsed.error;
    if (detail) return `Registrazione rifiutata: ${detail}`;
  } catch {
    // corpo non JSON: si ricade sul messaggio generico sotto
  }
  return `Registrazione rifiutata da Keycloak (${status}).`;
}

/**
 * Crea l'utente nel realm. L'utente applicativo (e il suo Team) nasce invece
 * al primo login, dal bootstrap che gira sui claim del token: qui creiamo solo
 * l'identita' Keycloak.
 */
export async function registerUser(input: RegisterUserInput): Promise<void> {
  const res = await adminFetch("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: input.email,
      email: input.email,
      firstName: input.displayName,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: "password", value: input.password, temporary: false }],
    }),
  });

  if (res.status === 409) {
    throw new AuthError("Esiste già un account con questa email.", 409);
  }
  if (!res.ok) {
    throw new AuthError(describeRegistrationFailure(res.status, await res.text()), 400);
  }
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const res = await adminFetch(`/users?email=${encodeURIComponent(email)}&exact=true`);
  if (!res.ok) throw new AuthError(`Ricerca utente fallita (${res.status}).`, 502);
  const users = (await res.json()) as { id: string }[];
  return users[0]?.id ?? null;
}

/**
 * Chiede a Keycloak di inviare l'email di reset password. Richiede che l'SMTP
 * sia configurato nel realm, altrimenti Keycloak risponde 500 e lo segnaliamo
 * in modo comprensibile.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const userId = await findUserIdByEmail(email);
  // Non rivelare se l'email esiste o no: chi la inserisce riceve sempre la
  // stessa risposta, cosi' l'endpoint non diventa un modo per scoprire chi e'
  // registrato.
  if (!userId) return;

  const res = await adminFetch(`/users/${userId}/execute-actions-email`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["UPDATE_PASSWORD"]),
  });

  if (!res.ok) {
    throw new AuthError(
      `Keycloak non ha potuto inviare l'email (${res.status}): configura il server SMTP nel realm ` +
        "(Realm settings > Email) — senza SMTP il reset password via email non può funzionare.",
      502,
    );
  }
}

/**
 * Se l'utente ha una credenziale OTP configurata.
 *
 * Serve perche' il direct grant risponde sempre "Invalid user credentials",
 * identico sia quando la password e' sbagliata sia quando manca il codice OTP:
 * senza questa verifica il form non potrebbe sapere se chiedere il codice.
 */
export async function userHasOtp(email: string): Promise<boolean> {
  const userId = await findUserIdByEmail(email).catch(() => null);
  if (!userId) return false;

  const res = await adminFetch(`/users/${userId}/credentials`);
  if (!res.ok) return false;
  const credentials = (await res.json()) as { type: string }[];
  return credentials.some((c) => c.type === "otp");
}

export interface SocialProvider {
  alias: string;
  displayName: string;
}

/** Identity provider social effettivamente configurati nel realm. */
export async function listSocialProviders(): Promise<SocialProvider[]> {
  const res = await adminFetch("/identity-provider/instances");
  if (!res.ok) throw new AuthError(`Elenco identity provider non disponibile (${res.status}).`, 502);
  const providers = (await res.json()) as { alias: string; displayName?: string; enabled: boolean }[];
  return providers
    .filter((p) => p.enabled)
    .map((p) => ({ alias: p.alias, displayName: p.displayName ?? p.alias }));
}
