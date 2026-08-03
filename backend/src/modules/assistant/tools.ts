import type { AiToolDefinition } from "../../ai/types.js";
import { remember, forgetByContent, listMemories } from "../memory/index.js";
import { getDevices as getShellyDevices, toggleDevice as toggleShellyDevice } from "../shelly/index.js";
import { getShutters, openShutter, closeShutter, stopShutter } from "../tahoma/index.js";
import {
  logMealEaten,
  formatMealLogResult,
  setTodayNutritionDay,
  markPlannedMealEaten,
  getTodayMeals,
} from "../food/index.js";
import { createGoal, listGoals } from "../goals/index.js";
import { logExercise, formatLogResult, setSessionPlanDay, generateRecap } from "../workout/index.js";
import { markEventImportant, getUpcomingImportantEvents } from "../calendar/index.js";
import { listItems, addItems, markItemChecked } from "../shoppingList/index.js";
import { createMealPlan } from "../mealPlan/index.js";
import { addHolding, removeHolding, getPortfolio } from "../investments/index.js";
import { createPlan as createMarketingPlan, listPlans as listMarketingPlans, formatPlanForChat, parseLocalDay } from "../marketing/index.js";
import {
  createProject,
  listProjects,
  createProduct,
  listProducts,
  addProductNote,
  assertProjectAccess,
  assertProductAccess,
} from "../projects/index.js";
import { createTask, updateTask, listTasks, summarizeSchedule } from "../projects/gantt.js";

export interface ToolContext {
  userId: string;
  teamId: string;
}

export const ASSISTANT_TOOLS: AiToolDefinition[] = [
  {
    name: "remember_about_me",
    description:
      "Memorizza un fatto stabile sull'utente (preferenza, vincolo, abitudine, allergia, obiettivo di lungo periodo) " +
      "così da ricordarlo in tutte le conversazioni future. Usalo quando l'utente chiede esplicitamente di ricordare " +
      "qualcosa, o quando emerge un fatto duraturo che cambierebbe le risposte future. Non usarlo per dettagli " +
      "momentanei (cosa ha mangiato oggi, un allenamento singolo): quelli hanno i loro tool.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Il fatto, in una frase breve e autonoma. Es: \"È vegetariano\"." },
        category: {
          type: "string",
          description: 'Ambito, per raggruppare: es. "alimentazione", "allenamento", "preferenze", "salute".',
        },
      },
      required: ["content"],
    },
  },
  {
    name: "forget_about_me",
    description:
      "Dimentica i fatti memorizzati che contengono il testo indicato. Usalo quando l'utente dice che qualcosa " +
      "non è più vero o chiede di dimenticarlo.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Testo contenuto nel fatto da dimenticare." },
      },
      required: ["text"],
    },
  },
  {
    name: "list_what_you_know_about_me",
    description: "Elenca i fatti memorizzati sull'utente.",
    inputSchema: { type: "object", properties: {} },
  },
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
    description:
      "Registra tra i pasti mangiati di oggi qualcosa che l'utente dice di aver mangiato. Estrai tu i campi dalla " +
      'frase (es. "ho mangiato 150g di pasta al pomodoro" → description: "pasta al pomodoro", grams: 150). Se il ' +
      "piatto era tra i pasti in programma di oggi viene spuntato come mangiato, senza aggiungere un doppione. " +
      "Se la risposta chiede quale pasto in programma era, girala all'utente e poi usa mark_planned_meal_eaten; " +
      "se chiede quale giorno della scheda alimentare sta seguendo, usa set_nutrition_plan_day.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: 'Cosa ha mangiato, senza quantità: es. "pasta al pomodoro".' },
        grams: { type: "number", description: "Quantità in grammi, se indicata." },
        calories: {
          type: "number",
          description: "Solo se le calorie sono già note (es. stimate da una foto): altrimenti omettilo, le cerca il sistema.",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "mark_planned_meal_eaten",
    description:
      "Spunta come mangiato uno dei pasti in programma di oggi. Usalo dopo che l'utente ha detto quale dei pasti " +
      "elencati da log_meal aveva mangiato.",
    inputSchema: {
      type: "object",
      properties: {
        mealId: { type: "string", description: "Id del pasto in programma, tra quelli elencati." },
        grams: { type: "number", description: "Quantità effettivamente mangiata, se diversa da quella prevista." },
      },
      required: ["mealId"],
    },
  },
  {
    name: "set_nutrition_plan_day",
    description:
      "Registra quale giorno della scheda alimentare l'utente sta seguendo oggi, e lo applica ai pasti di oggi. " +
      "Usalo dopo che l'utente ha risposto alla domanda su quale giorno sta seguendo, o quando chiede di " +
      "correggerlo. Se dice che oggi mangia fuori scheda non chiamarlo.",
    inputSchema: {
      type: "object",
      properties: {
        dayOrder: { type: "number", description: "Numero del giorno nella rotazione, tra quelli elencati." },
      },
      required: ["dayOrder"],
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
    description:
      "Registra un esercizio appena svolto: apre la sessione di allenamento di oggi se non c'è ancora, " +
      "altrimenti aggiunge l'esercizio a quella già aperta. Estrai tu i campi dalla frase dell'utente " +
      '(es. "ho fatto 10 reps di rematore" → name: "rematore", reps: 10). Se la risposta dice che non si sa ' +
      "quale giorno della scheda si sta eseguendo, chiedilo all'utente mostrandogli i giorni elencati e poi " +
      "salva la sua risposta con set_workout_plan_day.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: 'Nome dell\'esercizio, senza numeri: es. "rematore", "panca piana".' },
        sets: { type: "number", description: "Numero di serie, se indicato." },
        reps: { type: "number", description: "Ripetizioni per serie, se indicato." },
        weightKg: { type: "number", description: "Carico in kg, se indicato." },
        notes: { type: "string", description: "Dettagli detti dall'utente (es. \"a cedimento\"), se ce ne sono." },
      },
      required: ["name"],
    },
  },
  {
    name: "set_workout_plan_day",
    description:
      "Registra quale giorno della scheda l'utente sta eseguendo nella sessione di allenamento di oggi. " +
      "Usalo dopo che l'utente ha risposto alla domanda su quale scheda sta facendo, o quando chiede di " +
      "correggere il giorno. Se l'utente dice che si sta allenando fuori scheda non chiamarlo: la sessione " +
      "resta registrata senza scheda.",
    inputSchema: {
      type: "object",
      properties: {
        dayOrder: { type: "number", description: "Numero del giorno nella rotazione, tra quelli elencati." },
      },
      required: ["dayOrder"],
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
        projectId: {
          type: "string",
          description:
            "Progetto a cui legare il piano, da list_projects. Omettilo per un piano di marketing personale.",
        },
      },
      required: ["brief", "channels", "periodStart", "periodEnd"],
    },
  },
  {
    name: "list_marketing_plans",
    description:
      "Elenca i piani editoriali di marketing con i contenuti previsti. Senza projectId mostra quelli personali, con projectId quelli di un progetto.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string", description: "Id del progetto, da list_projects." } },
    },
  },
  // Dei progetti l'assistente vede il lavoro (progetti, prodotti, Gantt, diario
  // di prodotto) ma non i conti: le voci di ricavo e costo si leggono e si
  // scrivono solo in dashboard, come il portafoglio investimenti e le spese.
  {
    name: "list_projects",
    description:
      "Elenca i progetti, divisi tra quelli del team e quelli personali dell'utente, con stato e numero di prodotti.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_project",
    description: "Crea un progetto, del team (default) o personale.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: 'es. "Corso di pilates online"' },
        description: { type: "string" },
        scope: {
          type: "string",
          enum: ["team", "personal"],
          description: '"team" lo rende visibile a tutta la famiglia, "personal" solo a chi lo crea.',
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_products",
    description: "Elenca i prodotti di un progetto, con stato e avanzamento derivato dal loro Gantt.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string", description: "Id del progetto, da list_projects." } },
      required: ["projectId"],
    },
  },
  {
    name: "create_product",
    description: "Aggiunge un prodotto a un progetto. Il Gantt e il diario del prodotto si riempiono dopo.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Id del progetto, da list_projects." },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["idea", "building", "live", "archived"] },
      },
      required: ["projectId", "name"],
    },
  },
  {
    name: "list_product_tasks",
    description: "Elenca i task del Gantt di un prodotto, con date, avanzamento e a chi sono assegnati.",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string", description: "Id del prodotto, da list_products." } },
      required: ["productId"],
    },
  },
  {
    name: "create_product_task",
    description:
      "Aggiunge un task al Gantt di un prodotto. Non assegna a nessuno: l'assegnazione ai membri si fa in dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Id del prodotto, da list_products." },
        name: { type: "string", description: 'es. "Registrare le lezioni"' },
        startsAt: { type: "string", description: "Primo giorno del task, formato YYYY-MM-DD." },
        endsAt: { type: "string", description: "Ultimo giorno del task, formato YYYY-MM-DD." },
        notes: { type: "string" },
        progress: { type: "number", description: "Percentuale 0-100, default 0." },
        status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] },
      },
      required: ["productId", "name", "startsAt", "endsAt"],
    },
  },
  {
    name: "update_product_task",
    description: "Aggiorna un task del Gantt: avanzamento, stato, nome o date.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Id del task, da list_product_tasks." },
        name: { type: "string" },
        progress: { type: "number", description: "Percentuale 0-100." },
        status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] },
        startsAt: { type: "string", description: "Formato YYYY-MM-DD." },
        endsAt: { type: "string", description: "Formato YYYY-MM-DD." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "add_product_note",
    description:
      "Aggiunge una voce al diario di prodotto: il ragionamento su cosa costruire e perche', distinto dai task del Gantt.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Id del prodotto, da list_products." },
        content: { type: "string" },
        title: { type: "string" },
      },
      required: ["productId", "content"],
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
      const result = await logMealEaten(ctx.userId, ctx.teamId, {
        description: input.description,
        grams: input.grams,
        calories: input.calories,
      });
      const lines = [formatMealLogResult(result)];
      if (result.status === "which-planned") {
        lines.push("Chiedi all'utente quale era e spuntalo con mark_planned_meal_eaten. Non ho registrato niente: quel cibo è già contato tra i pasti in programma di oggi.");
      } else if (result.question) {
        lines.push(
          "Chiedi all'utente quale giorno sta seguendo e salva la risposta con set_nutrition_plan_day. " +
            "Se oggi mangia fuori scheda lascia il pasto così com'è.",
        );
      }
      return lines.join("\n");
    }

    case "mark_planned_meal_eaten": {
      const outcome = await markPlannedMealEaten(ctx.userId, input.mealId, {
        description: "",
        grams: input.grams,
      });
      if (!outcome.ok) return "Quel pasto non è tra i pasti in programma di oggi: rileggi la lista con get_today_meals.";
      const kcal = outcome.meal.calories ? ` — ${Math.round(outcome.meal.calories)} kcal` : "";
      return `Spuntato come mangiato: ${outcome.meal.description}${kcal}`;
    }

    case "set_nutrition_plan_day": {
      const outcome = await setTodayNutritionDay(ctx.userId, input.dayOrder);
      if (outcome.ok) {
        return `Oggi segnato come "${outcome.planName}", giorno ${outcome.day.order} (${outcome.day.name}): aggiornati ${outcome.updated} pasti di oggi.`;
      }
      if (outcome.reason === "no-plan") {
        return "L'utente non ha una scheda alimentare attiva: i pasti restano registrati senza scheda.";
      }
      return `Il giorno ${input.dayOrder} non esiste nella scheda "${outcome.planName}". Giorni disponibili: ${outcome.options
        .map((day) => `${day.order}) ${day.name}`)
        .join(", ")}.`;
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
      const result = await logExercise(ctx.userId, ctx.teamId, {
        name: input.name,
        sets: input.sets,
        reps: input.reps,
        weightKg: input.weightKg,
        notes: input.notes,
      });
      const lines = [formatLogResult(result)];
      if (result.question) {
        lines.push(
          "Chiedi all'utente quale di questi giorni sta eseguendo e salva la risposta con set_workout_plan_day. " +
            "Se si sta allenando fuori scheda lascia la sessione così com'è.",
        );
      }
      return lines.join("\n");
    }

    case "set_workout_plan_day": {
      const outcome = await setSessionPlanDay(ctx.userId, input.dayOrder);
      if (outcome.ok) {
        return `Sessione di oggi segnata come "${outcome.day.planName}", giorno ${outcome.day.order} (${outcome.day.name}).`;
      }
      switch (outcome.reason) {
        case "no-session":
          return "Nessuna sessione di allenamento aperta oggi: registra prima un esercizio con log_workout_exercise.";
        case "no-plan":
          return "L'utente non ha una scheda di allenamento attiva: la sessione resta registrata senza scheda.";
        case "no-day":
          return `Il giorno ${input.dayOrder} non esiste nella scheda "${outcome.planName}". Giorni disponibili: ${outcome.options
            .map((day) => `${day.order}) ${day.name}`)
            .join(", ")}.`;
      }
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
        projectId: input.projectId,
      });
      return `${formatPlanForChat(plan)}\n\nLe bozze sono nella sezione Marketing: da lì si approvano e si programmano.`;
    }

    case "list_marketing_plans": {
      const plans = await listMarketingPlans(ctx.userId, input.projectId);
      if (plans.length === 0) return "Nessun piano editoriale salvato.";
      return plans.map(formatPlanForChat).join("\n\n");
    }

    case "list_projects": {
      const { teamProjects, personalProjects } = await listProjects(ctx.teamId, ctx.userId);
      if (teamProjects.length === 0 && personalProjects.length === 0) return "Nessun progetto.";
      const format = (p: (typeof teamProjects)[number]) =>
        `- ${p.name} (id: ${p.id}, stato: ${p.status}, ${p._count.products} prodotti)`;
      const sections: string[] = [];
      if (teamProjects.length > 0) sections.push(["Progetti del team:", ...teamProjects.map(format)].join("\n"));
      if (personalProjects.length > 0) sections.push(["Progetti personali:", ...personalProjects.map(format)].join("\n"));
      return sections.join("\n\n");
    }

    case "create_project": {
      const project = await createProject({
        userId: ctx.userId,
        teamId: ctx.teamId,
        name: input.name,
        description: input.description,
        scope: input.scope,
      });
      const who = project.scope === "team" ? "visibile a tutto il team" : "personale";
      return `Progetto creato: ${project.name} (${who}, id: ${project.id})`;
    }

    case "list_products": {
      // listProducts non controlla nulla da sola: l'id del progetto arriva dal
      // modello, che potrebbe averlo inventato o ripescato da un'altra chat.
      await assertProjectAccess(ctx.userId, ctx.teamId, input.projectId);
      const products = await listProducts(input.projectId);
      if (products.length === 0) return "Nessun prodotto in questo progetto.";
      return products
        .map((product) => {
          const schedule = summarizeSchedule(product.tasks);
          return `- ${product.name} (id: ${product.id}, stato: ${product.status}, ${schedule.progress}% su ${schedule.taskCount} task)`;
        })
        .join("\n");
    }

    case "create_product": {
      const product = await createProduct(ctx.userId, ctx.teamId, input.projectId, {
        name: input.name,
        description: input.description,
        status: input.status,
      });
      return `Prodotto creato: ${product.name} (id: ${product.id})`;
    }

    case "list_product_tasks": {
      const tasks = await listTasks(ctx.userId, ctx.teamId, input.productId);
      if (tasks.length === 0) return "Nessun task nel Gantt di questo prodotto.";
      return tasks
        .map((task) => {
          const from = task.startsAt.toLocaleDateString("it-IT");
          const to = task.endsAt.toLocaleDateString("it-IT");
          const who = task.assignee ? `, ${task.assignee.displayName ?? task.assignee.email}` : "";
          return `- ${task.name} (id: ${task.id}, ${from} → ${to}, ${task.progress}%, ${task.status}${who})`;
        })
        .join("\n");
    }

    case "create_product_task": {
      const task = await createTask(ctx.userId, ctx.teamId, input.productId, {
        name: input.name,
        notes: input.notes,
        startsAt: parseLocalDay(input.startsAt),
        endsAt: parseLocalDay(input.endsAt, "end"),
        progress: input.progress,
        status: input.status,
      });
      return `Task aggiunto al Gantt: ${task.name} (id: ${task.id})`;
    }

    case "update_product_task": {
      const task = await updateTask(ctx.userId, ctx.teamId, input.taskId, {
        name: input.name,
        progress: input.progress,
        status: input.status,
        startsAt: input.startsAt ? parseLocalDay(input.startsAt) : undefined,
        endsAt: input.endsAt ? parseLocalDay(input.endsAt, "end") : undefined,
      });
      return `Task aggiornato: ${task.name} — ${task.progress}%, ${task.status}`;
    }

    case "add_product_note": {
      const product = await assertProductAccess(ctx.userId, ctx.teamId, input.productId);
      await addProductNote(ctx.userId, ctx.teamId, input.productId, {
        title: input.title,
        content: input.content,
      });
      return `Nota aggiunta al diario di ${product.name}.`;
    }

    case "remember_about_me": {
      const saved = await remember({
        userId: ctx.userId,
        content: input.content,
        category: input.category,
        source: "assistant",
      });
      return `Memorizzato: "${saved.content}". Lo ricorderò anche nelle prossime conversazioni.`;
    }

    case "forget_about_me": {
      const count = await forgetByContent(ctx.userId, input.text);
      return count > 0 ? `Dimenticati ${count} fatti.` : "Non ho trovato nulla del genere da dimenticare.";
    }

    case "list_what_you_know_about_me": {
      const memories = await listMemories(ctx.userId);
      if (memories.length === 0) return "Non ho ancora memorizzato nulla su di te.";
      return memories.map((m) => (m.category ? `- [${m.category}] ${m.content}` : `- ${m.content}`)).join("\n");
    }

    default:
      return `Tool sconosciuto: ${name}`;
  }
}
