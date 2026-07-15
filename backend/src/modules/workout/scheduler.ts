import cron from "node-cron";
import { Bot } from "grammy";
import { prisma } from "../../db/client.js";
import { generateRecap } from "./index.js";

/**
 * Ogni giorno alle 9:00 controlla, per ciascun utente, se e' trascorso
 * almeno `recapFrequencyDays` dall'ultimo recap (o dalla creazione utente se
 * non ne ha mai ricevuto uno) e in caso affermativo invia il recap via Telegram.
 */
export function startWorkoutRecapScheduler(bot: Bot) {
  cron.schedule("0 9 * * *", async () => {
    const users = await prisma.user.findMany();
    const now = new Date();

    for (const user of users) {
      const lastRecap = user.lastWorkoutRecapAt ?? user.createdAt;
      const dueAt = new Date(lastRecap.getTime() + user.recapFrequencyDays * 24 * 60 * 60 * 1000);
      if (now < dueAt) continue;

      try {
        const recap = await generateRecap(user.id, user.recapFrequencyDays);
        await bot.api.sendMessage(user.telegramId, recap);
        await prisma.user.update({ where: { id: user.id }, data: { lastWorkoutRecapAt: now } });
      } catch (err) {
        console.error(`Errore invio recap allenamenti per user ${user.id}:`, err);
      }
    }
  });
}
