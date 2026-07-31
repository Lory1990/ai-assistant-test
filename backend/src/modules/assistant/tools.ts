import type { AiToolDefinition } from "../../ai/types.js";
import { getDevices as getShellyDevices, toggleDevice as toggleShellyDevice } from "../shelly/index.js";
import { getShutters, openShutter, closeShutter, stopShutter } from "../tahoma/index.js";
import { logMeal, getTodayMeals } from "../food/index.js";
import { createGoal, listGoals } from "../goals/index.js";
import { logExerciseFromText, generateRecap } from "../workout/index.js";
import { markEventImportant, getUpcomingImportantEvents } from "../calendar/index.js";
import { listItems, addItems, markItemChecked } from "../shoppingList/index.js";
import { createMealPlan } from "../mealPlan/index.js";
import { addHolding, removeHolding, getPortfolio } from "../investments/index.js";
import { createPlan as createMarketingPlan, listPlans as listMarketingPlans, formatPlanForChat, parseLocalDay } from "../marketing/index.js";

export interface ToolContext {
  userId: string;
  teamId: string;
}

export const ASSISTANT_TOOLS: AiToolDefinition[] = [
  {
    name: "list_shelly_devices",
    description: "Elenca le luci/prese Shelly di casa con il loro stato (online/offline, acceso/spento).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "toggle_shelly_device",
    description: "Accende o spegne una luce/presa Shelly.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Id del device, ottenuto da list_shelly_devices." },
        on: { type: "boolean", description: "true per accendere, false per spegnere." },
      },
      required: ["deviceId", "on"],
    },
  },
  {
    name: "list_tahoma_shutters",
    description: "Elenca le serrande Tahoma di casa.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "control_tahoma_shutter",
    description: "Apre, chiude o ferma una serranda Tahoma.",
    inputSchema: {
      type: "object",
      properties: {
        deviceURL: { type: "string", description: "deviceURL della serranda, ottenuto da list_tahoma_shutters." },
        command: { type: "string", enum: ["open", "close", "stop"] },
      },
      required: ["deviceURL", "command"],
    },
  },
  {
    name: "log_meal",
    description: "Registra un pasto mangiato ora tra i pasti di oggi del team.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: 'es. "pasta al pomodoro"' },
        grams: { type: "number" },
      },
      required: ["description"],
    },
  },
  {
    name: "get_today_meals",
    description: "Elenca i pasti (mangiati e pianificati) registrati oggi dal team, con calorie.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "generate_meal_plan",
    description: "Genera con l'AI un piano alimentare per oggi in base alla richiesta e lo salva tra i pasti pianificati, aggiornando anche la lista della spesa.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: 'es. "1800 kcal, vegetariano, voglio perdere peso"' },
      },
      required: ["request"],
    },
  },
  {
    name: "get_shopping_list",
    description: "Mostra la lista della spesa del team.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_shopping_list_items",
    description: "Aggiunge articoli alla lista della spesa.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, quantity: { type: "string" } },
            required: ["name"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "check_shopping_list_item",
    description: "Segna un articolo della lista della spesa come acquistato.",
    inputSchema: {
      type: "object",
      properties: { nameQuery: { type: "string", description: "Nome (anche parziale) dell'articolo." } },
      required: ["nameQuery"],
    },
  },
  {
    name: "create_goal",
    description:
      "Crea un nuovo obiettivo (generale o di allenamento), visibile a tutto il team oppure solo all'utente che lo crea.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string", enum: ["general", "gym"] },
        scope: { type: "string", enum: ["personal", "team"], description: "Default 'team' se non specificato." },
        dueDate: { type: "string", description: "Scadenza in formato ISO (es. 2026-08-15), opzionale." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Default 'medium'." },
        important: { type: "boolean", description: "Segna l'obiettivo come particolarmente importante." },
      },
      required: ["title"],
    },
  },
  {
    name: "list_goals",
    description: "Elenca gli obiettivi attivi, separati tra quelli del team e quelli personali dell'utente.",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string", enum: ["general", "gym"] } },
    },
  },
  {
    name: "log_workout_exercise",
    description: 'Registra un esercizio svolto oggi, da testo libero (es. "panca piana 4x8 60kg").',
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "get_workout_recap",
    description: "Genera un recap dell'andamento degli allenamenti del team negli ultimi giorni.",
    inputSchema: {
      type: "object",
      properties: { periodDays: { type: "number", description: "Default 7 se non specificato." } },
    },
  },
  {
    name: "list_upcoming_events",
    description: "Elenca i prossimi eventi di calendario segnati come importanti.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "mark_event_important",
    description: "Segna un evento di calendario (gia' sincronizzato) come importante, per ricevere un promemoria.",
    inputSchema: {
      type: "object",
      properties: { externalId: { type: "string" } },
      required: ["externalId"],
    },
  },
  {
    name: "get_portfolio",
    description:
      "Mostra il portafoglio investimenti personale dell'utente (azioni/ETF) con prezzo di mercato aggiornato, valore e plusvalenza. Solo tracciamento: non fornisce consigli di investimento.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_investment_holding",
    description: "Aggiunge un titolo (azione/ETF) al portafoglio investimenti personale dell'utente.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: 'Ticker, es. "AAPL", "VWCE.DE".' },
        quantity: { type: "number" },
        costBasis: { type: "number", description: "Prezzo medio di acquisto per azione/quota, opzionale." },
      },
      required: ["symbol", "quantity"],
    },
  },
  {
    name: "remove_investment_holding",
    description: "Rimuove un titolo dal portafoglio investimenti personale, dato il simbolo.",
    inputSchema: {
      type: "object",
      properties: { symbol: { type: "string" } },
      required: ["symbol"],
    },
  },
  // Del marketing l'assistente puo' generare e rileggere il piano editoriale,
  // ma non programmare i contenuti: creare un post su un profilo pubblico resta
  // un'azione esplicita della dashboard, come per i post social.
  {
    name: "create_marketing_plan",
    description:
      "Genera con l'AI un piano editoriale di marketing personale (bozze di contenuti con canale, formato e data) e lo salva. Non pubblica e non programma nulla.",
    inputSchema: {
      type: "object",
      properties: {
        brief: { type: "string", description: 'Cosa promuovere e come, es. "lancio del corso di pilates di settembre"' },
        channels: {
          type: "array",
          items: { type: "string" },
          description: 'Canali su cui pubblicare, es. ["instagram", "facebook", "newsletter"].',
        },
        periodStart: { type: "string", description: "Primo giorno del piano, formato YYYY-MM-DD." },
        periodEnd: { type: "string", description: "Ultimo giorno del piano, formato YYYY-MM-DD." },
        name: { type: "string", description: "Titolo del piano, opzionale: se manca lo propone il modello." },
        audience: { type: "string", description: 'A chi si parla, es. "donne 30-50 anni a Milano".' },
        tone: { type: "string", description: 'Tono di voce, es. "diretto e informale".' },
        objective: { type: "string", description: 'Cosa deve ottenere, es. "prenotazioni della lezione di prova".' },
        itemsPerWeek: { type: "number", description: "Quanti contenuti a settimana (default 3)." },
      },
      required: ["brief", "channels", "periodStart", "periodEnd"],
    },
  },
  {
    name: "list_marketing_plans",
    description: "Elenca i piani editoriali di marketing personali dell'utente con i contenuti previsti.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function executeTool(name: string, input: any, ctx: ToolContext): Promise<string> {
  switch (name) {
    case "list_shelly_devices":
      return JSON.stringify(await getShellyDevices());

    case "toggle_shelly_device":
      return toggleShellyDevice(input.deviceId, input.on);

    case "list_tahoma_shutters":
      return JSON.stringify(await getShutters());

    case "control_tahoma_shutter": {
      const action = { open: openShutter, close: closeShutter, stop: stopShutter }[input.command as "open" | "close" | "stop"];
      if (!action) return `Comando non valido: ${input.command}`;
      return action(input.deviceURL);
    }

    case "log_meal": {
      const meal = await logMeal({ userId: ctx.userId, teamId: ctx.teamId, description: input.description, grams: input.grams });
      return `Pasto registrato: ${meal.description}${meal.calories ? ` (${Math.round(meal.calories)} kcal)` : ""}`;
    }

    case "get_today_meals":
      return JSON.stringify(await getTodayMeals(ctx.teamId));

    case "generate_meal_plan":
      return createMealPlan(ctx.userId, ctx.teamId, input.request);

    case "get_shopping_list":
      return JSON.stringify(await listItems(ctx.teamId));

    case "add_shopping_list_items":
      return JSON.stringify(await addItems(ctx.teamId, input.items));

    case "check_shopping_list_item": {
      const updated = await markItemChecked(ctx.teamId, input.nameQuery);
      return updated ? `Segnato come acquistato: ${updated.name}` : `Nessun articolo trovato per "${input.nameQuery}".`;
    }

    case "create_goal": {
      const goal = await createGoal({
        userId: ctx.userId,
        teamId: ctx.teamId,
        title: input.title,
        description: input.description,
        category: input.category ?? "general",
        scope: input.scope ?? "team",
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        priority: input.priority ?? "medium",
        important: input.important ?? false,
      });
      return `Obiettivo creato (${goal.scope}): ${goal.title}`;
    }

    case "list_goals":
      return JSON.stringify(await listGoals(ctx.teamId, ctx.userId, input.category));

    case "log_workout_exercise": {
      const session = await logExerciseFromText(ctx.userId, ctx.teamId, input.text);
      const last = session.exercises.at(-1)!;
      return `Esercizio registrato: ${last.name}${last.sets ? ` ${last.sets}x${last.reps ?? "?"}` : ""}${last.weightKg ? ` @ ${last.weightKg}kg` : ""}`;
    }

    case "get_workout_recap":
      return generateRecap(ctx.teamId, input.periodDays ?? 7);

    case "list_upcoming_events":
      return JSON.stringify(await getUpcomingImportantEvents(ctx.teamId));

    case "mark_event_important":
      await markEventImportant(ctx.userId, input.externalId);
      return `Evento ${input.externalId} segnato come importante.`;

    case "get_portfolio":
      return JSON.stringify(await getPortfolio(ctx.userId));

    case "add_investment_holding": {
      const holding = await addHolding(ctx.userId, input.symbol, input.quantity, input.costBasis);
      return `Aggiunto al portafoglio: ${holding.quantity} ${holding.symbol}`;
    }

    case "remove_investment_holding": {
      const { holdings } = await getPortfolio(ctx.userId);
      const match = holdings.find((h) => h.symbol === String(input.symbol).toUpperCase());
      if (!match) return `Nessun titolo "${input.symbol}" in portafoglio.`;
      await removeHolding(ctx.userId, match.id);
      return `Rimosso dal portafoglio: ${match.symbol}`;
    }

    case "create_marketing_plan": {
      const plan = await createMarketingPlan(ctx.userId, {
        name: input.name,
        brief: input.brief,
        audience: input.audience,
        tone: input.tone,
        objective: input.objective,
        channels: input.channels,
        periodStart: parseLocalDay(input.periodStart),
        periodEnd: parseLocalDay(input.periodEnd, "end"),
        itemsPerWeek: input.itemsPerWeek,
      });
      return `${formatPlanForChat(plan)}\n\nLe bozze sono nella sezione Marketing: da lì si approvano e si programmano.`;
    }

    case "list_marketing_plans": {
      const plans = await listMarketingPlans(ctx.userId);
      if (plans.length === 0) return "Nessun piano editoriale salvato.";
      return plans.map(formatPlanForChat).join("\n\n");
    }

    default:
      return `Tool sconosciuto: ${name}`;
  }
}
