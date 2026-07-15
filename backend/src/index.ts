import Fastify from "fastify";
import { createBot } from "./bot/index.js";
import { startGoalScheduler } from "./modules/goals/scheduler.js";
import { startCalendarReminderScheduler } from "./modules/calendar/scheduler.js";
import { startWorkoutRecapScheduler } from "./modules/workout/scheduler.js";

async function main() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });

  const bot = createBot();
  startGoalScheduler(bot);
  startCalendarReminderScheduler(bot);
  startWorkoutRecapScheduler(bot);

  bot.start();
  app.log.info("Telegram bot avviato");
}

main().catch((err) => {
  console.error("Errore fatale in avvio:", err);
  process.exit(1);
});
