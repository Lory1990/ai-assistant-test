import cron from "node-cron";
import { Bot } from "grammy";
import { getEventsNeedingReminder, markReminderSent } from "./index.js";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Ogni 10 minuti controlla gli eventi importanti in arrivo entro un'ora e
 * manda un promemoria Telegram a tutti i membri del team (evento condiviso),
 * una sola volta per evento.
 */
export function startCalendarReminderScheduler(bot: Bot) {
  cron.schedule("*/10 * * * *", async () => {
    const events = await getEventsNeedingReminder(new Date(), ONE_HOUR_MS);
    for (const event of events) {
      const recipients = event.team.members.filter((m) => m.telegramId);
      try {
        await Promise.all(
          recipients.map((m) =>
            bot.api.sendMessage(
              m.telegramId!,
              `⏰ Promemoria: "${event.title}" è importante e inizia alle ${event.startsAt.toLocaleTimeString("it-IT")}.`,
            ),
          ),
        );
        await markReminderSent(event.id);
      } catch (err) {
        console.error(`Errore invio reminder evento ${event.id}:`, err);
      }
    }
  });
}
