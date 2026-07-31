import { prisma } from "../../db/client.js";
import { schedulePost } from "../social/index.js";
import { generateEditorialPlan } from "./client.js";

/**
 * Piano editoriale personale: come diario e investimenti non e' mai condiviso
 * col team, quindi qui non c'e' nessun `teamId` e nessun `broadcastToTeam`.
 *
 * La generazione passa dall'AI, la pubblicazione no: da un contenuto si crea un
 * SocialPost solo con un'azione esplicita in dashboard, la stessa scelta fatta
 * per i post social (pubblicare su un profilo pubblico e' difficile da
 * annullare).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ITEMS_PER_WEEK = 3;
/** Oltre i 6 mesi un piano editoriale non e' piu' un piano: e' un preventivo di token. */
const MAX_PERIOD_DAYS = 183;
const DEFAULT_TIME_MINUTES = 9 * 60;

export interface CreatePlanInput {
  name?: string;
  brief: string;
  audience?: string;
  tone?: string;
  objective?: string;
  channels: string[];
  periodStart: Date;
  periodEnd: Date;
  itemsPerWeek?: number;
}

export type ItemStatus = "idea" | "approved" | "discarded";

/** Minuti dopo la mezzanotte da un "HH:MM"; le 9:00 se il modello manda qualcosa di inutilizzabile. */
function parseMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? "");
  if (!match) return DEFAULT_TIME_MINUTES;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return DEFAULT_TIME_MINUTES;
  return hours * 60 + minutes;
}

/**
 * Istante di pubblicazione a partire da giorno e ora proposti dal modello.
 * Aritmetica in millisecondi sull'inizio del periodo (che arriva come
 * mezzanotte locale dal client), cosi' l'ora proposta resta quella locale senza
 * dover gestire fusi orari. Fuori periodo si taglia agli estremi: un contenuto
 * datato oltre la fine e' un errore del modello, non un motivo per rifiutare
 * tutto il piano.
 */
function scheduledForOf(periodStart: Date, periodEnd: Date, dayOffset: number, time: string): Date {
  const day = Number.isFinite(dayOffset) ? Math.max(0, Math.trunc(dayOffset)) : 0;
  const candidate = periodStart.getTime() + day * DAY_MS + parseMinutes(time) * 60 * 1000;
  return new Date(Math.min(Math.max(candidate, periodStart.getTime()), periodEnd.getTime()));
}

/**
 * Legge un "YYYY-MM-DD" come giorno locale del server. Serve a chat e bot, che
 * mandano date senza ora: `new Date("2026-09-01")` sarebbe mezzanotte UTC, e
 * l'inizio del periodo e' proprio il riferimento su cui poi si sommano giorni e
 * ore dei contenuti. La dashboard manda già un ISO completo e non passa da qui.
 */
export function parseLocalDay(value: string, boundary: "start" | "end" = "start"): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) throw new Error(`Data non valida: "${value}". Usa il formato YYYY-MM-DD.`);
  const [, year, month, day] = match;
  return boundary === "start"
    ? new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0)
    : new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
}

export async function createPlan(userId: string, input: CreatePlanInput) {
  const durationMs = input.periodEnd.getTime() - input.periodStart.getTime();
  if (!(durationMs > 0)) throw new Error("La fine del periodo deve venire dopo l'inizio.");

  const durationDays = Math.ceil(durationMs / DAY_MS);
  if (durationDays > MAX_PERIOD_DAYS) {
    throw new Error(`Il periodo non puo' superare ${MAX_PERIOD_DAYS} giorni: genera piani piu' corti, uno per volta.`);
  }
  if (input.channels.length === 0) throw new Error("Indica almeno un canale su cui pubblicare.");

  const generated = await generateEditorialPlan({
    brief: input.brief,
    audience: input.audience,
    tone: input.tone,
    objective: input.objective,
    channels: input.channels,
    durationDays,
    itemsPerWeek: input.itemsPerWeek ?? DEFAULT_ITEMS_PER_WEEK,
  });

  const plan = await prisma.marketingPlan.create({
    data: {
      userId,
      name: input.name?.trim() || generated.name,
      brief: input.brief,
      audience: input.audience,
      tone: input.tone,
      objective: input.objective,
      channels: input.channels,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
  });

  await prisma.marketingPlanItem.createMany({
    data: generated.items.map((item) => ({
      planId: plan.id,
      scheduledFor: scheduledForOf(input.periodStart, input.periodEnd, item.dayOffset, item.time),
      channel: item.channel,
      format: item.format,
      title: item.title,
      copy: item.copy,
      hashtags: item.hashtags ?? [],
    })),
  });

  return getPlan(userId, plan.id);
}

export async function listPlans(userId: string) {
  return prisma.marketingPlan.findMany({
    where: { userId },
    include: { items: { orderBy: { scheduledFor: "asc" } } },
    orderBy: { periodStart: "desc" },
  });
}

export async function getPlan(userId: string, planId: string) {
  const plan = await prisma.marketingPlan.findFirst({
    where: { id: planId, userId },
    include: { items: { orderBy: { scheduledFor: "asc" } } },
  });
  if (!plan) throw new Error("Piano editoriale non trovato.");
  return plan;
}

export async function deletePlan(userId: string, planId: string) {
  // Ownership prima di toccare i contenuti: l'id del piano arriva dal client.
  await getPlan(userId, planId);
  await prisma.marketingPlanItem.deleteMany({ where: { planId } });
  await prisma.marketingPlan.delete({ where: { id: planId } });
}

/** Il contenuto con il suo piano, solo se il piano e' di questo utente. */
async function ownedItem(userId: string, itemId: string) {
  const item = await prisma.marketingPlanItem.findUnique({ where: { id: itemId }, include: { plan: true } });
  if (!item || item.plan.userId !== userId) throw new Error("Contenuto non trovato.");
  return item;
}

export async function setItemStatus(userId: string, itemId: string, status: ItemStatus) {
  await ownedItem(userId, itemId);
  return prisma.marketingPlanItem.update({ where: { id: itemId }, data: { status } });
}

export interface ScheduleItemInput {
  socialAccountId: string;
  /** Se assente si usa la data proposta dal piano. */
  scheduledAt?: Date;
  mediaPath?: string;
}

/**
 * Trasforma un contenuto del piano in un post social programmato. Resta
 * un'azione della dashboard: l'assistente AI non ha un tool per farla.
 */
export async function scheduleItem(userId: string, itemId: string, input: ScheduleItemInput) {
  const item = await ownedItem(userId, itemId);
  if (item.socialPostId) throw new Error("Questo contenuto e' già stato programmato.");

  const hashtags = item.hashtags.length > 0 ? `\n\n${item.hashtags.map((h) => `#${h}`).join(" ")}` : "";
  const post = await schedulePost({
    userId,
    socialAccountId: input.socialAccountId,
    content: `${item.copy}${hashtags}`,
    scheduledAt: input.scheduledAt ?? item.scheduledFor,
    mediaPath: input.mediaPath,
  });

  return prisma.marketingPlanItem.update({
    where: { id: itemId },
    data: { socialPostId: post.id, status: "approved" },
  });
}

/** Riassunto testuale per la chat e per il bot Telegram, che non hanno una tabella da mostrare. */
export function formatPlanForChat(plan: Awaited<ReturnType<typeof getPlan>>): string {
  const lines = plan.items.map(
    (item) =>
      `• ${item.scheduledFor.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` +
      ` — [${item.channel}/${item.format}] ${item.title}`,
  );
  return [`📅 ${plan.name} — ${plan.items.length} contenuti:`, ...lines].join("\n");
}
