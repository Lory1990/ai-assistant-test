import cron from "node-cron";
import { Bot } from "grammy";
import { getDueActions, markActionSent } from "./index.js";

/**
 * Ogni 15 minuti controlla se ci sono GoalAction schedulate e non ancora
 * inviate, e le manda via Telegram all'utente proprietario dell'obiettivo.
 */
export function startGoalScheduler(bot: Bot) {
  cron.schedule("*/15 * * * *", async () => {
    const dueActions = await getDueActions(new Date());
    for (const action of dueActions) {
      try {
        await bot.api.sendMessage(action.goal.user.telegramId, `🎯 ${action.goal.title}: ${action.message}`);
        await markActionSent(action.id);
      } catch (err) {
        console.error(`Errore invio goal action ${action.id}:`, err);
      }
    }
  });
}
