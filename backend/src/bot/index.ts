import { Bot } from "grammy";
import { env } from "../config/env.js";
import { prisma } from "../db/client.js";
import { listDevicesForUser, toggleDevice } from "../modules/shelly/index.js";
import { listShutters, openShutter, closeShutter, stopShutter } from "../modules/tahoma/index.js";
import { logMeal, getTodayMeals } from "../modules/food/index.js";
import { savePhoto } from "../modules/food/photoStorage.js";
import { createGoal, listActiveGoals } from "../modules/goals/index.js";
import { markEventImportant, getUpcomingImportantEvents } from "../modules/calendar/index.js";
import { logExerciseFromText, generateRecap } from "../modules/workout/index.js";
import { playOnAlexa } from "../modules/music/index.js";
import { turnOnTv, sendTvCommand, pairTv } from "../modules/tv/index.js";

export function createBot(): Bot {
  if (!env.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN non configurato: impostalo in backend/.env");
  }

  const bot = new Bot(env.telegramBotToken);

  async function getOrCreateUser(telegramId: string) {
    return prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId },
    });
  }

  bot.command("start", async (ctx) => {
    await getOrCreateUser(String(ctx.from!.id));
    await ctx.reply(
      "Ciao! Sono il tuo assistente personale.\n\n" +
        "Casa:\n" +
        "/luci — stato dei device Shelly\n" +
        "/accendi <id> · /spegni <id> — controlla una luce/presa Shelly\n" +
        "/serrande — stato serrande Tahoma\n" +
        "/apriserranda <id> · /chiudiserranda <id> · /fermaserranda <id>\n" +
        "/tvaccendi — accende la TV Hisense (Wake-on-LAN)\n" +
        "/tv <comando> — es. volsu, volgiu, muto, home, ok (prima serve /tvpair <pin> una tantum)\n" +
        "/tvpair <pin> — autorizza il client con il PIN mostrato a schermo dalla TV\n\n" +
        "Obiettivi:\n" +
        "/obiettivo <testo> — aggiungi un obiettivo generale\n" +
        "/obiettivopalestra <testo> — aggiungi un obiettivo di allenamento\n" +
        "/obiettivi — elenco obiettivi attivi\n\n" +
        "Alimentazione:\n" +
        "/pasti — pasti registrati oggi\n\n" +
        "Allenamento:\n" +
        "/allenamento <esercizio> — es. \"panca piana 4x8 60kg\"\n" +
        "/recap — recap allenamenti su richiesta (normalmente arriva automaticamente ogni N giorni)\n\n" +
        "Calendario:\n" +
        "/importante <eventId> — segna un evento come importante\n" +
        "/eventi — prossimi eventi importanti\n\n" +
        "Musica:\n" +
        "/suona <brano> — cerca e riproduce su Alexa (richiede configurazione, vedi .env.example)\n\n" +
        "Altrimenti scrivimi cosa hai mangiato (es. \"150g pasta al pomodoro\") oppure mandami una foto del piatto.",
    );
  });

  bot.command("luci", async (ctx) => {
    try {
      await ctx.reply(await listDevicesForUser());
    } catch (err) {
      await ctx.reply(`Errore nel recuperare i device Shelly: ${(err as Error).message}`);
    }
  });

  bot.command("accendi", async (ctx) => {
    const deviceId = ctx.match?.toString().trim();
    if (!deviceId) return ctx.reply("Uso: /accendi <deviceId>");
    try {
      await ctx.reply(await toggleDevice(deviceId, true));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("spegni", async (ctx) => {
    const deviceId = ctx.match?.toString().trim();
    if (!deviceId) return ctx.reply("Uso: /spegni <deviceId>");
    try {
      await ctx.reply(await toggleDevice(deviceId, false));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("serrande", async (ctx) => {
    try {
      await ctx.reply(await listShutters());
    } catch (err) {
      await ctx.reply(`Errore nel recuperare le serrande Tahoma: ${(err as Error).message}`);
    }
  });

  bot.command("apriserranda", async (ctx) => {
    const deviceURL = ctx.match?.toString().trim();
    if (!deviceURL) return ctx.reply("Uso: /apriserranda <deviceURL>");
    try {
      await ctx.reply(await openShutter(deviceURL));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("chiudiserranda", async (ctx) => {
    const deviceURL = ctx.match?.toString().trim();
    if (!deviceURL) return ctx.reply("Uso: /chiudiserranda <deviceURL>");
    try {
      await ctx.reply(await closeShutter(deviceURL));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("fermaserranda", async (ctx) => {
    const deviceURL = ctx.match?.toString().trim();
    if (!deviceURL) return ctx.reply("Uso: /fermaserranda <deviceURL>");
    try {
      await ctx.reply(await stopShutter(deviceURL));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("tvaccendi", async (ctx) => {
    try {
      await ctx.reply(await turnOnTv());
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("tv", async (ctx) => {
    const command = ctx.match?.toString().trim();
    if (!command) return ctx.reply("Uso: /tv <comando> — es. volsu, volgiu, muto, home, ok");
    try {
      await ctx.reply(await sendTvCommand(command));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("tvpair", async (ctx) => {
    const pin = ctx.match?.toString().trim();
    if (!pin) return ctx.reply("Uso: /tvpair <pin mostrato a schermo dalla TV>");
    try {
      await ctx.reply(await pairTv(pin));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("obiettivo", async (ctx) => {
    const title = ctx.match?.toString().trim();
    if (!title) return ctx.reply("Uso: /obiettivo <testo dell'obiettivo>");
    const user = await getOrCreateUser(String(ctx.from!.id));
    await createGoal(user.id, title, undefined, "general");
    await ctx.reply(`Obiettivo salvato: "${title}"`);
  });

  bot.command("obiettivopalestra", async (ctx) => {
    const title = ctx.match?.toString().trim();
    if (!title) return ctx.reply("Uso: /obiettivopalestra <testo dell'obiettivo>");
    const user = await getOrCreateUser(String(ctx.from!.id));
    await createGoal(user.id, title, undefined, "gym");
    await ctx.reply(`Obiettivo di allenamento salvato: "${title}"`);
  });

  bot.command("obiettivi", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const goals = await listActiveGoals(user.id);
    if (goals.length === 0) return ctx.reply("Nessun obiettivo attivo.");
    await ctx.reply(goals.map((g) => `• [${g.category}] ${g.title}`).join("\n"));
  });

  bot.command("pasti", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const meals = await getTodayMeals(user.id);
    if (meals.length === 0) return ctx.reply("Nessun pasto registrato oggi.");
    const totalCalories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
    const lines = meals.map(
      (m) => `• ${m.description}${m.grams ? ` (${m.grams}g)` : ""}${m.calories ? ` — ${Math.round(m.calories)} kcal` : ""}`,
    );
    await ctx.reply([...lines, `\nTotale stimato: ${Math.round(totalCalories)} kcal`].join("\n"));
  });

  bot.command("allenamento", async (ctx) => {
    const text = ctx.match?.toString().trim();
    if (!text) return ctx.reply('Uso: /allenamento <esercizio>, es. "panca piana 4x8 60kg"');
    const user = await getOrCreateUser(String(ctx.from!.id));
    const session = await logExerciseFromText(user.id, text);
    const lastExercise = session.exercises.at(-1)!;
    await ctx.reply(
      `Esercizio registrato: ${lastExercise.name}` +
        (lastExercise.sets ? ` — ${lastExercise.sets}x${lastExercise.reps ?? "?"}` : "") +
        (lastExercise.weightKg ? ` @ ${lastExercise.weightKg}kg` : ""),
    );
  });

  bot.command("recap", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    await ctx.reply(await generateRecap(user.id, user.recapFrequencyDays));
  });

  bot.command("importante", async (ctx) => {
    const eventId = ctx.match?.toString().trim();
    if (!eventId) return ctx.reply("Uso: /importante <eventId>");
    const user = await getOrCreateUser(String(ctx.from!.id));
    await markEventImportant(user.id, eventId);
    await ctx.reply(`Evento ${eventId} segnato come importante. Ti avviserò prima che inizi.`);
  });

  bot.command("eventi", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const events = await getUpcomingImportantEvents(user.id);
    if (events.length === 0) return ctx.reply("Nessun evento importante in arrivo.");
    await ctx.reply(events.map((e) => `• ${e.title} — ${e.startsAt.toLocaleString("it-IT")}`).join("\n"));
  });

  bot.command("suona", async (ctx) => {
    const query = ctx.match?.toString().trim();
    if (!query) return ctx.reply("Uso: /suona <brano>");
    try {
      await ctx.reply(await playOnAlexa(query));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  // Foto: log pasto con immagine allegata (grammatura/descrizione da didascalia se presente)
  bot.on("message:photo", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const photo = ctx.message.photo.at(-1)!;
    const file = await ctx.api.getFile(photo.file_id);
    const res = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${file.file_path}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const photoPath = await savePhoto(buffer, `${Date.now()}-${photo.file_id}.jpg`);

    // TODO: se non c'e' didascalia, usare un modello vision per stimare piatto/porzione.
    const description = ctx.message.caption ?? "Pasto da foto (descrizione da definire)";
    const meal = await logMeal({ userId: user.id, description, photoPath });
    await ctx.reply(
      `Pasto registrato con foto: ${meal.description}${meal.calories ? ` — ${Math.round(meal.calories)} kcal` : " (calorie non disponibili)"}`,
    );
  });

  // Testo libero: per ora trattato sempre come log pasto.
  // TODO: sostituire con un router NLU (Claude) che classifica l'intento
  // (pasto / luce / serranda / obiettivo / allenamento / domanda generica)
  // prima di decidere il modulo, cosi' non serve piu' distinguere via comandi
  // dedicati come /allenamento.
  bot.on("message:text", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const text = ctx.message.text.trim();
    const gramsMatch = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
    const grams = gramsMatch ? Number(gramsMatch[1].replace(",", ".")) : undefined;

    const meal = await logMeal({ userId: user.id, description: text, grams });
    await ctx.reply(
      `Pasto registrato: ${meal.description}${meal.calories ? ` — ${Math.round(meal.calories)} kcal` : " (calorie non disponibili, configura CALORIE_API_* in .env)"}`,
    );
  });

  return bot;
}
