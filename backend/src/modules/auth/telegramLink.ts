import { prisma } from "../../db/client.js";
import { unsetUserFields } from "../../db/rawOps.js";
import { redis } from "../../cache/redis.js";
import { generateCode } from "../../utils/code.js";
import { findUserIdByEmail, registerUser } from "./keycloakAdmin.js";
import { sendOtp, verifyOtp, isValidEmail } from "./emailOtp.js";
import { randomBytes } from "node:crypto";

/**
 * Stato del dialogo di collegamento, in Redis e non in memoria: un riavvio del
 * backend nel mezzo dello scambio non deve lasciare l'utente bloccato con un
 * bot che non ricorda di avergli chiesto l'email.
 */
type LinkState = { step: "awaiting-email" } | { step: "awaiting-code"; email: string };

const STATE_KEY = (telegramId: string) => `telegram-link:${telegramId}`;
const STATE_TTL_SECONDS = 15 * 60;

export async function getLinkState(telegramId: string): Promise<LinkState | null> {
  const raw = await redis.get(STATE_KEY(telegramId)).catch(() => null);
  return raw ? (JSON.parse(raw) as LinkState) : null;
}

async function setLinkState(telegramId: string, state: LinkState): Promise<void> {
  await redis.set(STATE_KEY(telegramId), JSON.stringify(state), "EX", STATE_TTL_SECONDS).catch(() => {});
}

export async function clearLinkState(telegramId: string): Promise<void> {
  await redis.del(STATE_KEY(telegramId)).catch(() => {});
}

/** L'utente applicativo collegato a questo Telegram, se esiste. */
export function findLinkedUser(telegramId: string) {
  return prisma.user.findUnique({ where: { telegramId }, include: { team: true } });
}

/** Avvia il collegamento: il prossimo messaggio sara' interpretato come email. */
export async function startLinking(telegramId: string): Promise<string> {
  await setLinkState(telegramId, { step: "awaiting-email" });
  return (
    "Ciao! Per collegare questa chat al tuo account, scrivimi la tua email.\n\n" +
    "Ti mando un codice di verifica: serve a essere sicuri che la casella sia tua."
  );
}

/** L'utente ha scritto l'email: manda il codice e passa al passo successivo. */
export async function handleEmailStep(telegramId: string, text: string): Promise<string> {
  const email = text.trim();
  if (!isValidEmail(email)) {
    return "Non mi sembra un indirizzo email valido. Riprova scrivendo solo l'email.";
  }

  try {
    await sendOtp("telegram-link", email);
  } catch (err) {
    return `Non ho potuto inviare il codice: ${(err as Error).message}`;
  }

  await setLinkState(telegramId, { step: "awaiting-code", email });
  return `Ho inviato un codice a ${email}. Scrivimelo qui (scade tra 10 minuti).`;
}

/**
 * L'utente ha scritto il codice: se e' corretto collega questa chat all'account
 * con quella email, creandolo se non esiste ancora.
 */
export async function handleCodeStep(telegramId: string, email: string, text: string): Promise<string> {
  try {
    await verifyOtp("telegram-link", email, text.trim());
  } catch (err) {
    return (err as Error).message;
  }

  const user = await linkTelegramToEmail(telegramId, email);
  await clearLinkState(telegramId);
  return (
    `Collegato! Questa chat ora parla con l'account ${email} (team "${user.team.name}").\n\n` +
    "Scrivimi quello che vuoi: registro pasti e allenamenti, accendo le luci, creo obiettivi."
  );
}

/**
 * Collega il telegramId all'utente con quella email. Se non esiste ancora un
 * utente applicativo, ne crea uno insieme al suo team e all'identita' Keycloak,
 * cosi' lo stesso account funziona anche sul web.
 */
async function linkTelegramToEmail(telegramId: string, email: string) {
  const normalized = email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({ where: { email: normalized }, include: { team: true } });
  if (existing) {
    // Se quel telegramId era attaccato a un altro utente (es. un vecchio
    // account solo-bot) va staccato prima, altrimenti l'indice unico rifiuta.
    // Va rimosso il campo, non messo a null: su Mongo un null esplicito resta
    // indicizzato e collide con gli altri documenti senza telegramId.
    const previous = await prisma.user.findMany({
      where: { telegramId, NOT: { id: existing.id } },
      select: { id: true },
    });
    for (const p of previous) await unsetUserFields(p.id, ["telegramId"]);
    return prisma.user.update({
      where: { id: existing.id },
      data: { telegramId },
      include: { team: true },
    });
  }

  // Identita' Keycloak creata al volo: la password non serve a nessuno, si
  // entra col codice via email.
  const alreadyInKeycloak = await findUserIdByEmail(normalized).catch(() => null);
  if (!alreadyInKeycloak) {
    await registerUser({ email: normalized, password: `${randomBytes(24).toString("base64url")}aA1!` });
  }

  const team = await prisma.team.create({
    data: { name: `Team di ${normalized}`, inviteCode: generateCode() },
  });
  return prisma.user.create({
    data: { telegramId, email: normalized, displayName: normalized, teamId: team.id },
    include: { team: true },
  });
}
