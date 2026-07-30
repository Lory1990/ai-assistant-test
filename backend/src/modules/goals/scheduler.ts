import cron from "node-cron";
import { Bot } from "grammy";
import { getDueActions, markActionSent } from "./index.js";

/**
 * Ogni 15 minuti controlla se ci sono GoalAction schedulate e non ancora
 * inviate, e le manda via Telegram a tutti i membri del team che hanno
 * collegato il bot (l'obiettivo e' condiviso, quindi la motivazione anche).
 */
export function startGoalScheduler(bot: Bot) {
  cron.schedule("*/15 * * * *", async () => {
    const dueActions = await getDueActions(new Date());
    for (const action of dueActions) {
      const recipients = action.goal.team.members.filter((m) => m.telegramId);
      try {
        await Promise.all(
          recipients.map((m) => bot.api.sendMessage(m.telegramId!, `🎯 ${action.goal.title}: ${action.message}`)),
        );
        await markActionSent(action.id);
      } catch (err) {
        console.error(`Errore invio goal action ${action.id}:`, err);
      }
    }
  });
}
