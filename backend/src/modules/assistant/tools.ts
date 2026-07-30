import type Anthropic from "@anthropic-ai/sdk";
import { getDevices as getShellyDevices, toggleDevice as toggleShellyDevice } from "../shelly/index.js";
import { getShutters, openShutter, closeShutter, stopShutter } from "../tahoma/index.js";
import { logMeal, getTodayMeals } from "../food/index.js";
import { createGoal, listGoals } from "../goals/index.js";
import { logExerciseFromText, generateRecap } from "../workout/index.js";
import { markEventImportant, getUpcomingImportantEvents } from "../calendar/index.js";
import { listItems, addItems, markItemChecked } from "../shoppingList/index.js";
import { createMealPlan } from "../mealPlan/index.js";
import { addHolding, removeHolding, getPortfolio } from "../investments/index.js";

export interface ToolContext {
  userId: string;
  teamId: string;
}

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_shelly_devices",
    description: "Elenca le luci/prese Shelly di casa con il loro stato (online/offline, acceso/spento).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "toggle_shelly_device",
    description: "Accende o spegne una luce/presa Shelly.",
    input_schema: {
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
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "control_tahoma_shutter",
    description: "Apre, chiude o ferma una serranda Tahoma.",
    input_schema: {
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
    input_schema: {
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
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "generate_meal_plan",
    description: "Genera con l'AI un piano alimentare per oggi in base alla richiesta e lo salva tra i pasti pianificati, aggiornando anche la lista della spesa.",
    input_schema: {
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
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_shopping_list_items",
    description: "Aggiunge articoli alla lista della spesa.",
    input_schema: {
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
    input_schema: {
      type: "object",
      properties: { nameQuery: { type: "string", description: "Nome (anche parziale) dell'articolo." } },
      required: ["nameQuery"],
    },
  },
  {
    name: "create_goal",
    description:
      "Crea un nuovo obiettivo (generale o di allenamento), visibile a tutto il team oppure solo all'utente che lo crea.",
    input_schema: {
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
    input_schema: {
      type: "object",
      properties: { category: { type: "string", enum: ["general", "gym"] } },
    },
  },
  {
    name: "log_workout_exercise",
    description: 'Registra un esercizio svolto oggi, da testo libero (es. "panca piana 4x8 60kg").',
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "get_workout_recap",
    description: "Genera un recap dell'andamento degli allenamenti del team negli ultimi giorni.",
    input_schema: {
      type: "object",
      properties: { periodDays: { type: "number", description: "Default 7 se non specificato." } },
    },
  },
  {
    name: "list_upcoming_events",
    description: "Elenca i prossimi eventi di calendario segnati come importanti.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "mark_event_important",
    description: "Segna un evento di calendario (gia' sincronizzato) come importante, per ricevere un promemoria.",
    input_schema: {
      type: "object",
      properties: { externalId: { type: "string" } },
      required: ["externalId"],
    },
  },
  {
    name: "get_portfolio",
    description:
      "Mostra il portafoglio investimenti personale dell'utente (azioni/ETF) con prezzo di mercato aggiornato, valore e plusvalenza. Solo tracciamento: non fornisce consigli di investimento.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_investment_holding",
    description: "Aggiunge un titolo (azione/ETF) al portafoglio investimenti personale dell'utente.",
    input_schema: {
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
    input_schema: {
      type: "object",
      properties: { symbol: { type: "string" } },
      required: ["symbol"],
    },
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

    default:
      return `Tool sconosciuto: ${name}`;
  }
}
