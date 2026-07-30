import OpenAI from "openai";
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiContentPart,
  AiMessage,
  AiProvider,
  AiToolDefinition,
} from "./types.js";

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function toOpenAiContent(content: string | AiContentPart[]): OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"] {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "text"
      ? ({ type: "text", text: part.text } as const)
      : // OpenAI non accetta il base64 nudo: va passato come data URI.
        ({ type: "image_url", image_url: { url: `data:${part.mediaType};base64,${part.base64}` } } as const),
  );
}

function toOpenAiMessages(request: AiCompletionRequest): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (request.system) messages.push({ role: "system", content: request.system });

  for (const message of request.messages) {
    if (message.role === "user") {
      messages.push({ role: "user", content: toOpenAiContent(message.content) });
      continue;
    }

    if (message.role === "assistant") {
      messages.push({
        role: "assistant",
        // Il content puo' essere null quando il turno e' solo tool call.
        content: message.text || null,
        ...(message.toolCalls.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: JSON.stringify(call.input) },
              })),
            }
          : {}),
      });
      continue;
    }

    // Un messaggio separato con role "tool" per ogni risultato, appaiato per id.
    for (const result of message.results) {
      messages.push({ role: "tool", tool_call_id: result.toolCallId, content: result.content });
    }
  }

  return messages;
}

function toOpenAiTools(tools: AiToolDefinition[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  }));
}

/** Gli argomenti arrivano come stringa JSON: un modello puo' produrne una malformata. */
function parseToolArguments(raw: string, toolName: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error(`Il modello ha prodotto argomenti non validi per il tool ${toolName}: ${raw}`);
  }
}

/**
 * Nei modelli reasoning (gpt-5 e successivi) i token di ragionamento vengono
 * scalati da max_completion_tokens prima che il modello scriva la risposta: con
 * un budget calibrato sul solo output il ragionamento lo esaurisce e la
 * risposta torna vuota con finish_reason "length". maxTokens della richiesta
 * resta quindi il budget della risposta visibile, e qui aggiungiamo lo spazio
 * per il ragionamento (si paga solo quello effettivamente consumato).
 */
const REASONING_HEADROOM_TOKENS = 8000;

/**
 * Provider per i modelli in formato OpenAI (GPT su Azure AI Foundry, o
 * l'API OpenAI diretta).
 */
export function createOpenAiProvider(options: { apiKey: string; baseURL?: string; model: string }): AiProvider {
  const client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL });

  return {
    model: options.model,
    async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
      const response = await client.chat.completions.create({
        model: options.model,
        // I modelli recenti (gpt-5 e successivi) rifiutano max_tokens e
        // vogliono max_completion_tokens.
        max_completion_tokens: request.maxTokens + REASONING_HEADROOM_TOKENS,
        messages: toOpenAiMessages(request),
        ...(request.tools?.length ? { tools: toOpenAiTools(request.tools) } : {}),
        ...(request.forceTool
          ? { tool_choice: { type: "function" as const, function: { name: request.forceTool } } }
          : {}),
      });

      const choice = response.choices[0];
      const message = choice?.message;
      const toolCalls = (message?.tool_calls ?? []).flatMap((call) =>
        // Nel tipo del SDK tool_calls copre anche i custom tool: qui usiamo solo function.
        call.type === "function"
          ? [{ id: call.id, name: call.function.name, input: parseToolArguments(call.function.arguments, call.function.name) }]
          : [],
      );

      const text = (message?.content ?? "").trim();
      // Senza questo controllo un troncamento diventa una risposta vuota, che a
      // monte sembra un rifiuto del modello invece di un budget insufficiente.
      if (choice?.finish_reason === "length" && !text && toolCalls.length === 0) {
        throw new Error(
          `Il modello ${options.model} ha esaurito il budget di token nel ragionamento senza produrre una risposta ` +
            `(${response.usage?.completion_tokens_details?.reasoning_tokens ?? "?"} token di reasoning). ` +
            "Alza maxTokens per questa chiamata.",
        );
      }

      return { text, toolCalls };
    },
  };
}
