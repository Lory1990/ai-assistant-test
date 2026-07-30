import cron from "node-cron";
import { Bot } from "grammy";
import { prisma } from "../../db/client.js";
import { generateRecap } from "./index.js";

/**
 * Ogni giorno alle 9:00 controlla, per ciascun team, se e' trascorso almeno
 * `recapFrequencyDays` dall'ultimo recap (o dalla creazione del team se non
 * ne ha mai ricevuto uno) e in caso affermativo invia il recap a tutti i
 * membri del team che hanno collegato il bot Telegram.
 */
export function startWorkoutRecapScheduler(bot: Bot) {
  cron.schedule("0 9 * * *", async () => {
    const teams = await prisma.team.findMany({ include: { members: true } });
    const now = new Date();

    for (const team of teams) {
      const lastRecap = team.lastWorkoutRecapAt ?? team.createdAt;
      const dueAt = new Date(lastRecap.getTime() + team.recapFrequencyDays * 24 * 60 * 60 * 1000);
      if (now < dueAt) continue;

      const recipients = team.members.filter((m) => m.telegramId);
      if (recipients.length === 0) continue;

      try {
        const recap = await generateRecap(team.id, team.recapFrequencyDays);
        await Promise.all(recipients.map((m) => bot.api.sendMessage(m.telegramId!, recap)));
        await prisma.team.update({ where: { id: team.id }, data: { lastWorkoutRecapAt: now } });
      } catch (err) {
        console.error(`Errore invio recap allenamenti per team ${team.id}:`, err);
      }
    }
  });
}
