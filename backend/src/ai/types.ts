/**
 * Formato di conversazione neutro rispetto al provider.
 *
 * Serve perche' i due protocolli che usiamo sono incompatibili nei punti che
 * contano per un agent loop: Anthropic mette i tool nel content dei messaggi
 * (tool_use / tool_result), OpenAI li mette in campi separati (tool_calls e
 * messaggi con role "tool"). Tenere lo storico in questa forma e tradurlo
 * nell'adapter significa che l'agent loop non deve sapere quale modello c'e'
 * sotto.
 */

/** Definizione di un tool: `inputSchema` e' un normale JSON Schema. */
export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; base64: string };

export interface AiToolCall {
  /** Id assegnato dal modello: serve ad appaiare la richiesta col risultato. */
  id: string;
  name: string;
  input: unknown;
}

export interface AiToolResult {
  toolCallId: string;
  content: string;
}

export type AiMessage =
  | { role: "user"; content: string | AiContentPart[] }
  | { role: "assistant"; text: string; toolCalls: AiToolCall[] }
  | { role: "tool_results"; results: AiToolResult[] };

export interface AiCompletionRequest {
  system?: string;
  messages: AiMessage[];
  tools?: AiToolDefinition[];
  /** Nome del tool che il modello deve obbligatoriamente chiamare. */
  forceTool?: string;
  maxTokens: number;
}

export interface AiCompletionResult {
  text: string;
  toolCalls: AiToolCall[];
}

export interface AiProvider {
  readonly model: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
