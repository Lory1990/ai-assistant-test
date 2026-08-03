import { getAiProvider } from "../../ai/client.js";
import type { AiContentPart, AiMessage, AiToolResult } from "../../ai/types.js";
import { ASSISTANT_TOOLS, executeTool, type ToolContext } from "./tools.js";
import { getMemoryForPrompt } from "../memory/index.js";

export interface ChatMessage {
  role: "user" | "assistant";
  // Stringa per i messaggi testuali (web/bot); array di content part quando il
  // bot Telegram inoltra una foto da analizzare.
  content: string | AiContentPart[];
}

export interface ToolCallLog {
  name: string;
  input: unknown;
  result: string;
}

const SYSTEM_PROMPT =
  "Sei l'assistente digitale di una famiglia, integrato in una dashboard web e in un bot Telegram. " +
  "Rispondi sempre in italiano, in modo conciso. Usa i tool a disposizione per eseguire azioni reali " +
  "(accendere luci, registrare pasti/allenamenti, creare obiettivi, ecc.) o per recuperare dati aggiornati " +
  "(stato dei device, pasti di oggi, obiettivi attivi...): non inventare mai stati o dati che un tool potrebbe fornirti. " +
  "Se l'utente chiede qualcosa di ambiguo, chiedi un chiarimento invece di indovinare un'azione irreversibile. " +
  "Quando l'utente dice di aver fatto un esercizio registralo subito con log_workout_exercise: la sessione di oggi " +
  "viene aperta o aggiornata da sola. Quando dice di aver mangiato qualcosa registralo subito con log_meal, che lo " +
  "mette tra i pasti mangiati di oggi. In entrambi i casi, se il tool risponde che non sa a quale giorno di scheda " +
  "(di allenamento o alimentare) si riferisce, o quale pasto in programma era, chiedilo all'utente elencandogli le " +
  "possibilità e poi salva la risposta col tool che il messaggio indica. " +
  "Quando l'utente ti dice qualcosa di stabile su di sé (preferenze, vincoli, allergie, abitudini) memorizzalo con " +
  "remember_about_me, così lo ricorderai anche nelle prossime conversazioni.";

/** I fatti memorizzati vanno in coda al prompt: valgono per tutte le conversazioni di quella persona. */
function buildSystemPrompt(memory: string): string {
  if (!memory) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\nQuello che sai già di questa persona:\n${memory}`;
}

const MAX_TOOL_ITERATIONS = 6;

/**
 * Loop agentico con tool-use: chiama il modello, se richiede tool li esegue
 * davvero (scoped sull'utente/team autenticato) e ripete finche' il modello
 * non produce una risposta testuale finale o si raggiunge il limite di giri.
 *
 * Lavora sul formato di conversazione neutro, quindi funziona identico con un
 * modello Claude o GPT: la traduzione di protocollo sta nell'adapter.
 */
export async function chat(ctx: ToolContext, history: ChatMessage[]): Promise<{ reply: string; toolCalls: ToolCallLog[] }> {
  const provider = getAiProvider();
  const toolCalls: ToolCallLog[] = [];
  const system = buildSystemPrompt(await getMemoryForPrompt(ctx.userId));

  const messages: AiMessage[] = history.map((m) =>
    m.role === "user" ? { role: "user", content: m.content } : { role: "assistant", text: asText(m.content), toolCalls: [] },
  );

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const turn = await provider.complete({
      system,
      tools: ASSISTANT_TOOLS,
      maxTokens: 1500,
      messages,
    });

    if (turn.toolCalls.length === 0) {
      return { reply: turn.text || "Fatto.", toolCalls };
    }

    messages.push({ role: "assistant", text: turn.text, toolCalls: turn.toolCalls });

    const results: AiToolResult[] = [];
    for (const call of turn.toolCalls) {
      let result: string;
      try {
        result = await executeTool(call.name, call.input, ctx);
      } catch (err) {
        result = `Errore: ${(err as Error).message}`;
      }
      toolCalls.push({ name: call.name, input: call.input, result });
      results.push({ toolCallId: call.id, content: result });
    }

    messages.push({ role: "tool_results", results });
  }

  return {
    reply: "Non sono riuscito a completare la richiesta in un numero ragionevole di passaggi: puoi riformularla in modo più semplice?",
    toolCalls,
  };
}

/** Lo storico di un assistente contiene solo testo: le immagini le manda l'utente. */
function asText(content: string | AiContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is Extract<AiContentPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
