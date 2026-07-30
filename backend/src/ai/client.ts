import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

export interface AiClient {
  client: Anthropic;
  model: string;
}

/**
 * Sceglie il provider AI: Azure AI Foundry (modelli Claude via endpoint Azure)
 * se configurato, altrimenti l'API Anthropic diretta. Entrambi espongono lo
 * stesso formato di richiesta, quindi basta cambiare baseURL/apiKey.
 */
export function getAiClient(): AiClient {
  const { endpoint, apiKey, model } = env.azureAiFoundry;
  if (endpoint && apiKey) {
    return { client: new Anthropic({ apiKey, baseURL: endpoint }), model };
  }

  if (!env.anthropicApiKey) {
    throw new Error(
      "Nessun provider AI configurato: imposta ANTHROPIC_API_KEY oppure AZURE_AI_FOUNDRY_ENDPOINT + AZURE_AI_FOUNDRY_API_KEY in backend/.env.",
    );
  }
  return { client: new Anthropic({ apiKey: env.anthropicApiKey }), model: "claude-sonnet-5" };
}
