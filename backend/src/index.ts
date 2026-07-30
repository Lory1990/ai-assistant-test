import Fastify from "fastify";
import cors from "@fastify/cors";
import { createBot } from "./bot/index.js";
import { startGoalScheduler } from "./modules/goals/scheduler.js";
import { startCalendarReminderScheduler } from "./modules/calendar/scheduler.js";
import { startWorkoutRecapScheduler } from "./modules/workout/scheduler.js";
import { registerTeamRoutes } from "./api/team.js";
import { registerHomeRoutes } from "./api/home.js";
import { registerAssistantRoutes } from "./api/assistant.js";
import { registerInvestmentsRoutes } from "./api/investments.js";
import { registerWebSocket } from "./ws/index.js";
import { registerGoogleAuthRoutes } from "./api/googleAuth.js";
import { registerDiaryRoutes } from "./api/diary.js";
import { ensureSparseUniqueIndexes } from "./db/ensureIndexes.js";

async function main() {
  await ensureSparseUniqueIndexes();

  const app = Fastify({ logger: true });
  // Metodi dichiarati esplicitamente: l'auto-rilevamento per-rotta di
  // @fastify/cors non riconosce sempre correttamente DELETE sulle rotte
  // parametriche (es. /api/investments/:id), lasciandolo fuori dal preflight
  // Access-Control-Allow-Methods e facendo bloccare la richiesta dal browser.
  await app.register(cors, { origin: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] });

  app.get("/health", async () => ({ status: "ok" }));
  registerTeamRoutes(app);
  registerHomeRoutes(app);
  registerAssistantRoutes(app);
  registerInvestmentsRoutes(app);
  registerGoogleAuthRoutes(app);
  registerDiaryRoutes(app);
  await registerWebSocket(app);

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
