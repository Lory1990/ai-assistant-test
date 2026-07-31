import { randomInt } from "node:crypto";
import { redis } from "../../cache/redis.js";
import { sendMail } from "../mail/index.js";
import { AuthError } from "./login.js";

const CODE_TTL_SECONDS = 10 * 60;
/** Oltre questi tentativi il codice viene invalidato: senza limite sarebbe forzabile. */
const MAX_ATTEMPTS = 5;
/** Intervallo minimo tra due richieste per la stessa email. */
const RESEND_COOLDOWN_SECONDS = 60;

const CODE_KEY = (scope: string, email: string) => `email-otp:${scope}:${email.toLowerCase()}`;
const COOLDOWN_KEY = (scope: string, email: string) => `email-otp-cooldown:${scope}:${email.toLowerCase()}`;

/**
 * Scopo del codice. Tenerli separati evita che un codice chiesto per accedere
 * al web possa essere speso per collegare un account Telegram, e viceversa.
 */
export type OtpScope = "web-login" | "telegram-link";

interface StoredCode {
  code: string;
  attempts: number;
}

function generateCode(): string {
  // randomInt e' crittograficamente sicuro: Math.random non lo e' e questo
  // codice e' l'unica cosa che protegge l'accesso all'account.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/**
 * Genera un codice, lo salva e lo manda via email.
 *
 * Non rivela se l'email corrisponde a un account esistente: il chiamante
 * risponde allo stesso modo in ogni caso, cosi' l'endpoint non diventa un modo
 * per scoprire chi e' registrato.
 */
export async function sendOtp(scope: OtpScope, email: string): Promise<void> {
  const normalized = email.trim();
  if (!isValidEmail(normalized)) throw new AuthError("Indirizzo email non valido.", 400);

  const cooldown = await redis.get(COOLDOWN_KEY(scope, normalized)).catch(() => null);
  if (cooldown) {
    throw new AuthError("Ho già inviato un codice a questo indirizzo: controlla la posta o riprova tra un minuto.", 429);
  }

  const code = generateCode();
  const payload: StoredCode = { code, attempts: 0 };
  await redis.set(CODE_KEY(scope, normalized), JSON.stringify(payload), "EX", CODE_TTL_SECONDS);
  await redis.set(COOLDOWN_KEY(scope, normalized), "1", "EX", RESEND_COOLDOWN_SECONDS);

  const minutes = CODE_TTL_SECONDS / 60;
  await sendMail({
    to: normalized,
    subject: `Family HUD — codice di accesso ${code}`,
    text:
      `Il tuo codice di accesso è: ${code}\n\n` +
      `Scade tra ${minutes} minuti e vale una volta sola.\n\n` +
      "Se non hai richiesto tu questo codice, ignora questa email: senza il codice nessuno può entrare.",
  });
}

/**
 * Verifica il codice e lo consuma. Un codice speso non e' riutilizzabile, e i
 * tentativi sbagliati sono contati: al quinto il codice viene buttato, cosi'
 * provarli tutti non serve.
 */
export async function verifyOtp(scope: OtpScope, email: string, code: string): Promise<void> {
  const normalized = email.trim();
  const key = CODE_KEY(scope, normalized);
  const raw = await redis.get(key).catch(() => null);
  if (!raw) throw new AuthError("Codice scaduto o non richiesto: chiedine uno nuovo.", 401);

  const stored = JSON.parse(raw) as StoredCode;
  if (stored.code !== code.trim()) {
    const attempts = stored.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await redis.del(key).catch(() => {});
      throw new AuthError("Troppi tentativi: chiedi un nuovo codice.", 401);
    }
    // Il TTL residuo va mantenuto: riscrivere con quello pieno allungherebbe la
    // vita del codice a ogni tentativo sbagliato.
    const ttl = await redis.ttl(key).catch(() => CODE_TTL_SECONDS);
    await redis
      .set(key, JSON.stringify({ ...stored, attempts }), "EX", ttl > 0 ? ttl : CODE_TTL_SECONDS)
      .catch(() => {});
    throw new AuthError(`Codice non corretto. Tentativi rimasti: ${MAX_ATTEMPTS - attempts}.`, 401);
  }

  await redis.del(key).catch(() => {});
}
