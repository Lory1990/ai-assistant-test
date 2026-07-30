import { prisma } from "../../db/client.js";

/**
 * TODO: sync reale degli eventi da Google Calendar / Outlook Calendar API,
 * usando gli stessi access token OAuth2 del modulo email. Per ora questo
 * modulo lavora solo su eventi gia' presenti in DB (creati manualmente o da
 * un job di sync non ancora implementato).
 */
export async function markEventImportant(userId: string, externalId: string, important = true) {
  return prisma.calendarEvent.updateMany({
    where: { userId, externalId },
    data: { important },
  });
}

/**
 * Eventi importanti di tutto il team, non solo di chi li ha sincronizzati
 * (condivisione decisa per il Team).
 */
export async function getUpcomingImportantEvents(teamId: string) {
  return prisma.calendarEvent.findMany({
    where: { teamId, important: true, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { user: true },
  });
}

export async function getEventsNeedingReminder(now: Date, reminderWindowMs: number) {
  const windowEnd = new Date(now.getTime() + reminderWindowMs);
  return prisma.calendarEvent.findMany({
    where: {
      important: true,
      reminderSentAt: null,
      startsAt: { gte: now, lte: windowEnd },
    },
    include: { team: { include: { members: true } } },
  });
}

export async function markReminderSent(eventId: string) {
  return prisma.calendarEvent.update({ where: { id: eventId }, data: { reminderSentAt: new Date() } });
}
