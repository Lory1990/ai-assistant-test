import { prisma } from "../../db/client.js";
import { env } from "../../config/env.js";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
].join(" ");

function requireConfig() {
  if (!env.google.clientId || !env.google.clientSecret || !env.google.redirectUri) {
    throw new Error(
      "Google OAuth non configurato: imposta GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in backend/.env " +
        "(vedi https://console.cloud.google.com/apis/credentials — redirect URI da registrare: " +
        `${env.google.redirectUri ?? "<il tuo>/api/integrations/google/callback"}).`,
    );
  }
}

export function getGoogleAuthUrl(state: string): string {
  requireConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.google.clientId!);
  url.searchParams.set("redirect_uri", env.google.redirectUri!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // forza il rilascio di un refresh_token anche su riconnessioni
  url.searchParams.set("state", state);
  return url.toString();
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  requireConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId!,
      client_secret: env.google.clientSecret!,
      redirect_uri: env.google.redirectUri!,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Scambio codice Google fallito: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GoogleTokenResponse>;
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Recupero profilo Google fallito: ${res.status}`);
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("Profilo Google senza email.");
  return data.email;
}

/** Da chiamare nel callback OAuth: scambia il code, recupera l'email e salva/aggiorna la connessione. */
export async function completeGoogleConnection(userId: string, code: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refresh_token) {
    // Google non rilascia un nuovo refresh_token se l'utente ha gia' autorizzato
    // l'app senza revocare l'accesso: con prompt=consent non dovrebbe succedere,
    // ma se capita meglio segnalarlo chiaramente che salvare una connessione monca.
    throw new Error("Google non ha restituito un refresh token: prova a revocare l'accesso dall'account Google e ricollegare.");
  }

  const email = await fetchGoogleEmail(tokens.access_token);
  const accessTokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.googleAccount.upsert({
    where: { userId },
    create: {
      userId,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt,
      scopes: tokens.scope,
    },
    update: {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt,
      scopes: tokens.scope,
    },
  });
}

export async function getGoogleAccountStatus(userId: string): Promise<{ connected: boolean; email?: string }> {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  return account ? { connected: true, email: account.email } : { connected: false };
}

export async function disconnectGoogleAccount(userId: string): Promise<void> {
  await prisma.googleAccount.deleteMany({ where: { userId } });
}

/**
 * Ritorna un access token Google valido per l'utente, rinnovandolo se scaduto.
 * Predisposto per i futuri moduli di lettura Calendar/Gmail: non ancora usato
 * altrove finche' non si decide cosa costruirci sopra.
 */
export async function getValidGoogleAccessToken(userId: string): Promise<string> {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Nessun account Google collegato.");

  if (account.accessTokenExpiresAt > new Date(Date.now() + 60_000)) {
    return account.accessToken;
  }

  requireConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: account.refreshToken,
      client_id: env.google.clientId!,
      client_secret: env.google.clientSecret!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Rinnovo token Google fallito: ${res.status} ${await res.text()}`);

  const tokens = (await res.json()) as GoogleTokenResponse;
  const accessTokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await prisma.googleAccount.update({
    where: { userId },
    data: { accessToken: tokens.access_token, accessTokenExpiresAt },
  });

  return tokens.access_token;
}
