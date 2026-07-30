import Anthropic from "@anthropic-ai/sdk";
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiContentPart,
  AiMessage,
  AiProvider,
  AiToolDefinition,
} from "./types.js";

function toAnthropicContent(content: string | AiContentPart[]): Anthropic.MessageParam["content"] {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "text"
      ? ({ type: "text", text: part.text } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: part.mediaType as "image/jpeg", data: part.base64 },
        } as const),
  );
}

function toAnthropicMessages(messages: AiMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => {
    if (message.role === "user") {
      return { role: "user", content: toAnthropicContent(message.content) };
    }

    if (message.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (message.text) blocks.push({ type: "text", text: message.text });
      for (const call of message.toolCalls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      return { role: "assistant", content: blocks };
    }

    // I tool_result viaggiano come messaggio dell'utente: e' cosi' che il
    // protocollo Anthropic li rappresenta.
    return {
      role: "user",
      content: message.results.map((result) => ({
        type: "tool_result" as const,
        tool_use_id: result.toolCallId,
        content: result.content,
      })),
    };
  });
}

function toAnthropicTools(tools: AiToolDefinition[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

export function createAnthropicProvider(options: { apiKey: string; baseURL?: string; model: string }): AiProvider {
  const client = new Anthropic({ apiKey: options.apiKey, baseURL: options.baseURL });

  return {
    model: options.model,
    async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
      const response = await client.messages.create({
        model: options.model,
        max_tokens: request.maxTokens,
        ...(request.system ? { system: request.system } : {}),
        ...(request.tools?.length ? { tools: toAnthropicTools(request.tools) } : {}),
        ...(request.forceTool ? { tool_choice: { type: "tool" as const, name: request.forceTool } } : {}),
        messages: toAnthropicMessages(request.messages),
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      const toolCalls = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
        .map((block) => ({ id: block.id, name: block.name, input: block.input }));

      return { text, toolCalls };
    },
  };
}
