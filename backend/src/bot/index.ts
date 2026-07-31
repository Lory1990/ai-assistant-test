import { Bot } from "grammy";
import type { AiContentPart } from "../ai/types.js";
import { env } from "../config/env.js";
import { prisma } from "../db/client.js";
import { unsetUserFields } from "../db/rawOps.js";
import { generateCode } from "../utils/code.js";
import { listDevicesForUser, toggleDevice } from "../modules/shelly/index.js";
import { listShutters, openShutter, closeShutter, stopShutter } from "../modules/tahoma/index.js";
import { getTodayMeals, attachPhotoToLatestMeal } from "../modules/food/index.js";
import { savePhoto } from "../modules/food/photoStorage.js";
import { createGoal, listGoals } from "../modules/goals/index.js";
import { markEventImportant, getUpcomingImportantEvents } from "../modules/calendar/index.js";
import { logExerciseFromText, generateRecap } from "../modules/workout/index.js";
import { playOnAlexa } from "../modules/music/index.js";
import { turnOnTv, sendTvCommand, pairTv } from "../modules/tv/index.js";
import { createMealPlan } from "../modules/mealPlan/index.js";
import { listItems, markItemChecked } from "../modules/shoppingList/index.js";
import { addHolding, removeHolding, getPortfolio } from "../modules/investments/index.js";
import { addEntry as addDiaryEntry, listEntries as listDiaryEntries } from "../modules/diary/index.js";
import { chat, type ChatMessage } from "../modules/assistant/index.js";
import {
  appendMessage,
  archiveActiveConversation,
  getContextMessages,
  getOrCreateActiveConversation,
} from "../modules/conversations/index.js";
import { transcribeAudio } from "../modules/assistant/transcribe.js";
import { broadcastToTeam } from "../ws/index.js";

const LINK_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni: mostrato una volta al primo contatto

export function createBot(): Bot {
  if (!env.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN non configurato: impostalo in backend/.env");
  }

  const bot = new Bot(env.telegramBotToken);

  /**
   * Un turno completo con l'assistente, persistito: recupera la conversazione
   * attiva del canale telegram, salva il messaggio dell'utente, chiama il
   * modello con la history salvata e salva la risposta.
   *
   * `promptContent` puo' contenere un'immagine (foto in visione), mentre
   * `storedContent` e' cio' che finisce a DB e nel contesto dei turni
   * successivi: la foto non viene ripassata al modello ogni volta, la sua
   * descrizione vive nella risposta dell'assistente.
   */
  async function runAssistantTurn(params: {
    userId: string;
    teamId: string;
    promptContent: ChatMessage["content"];
    storedContent: string;
    photoPath?: string;
  }) {
    const conversation = await getOrCreateActiveConversation(params.userId, "telegram", params.storedContent);
    await appendMessage({
      conversationId: conversation.id,
      role: "user",
      content: params.storedContent,
      photoPath: params.photoPath,
    });

    const previous = await getContextMessages(conversation.id);
    // getContextMessages restituisce anche il messaggio appena salvato in forma
    // testuale: per questo turno lo sostituiamo con la versione che contiene
    // l'immagine, quando c'e'.
    const history: ChatMessage[] = [...previous.slice(0, -1), { role: "user", content: params.promptContent }];

    const result = await chat({ userId: params.userId, teamId: params.teamId }, history);

    await appendMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: result.reply,
      toolNames: result.toolCalls.map((t) => t.name),
    });

    return result;
  }

  /**
   * Se il telegramId non e' ancora collegato a nessun account, crea un Team
   * "standalone" al volo (modalita' solo-bot). Chi ha gia' un account web
   * (Keycloak) puo' collegare lo stesso bot al proprio team con /collega,
   * oppure incollare nel proprio Profilo web il codice mostrato da /start.
   */
  async function getOrCreateUser(telegramId: string) {
    const existing = await prisma.user.findUnique({ where: { telegramId }, include: { team: true } });
    if (existing) return existing;

    const team = await prisma.team.create({
      data: { name: `Team Telegram ${telegramId}`, inviteCode: generateCode() },
    });
    return prisma.user.create({ data: { telegramId, teamId: team.id }, include: { team: true } });
  }

  /** Genera (o riusa se ancora valido) il codice da incollare nel profilo web, se l'utente non e' gia' collegato. */
  async function ensureLinkCode(user: Awaited<ReturnType<typeof getOrCreateUser>>): Promise<string | null> {
    if (user.keycloakId) return null;

    const now = new Date();
    if (user.telegramLinkCode && user.telegramLinkCodeExpiresAt && user.telegramLinkCodeExpiresAt > now) {
      return user.telegramLinkCode;
    }

    const code = generateCode(6);
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramLinkCode: code, telegramLinkCodeExpiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS) },
    });
    return code;
  }

  async function downloadTelegramFile(fileId: string): Promise<Buffer> {
    const file = await bot.api.getFile(fileId);
    const res = await fetch(`https://api.telegram.org/file/bot${env.telegramBotToken}/${file.file_path}`);
    return Buffer.from(await res.arrayBuffer());
  }

  bot.command("start", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const code = await ensureLinkCode(user);

    const lines = [
      "Ciao! Sono il tuo assistente di famiglia.",
      "Scrivimi in linguaggio naturale quello che ti serve — testo, foto o messaggi vocali: me ne occupo io " +
        "(luci, pasti, piani alimentari, obiettivi, allenamenti, calendario, lista della spesa, investimenti...).",
    ];
    if (code) {
      lines.push(
        "",
        `Per collegare questo bot al tuo profilo web, apri "Profilo" nella dashboard e incolla questo codice: ${code}`,
      );
    } else {
      lines.push("", `Sei collegato al team "${user.team.name}".`);
    }
    lines.push("", "(/help per l'elenco completo dei comandi rapidi, non necessario per l'uso normale.)");
    await ctx.reply(lines.join("\n"));
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Comandi rapidi (facoltativi — puoi anche scrivermi in linguaggio naturale):\n\n" +
        "/collega <codice> — collega questo bot a un team web che ha generato un codice dalla dashboard\n\n" +
        "Casa:\n" +
        "/luci · /accendi <id> · /spegni <id>\n" +
        "/serrande · /apriserranda <id> · /chiudiserranda <id> · /fermaserranda <id>\n" +
        "/tvaccendi · /tv <comando> · /tvpair <pin>\n\n" +
        "Obiettivi: /obiettivo <testo> (team) · /obiettivopersonale <testo> · /obiettivopalestra <testo> · /obiettivi\n\n" +
        "Alimentazione: /pasti · /pianoalimentare <richiesta> · /spesa · /spesafatta <nome>\n\n" +
        "Allenamento: /allenamento <esercizio> · /recap\n\n" +
        "Calendario: /importante <eventId> · /eventi\n\n" +
        "Musica: /suona <brano>\n\n" +
        "Investimenti (personali): /investimenti · /investiaggiungi <simbolo> <quantità> [prezzo] · /investirimuovi <simbolo>\n\n" +
        "Diario personale (mai visto dall'IA): /diario <testo> · /diarioultimi\n\n" +
        "Conversazione: /nuovachat — chiude quella in corso e ne apre una nuova (lo storico resta salvato)",
    );
  });

  // Le conversazioni sono salvate e riprese automaticamente: questo serve a
  // chiudere il thread corrente quando si cambia argomento, cosi' il contesto
  // vecchio non pesa sulle risposte successive.
  bot.command("nuovachat", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const closed = await archiveActiveConversation(user.id, "telegram");
    await ctx.reply(
      closed
        ? "Conversazione chiusa: la trovi nello storico. Il prossimo messaggio ne apre una nuova."
        : "Non c'era nessuna conversazione in corso: scrivimi quando vuoi.",
    );
  });

  bot.command("collega", async (ctx) => {
    const code = ctx.match?.toString().trim().toUpperCase();
    if (!code) return ctx.reply("Uso: /collega <codice> (generato dalla dashboard web)");

    const target = await prisma.user.findUnique({ where: { telegramLinkCode: code } });
    if (!target || !target.telegramLinkCodeExpiresAt || target.telegramLinkCodeExpiresAt < new Date()) {
      return ctx.reply("Codice non valido o scaduto. Generane uno nuovo dalla dashboard.");
    }

    const telegramId = String(ctx.from!.id);
    // Se questo telegramId era gia' associato a un account standalone, lo scollega
    // (la cronologia registrata finora resta su quell'account, non viene unita).
    const currentOwner = await prisma.user.findUnique({ where: { telegramId } });
    if (currentOwner && currentOwner.id !== target.id) {
      await unsetUserFields(currentOwner.id, ["telegramId"]);
    }
    await prisma.user.update({ where: { id: target.id }, data: { telegramId } });
    await unsetUserFields(target.id, ["telegramLinkCode", "telegramLinkCodeExpiresAt"]);

    const team = await prisma.team.findUnique({ where: { id: target.teamId } });
    await ctx.reply(`Bot collegato al team "${team?.name}". Da ora i dati che invii sono condivisi con quel team.`);
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
    await createGoal({ userId: user.id, teamId: user.teamId, title, category: "general", scope: "team" });
    await ctx.reply(`Obiettivo di team salvato: "${title}"`);
  });

  bot.command("obiettivopersonale", async (ctx) => {
    const title = ctx.match?.toString().trim();
    if (!title) return ctx.reply("Uso: /obiettivopersonale <testo dell'obiettivo>");
    const user = await getOrCreateUser(String(ctx.from!.id));
    await createGoal({ userId: user.id, teamId: user.teamId, title, category: "general", scope: "personal" });
    await ctx.reply(`Obiettivo personale salvato: "${title}"`);
  });

  bot.command("obiettivopalestra", async (ctx) => {
    const title = ctx.match?.toString().trim();
    if (!title) return ctx.reply("Uso: /obiettivopalestra <testo dell'obiettivo>");
    const user = await getOrCreateUser(String(ctx.from!.id));
    await createGoal({ userId: user.id, teamId: user.teamId, title, category: "gym", scope: "team" });
    await ctx.reply(`Obiettivo di allenamento salvato: "${title}"`);
  });

  bot.command("obiettivi", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const { teamGoals, personalGoals } = await listGoals(user.teamId, user.id);
    if (teamGoals.length === 0 && personalGoals.length === 0) return ctx.reply("Nessun obiettivo attivo.");

    const lines: string[] = [];
    if (teamGoals.length > 0) {
      lines.push("👨‍👩‍👧 Team:", ...teamGoals.map((g) => `• [${g.category}] ${g.title}`), "");
    }
    if (personalGoals.length > 0) {
      lines.push("🔒 Personali:", ...personalGoals.map((g) => `• [${g.category}] ${g.title}`));
    }
    await ctx.reply(lines.join("\n"));
  });

  bot.command("pasti", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const meals = await getTodayMeals(user.teamId);
    if (meals.length === 0) return ctx.reply("Nessun pasto registrato oggi.");

    const eaten = meals.filter((m) => !m.planned);
    const planned = meals.filter((m) => m.planned);
    const mealLine = (m: (typeof meals)[number]) =>
      `• ${m.description}${m.grams ? ` (${m.grams}g)` : ""}${m.calories ? ` — ${Math.round(m.calories)} kcal` : ""} [${m.user.displayName ?? m.user.telegramId}]`;

    const lines: string[] = [];
    if (eaten.length > 0) {
      const totalEaten = eaten.reduce((sum, m) => sum + (m.calories ?? 0), 0);
      lines.push("✅ Mangiati:", ...eaten.map(mealLine), `Totale: ${Math.round(totalEaten)} kcal`, "");
    }
    if (planned.length > 0) {
      const totalPlanned = planned.reduce((sum, m) => sum + (m.calories ?? 0), 0);
      lines.push("📋 Pianificati (dal piano alimentare):", ...planned.map(mealLine), `Totale: ${Math.round(totalPlanned)} kcal`);
    }
    await ctx.reply(lines.join("\n"));
  });

  bot.command("pianoalimentare", async (ctx) => {
    const request = ctx.match?.toString().trim();
    if (!request) return ctx.reply('Uso: /pianoalimentare <richiesta>, es. "1800 kcal, vegetariano, voglio perdere peso"');
    const user = await getOrCreateUser(String(ctx.from!.id));
    await ctx.reply("Genero il piano alimentare, un momento...");
    try {
      await ctx.reply(await createMealPlan(user.id, user.teamId, request));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("spesa", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const items = await listItems(user.teamId);
    if (items.length === 0) return ctx.reply("Lista della spesa vuota.");
    await ctx.reply(
      items.map((i) => `${i.checked ? "✅" : "⬜"} ${i.name}${i.quantity ? ` (${i.quantity})` : ""}`).join("\n"),
    );
  });

  bot.command("spesafatta", async (ctx) => {
    const nameQuery = ctx.match?.toString().trim();
    if (!nameQuery) return ctx.reply("Uso: /spesafatta <nome articolo>");
    const user = await getOrCreateUser(String(ctx.from!.id));
    const updated = await markItemChecked(user.teamId, nameQuery);
    if (!updated) return ctx.reply(`Nessun articolo da acquistare trovato per "${nameQuery}".`);
    await ctx.reply(`Segnato come acquistato: ${updated.name}`);
  });

  bot.command("allenamento", async (ctx) => {
    const text = ctx.match?.toString().trim();
    if (!text) return ctx.reply('Uso: /allenamento <esercizio>, es. "panca piana 4x8 60kg"');
    const user = await getOrCreateUser(String(ctx.from!.id));
    const session = await logExerciseFromText(user.id, user.teamId, text);
    const lastExercise = session.exercises.at(-1)!;
    await ctx.reply(
      `Esercizio registrato: ${lastExercise.name}` +
        (lastExercise.sets ? ` — ${lastExercise.sets}x${lastExercise.reps ?? "?"}` : "") +
        (lastExercise.weightKg ? ` @ ${lastExercise.weightKg}kg` : ""),
    );
  });

  bot.command("recap", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    await ctx.reply(await generateRecap(user.teamId, user.team.recapFrequencyDays));
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
    const events = await getUpcomingImportantEvents(user.teamId);
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

  bot.command("investimenti", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    try {
      const { holdings, totalValue } = await getPortfolio(user.id);
      if (holdings.length === 0) return ctx.reply("Nessun titolo in portafoglio. Usa /investiaggiungi per iniziare.");
      const lines = holdings.map((h) => {
        if (h.error) return `• ${h.symbol}: ${h.quantity} quote — errore prezzo (${h.error})`;
        const gain = h.gainLoss != null ? ` (${h.gainLoss >= 0 ? "+" : ""}${h.gainLoss.toFixed(2)})` : "";
        return `• ${h.symbol}: ${h.quantity} quote @ ${h.price?.toFixed(2)} = ${h.value?.toFixed(2)}${gain}`;
      });
      await ctx.reply([...lines, "", `Totale: ${totalValue.toFixed(2)}`].join("\n"));
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  bot.command("investiaggiungi", async (ctx) => {
    const parts = ctx.match?.toString().trim().split(/\s+/);
    if (!parts || parts.length < 2) return ctx.reply('Uso: /investiaggiungi <simbolo> <quantità> [prezzo medio], es. "AAPL 10 150"');
    const [symbol, quantityStr, costBasisStr] = parts;
    const quantity = Number(quantityStr.replace(",", "."));
    const costBasis = costBasisStr ? Number(costBasisStr.replace(",", ".")) : undefined;
    if (!quantity || quantity <= 0) return ctx.reply("Quantità non valida.");

    const user = await getOrCreateUser(String(ctx.from!.id));
    await addHolding(user.id, symbol, quantity, costBasis);
    await ctx.reply(`Aggiunto al portafoglio: ${quantity} ${symbol.toUpperCase()}${costBasis ? ` @ ${costBasis}` : ""}`);
  });

  bot.command("investirimuovi", async (ctx) => {
    const symbol = ctx.match?.toString().trim().toUpperCase();
    if (!symbol) return ctx.reply("Uso: /investirimuovi <simbolo>");
    const user = await getOrCreateUser(String(ctx.from!.id));
    const { holdings } = await getPortfolio(user.id);
    const match = holdings.find((h) => h.symbol === symbol);
    if (!match) return ctx.reply(`Nessun titolo "${symbol}" in portafoglio.`);
    await removeHolding(user.id, match.id);
    await ctx.reply(`Rimosso dal portafoglio: ${symbol}`);
  });

  // Diario personale: deliberatamente NON instradato sull'assistente AI (a
  // differenza di tutto il resto), per restare uno spazio privato anche
  // dall'IA, non solo dal team.
  bot.command("diario", async (ctx) => {
    const content = ctx.match?.toString().trim();
    if (!content) return ctx.reply('Uso: /diario <testo>, es. "oggi è andata bene perché..."');
    const user = await getOrCreateUser(String(ctx.from!.id));
    await addDiaryEntry(user.id, content);
    await ctx.reply("📔 Annotato nel diario.");
  });

  bot.command("diarioultimi", async (ctx) => {
    const user = await getOrCreateUser(String(ctx.from!.id));
    const entries = await listDiaryEntries(user.id, 10);
    if (entries.length === 0) return ctx.reply("Diario vuoto.");
    await ctx.reply(
      entries.map((e) => `• ${e.createdAt.toLocaleDateString("it-IT")}: ${e.content}`).join("\n"),
    );
  });

  // Foto: inoltrata in visione all'assistente AI, che decide cosa farne
  // (tipicamente registrarla come pasto con una stima di grammatura/calorie).
  bot.on("message:photo", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    const user = await getOrCreateUser(telegramId);
    const photo = ctx.message.photo.at(-1)!;

    try {
      const buffer = await downloadTelegramFile(photo.file_id);
      const photoPath = await savePhoto(buffer, `${Date.now()}-${photo.file_id}.jpg`);

      const caption =
        ctx.message.caption?.trim() ||
        "Ecco una foto. Se è cibo, registrala tra i pasti di oggi stimando grammatura e calorie; altrimenti dimmi cosa vedi o agisci di conseguenza.";

      const promptContent: AiContentPart[] = [
        { type: "image", mediaType: "image/jpeg", base64: buffer.toString("base64") },
        { type: "text", text: caption },
      ];

      const result = await runAssistantTurn({
        userId: user.id,
        teamId: user.teamId,
        promptContent,
        storedContent: `[foto] ${caption}`,
        photoPath,
      });

      if (result.toolCalls.some((t) => t.name === "log_meal")) {
        await attachPhotoToLatestMeal(user.id, photoPath).catch(() => {});
      }
      if (result.toolCalls.length > 0) {
        broadcastToTeam(user.teamId, { type: "data-updated", reason: "assistant-tool-call" });
      }
      await ctx.reply(result.reply);
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  // Messaggi vocali: trascritti con Whisper e poi trattati come testo libero.
  bot.on("message:voice", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    const user = await getOrCreateUser(telegramId);

    try {
      const buffer = await downloadTelegramFile(ctx.message.voice.file_id);
      const text = await transcribeAudio(buffer, "voice.ogg");

      const result = await runAssistantTurn({
        userId: user.id,
        teamId: user.teamId,
        promptContent: text,
        storedContent: text,
      });
      if (result.toolCalls.length > 0) {
        broadcastToTeam(user.teamId, { type: "data-updated", reason: "assistant-tool-call" });
      }

      await ctx.reply(`🎙️ «${text}»\n\n${result.reply}`);
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  // Testo libero: instradato all'assistente AI con tool-calling, che decide
  // autonomamente quale funzione chiamare (pasto, luce, obiettivo, ecc.).
  bot.on("message:text", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    const user = await getOrCreateUser(telegramId);

    try {
      const result = await runAssistantTurn({
        userId: user.id,
        teamId: user.teamId,
        promptContent: ctx.message.text,
        storedContent: ctx.message.text,
      });
      if (result.toolCalls.length > 0) {
        broadcastToTeam(user.teamId, { type: "data-updated", reason: "assistant-tool-call" });
      }
      await ctx.reply(result.reply);
    } catch (err) {
      await ctx.reply(`Errore: ${(err as Error).message}`);
    }
  });

  return bot;
}
