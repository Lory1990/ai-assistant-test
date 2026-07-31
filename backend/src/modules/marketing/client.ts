import { getAiProvider } from "../../ai/client.js";
import type { AiToolDefinition } from "../../ai/types.js";

/**
 * Un contenuto come lo propone il modello: la posizione nel periodo e' un
 * numero di giorni piu' un'ora, non una data. Le date le calcola il chiamante
 * (vedi `index.ts`), cosi' il modello non deve fare aritmetica sul calendario —
 * e' il tipo di conto che sbaglia piu' spesso.
 */
export interface GeneratedItem {
  dayOffset: number;
  time: string;
  channel: string;
  format: string;
  title: string;
  copy: string;
  hashtags?: string[];
}

export interface GeneratedPlan {
  name: string;
  items: GeneratedItem[];
}

export interface PlanBrief {
  brief: string;
  audience?: string;
  tone?: string;
  objective?: string;
  channels: string[];
  /** Giorni coperti dal piano: il modello ragiona in offset da 0 a durationDays - 1. */
  durationDays: number;
  itemsPerWeek: number;
}

const SUBMIT_PLAN_TOOL: AiToolDefinition = {
  name: "submit_editorial_plan",
  description: "Invia il piano editoriale generato: un titolo per il piano e l'elenco dei contenuti da pubblicare.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: 'Titolo breve del piano, es. "Lancio corso autunnale".',
      },
      items: {
        type: "array",
        description: "I contenuti del piano, in ordine cronologico.",
        items: {
          type: "object",
          properties: {
            dayOffset: {
              type: "integer",
              description: "Giorni dall'inizio del periodo: 0 e' il primo giorno. Non superare l'ultimo giorno indicato.",
            },
            time: { type: "string", description: 'Ora di pubblicazione in formato "HH:MM", es. "18:30".' },
            channel: { type: "string", description: "Canale su cui pubblicare, scelto tra quelli richiesti." },
            format: { type: "string", description: 'Formato del contenuto, es. "post", "reel", "carosello", "storia", "articolo".' },
            title: { type: "string", description: "Il tema del contenuto, in una riga." },
            copy: { type: "string", description: "Bozza del testo pubblicabile, pronta da rileggere e correggere." },
            hashtags: {
              type: "array",
              items: { type: "string" },
              description: 'Hashtag senza il cancelletto, es. ["fitness", "milano"]. Vuoto per canali che non li usano.',
            },
          },
          required: ["dayOffset", "time", "channel", "format", "title", "copy"],
        },
      },
    },
    required: ["name", "items"],
  },
};

export async function generateEditorialPlan(brief: PlanBrief): Promise<GeneratedPlan> {
  const provider = getAiProvider();

  const weeks = brief.durationDays / 7;
  const targetItems = Math.max(1, Math.round(weeks * brief.itemsPerWeek));

  const contextLines = [
    brief.audience ? `Pubblico: ${brief.audience}` : null,
    brief.tone ? `Tono di voce: ${brief.tone}` : null,
    brief.objective ? `Obiettivo: ${brief.objective}` : null,
    `Canali da usare: ${brief.channels.join(", ")}`,
    `Periodo: ${brief.durationDays} giorni (dayOffset da 0 a ${brief.durationDays - 1})`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const turn = await provider.complete({
    maxTokens: 8000,
    tools: [SUBMIT_PLAN_TOOL],
    forceTool: SUBMIT_PLAN_TOOL.name,
    messages: [
      {
        role: "user",
        content:
          "Sei un social media manager che prepara un piano editoriale, in italiano.\n\n" +
          `${contextLines}\n\n` +
          `Brief: "${brief.brief}"\n\n` +
          `Proponi circa ${targetItems} contenuti distribuiti sul periodo, variando temi e formati e alternando i canali ` +
          "richiesti. Per ogni contenuto scrivi una bozza di testo davvero pubblicabile (non un segnaposto tipo " +
          '"inserire qui il testo") e scegli un giorno e un\'ora plausibili. Usa il tool submit_editorial_plan.',
      },
    ],
  });

  const call = turn.toolCalls.find((c) => c.name === SUBMIT_PLAN_TOOL.name);
  if (!call) {
    throw new Error("Il modello non ha restituito un piano editoriale valido.");
  }

  const plan = call.input as GeneratedPlan;
  if (!Array.isArray(plan.items) || plan.items.length === 0) {
    throw new Error("Il modello ha restituito un piano editoriale senza contenuti.");
  }
  return plan;
}
