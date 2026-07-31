import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import { createBot } from "./bot/index.js";
import { startGoalScheduler } from "./modules/goals/scheduler.js";
import { startCalendarReminderScheduler } from "./modules/calendar/scheduler.js";
import { startWorkoutRecapScheduler } from "./modules/workout/scheduler.js";
import { startSocialPublishScheduler } from "./modules/social/scheduler.js";
import { registerAuthRoutes } from "./api/auth.js";
import { registerTeamRoutes } from "./api/team.js";
import { registerHomeRoutes } from "./api/home.js";
import { registerAssistantRoutes } from "./api/assistant.js";
import { registerInvestmentsRoutes } from "./api/investments.js";
import { registerExpensesRoutes } from "./api/expenses.js";
import { registerWebSocket } from "./ws/index.js";
import { registerGoogleAuthRoutes } from "./api/googleAuth.js";
import { registerDiaryRoutes } from "./api/diary.js";
import { registerMemoryRoutes } from "./api/memory.js";
import { registerSocialRoutes } from "./api/social.js";
import { registerPlanRoutes } from "./api/plans.js";
import { registerMarketingRoutes } from "./api/marketing.js";
import { registerProjectRoutes } from "./api/projects.js";
import { ensureSparseUniqueIndexes } from "./db/ensureIndexes.js";

async function main() {
  await ensureSparseUniqueIndexes();

  const app = Fastify({ logger: true });
  // Metodi dichiarati esplicitamente: l'auto-rilevamento per-rotta di
  // @fastify/cors non riconosce sempre correttamente DELETE sulle rotte
  // parametriche (es. /api/investments/:id), lasciandolo fuori dal preflight
  // Access-Control-Allow-Methods e facendo bloccare la richiesta dal browser.
  await app.register(cors, { origin: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] });
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  // Le immagini dei post social devono essere scaricabili dai server di
  // Meta/Instagram: servite staticamente sotto /uploads.
  // @fastify/static rifiuta una root inesistente, quindi la creiamo prima.
  const uploadsRoot = join(process.cwd(), "uploads");
  await mkdir(uploadsRoot, { recursive: true });
  await app.register(fastifyStatic, { root: uploadsRoot, prefix: "/uploads/" });

  app.get("/health", async () => ({ status: "ok" }));
  registerAuthRoutes(app);
  registerTeamRoutes(app);
  registerHomeRoutes(app);
  registerAssistantRoutes(app);
  registerInvestmentsRoutes(app);
  registerExpensesRoutes(app);
  registerGoogleAuthRoutes(app);
  registerDiaryRoutes(app);
  registerMemoryRoutes(app);
  registerSocialRoutes(app);
  registerPlanRoutes(app);
  registerMarketingRoutes(app);
  registerProjectRoutes(app);
  await registerWebSocket(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });

  const bot = createBot();
  startGoalScheduler(bot);
  startCalendarReminderScheduler(bot);
  startWorkoutRecapScheduler(bot);
  startSocialPublishScheduler();

  bot.start();
  app.log.info("Telegram bot avviato");
}

main().catch((err) => {
  console.error("Errore fatale in avvio:", err);
  process.exit(1);
});
