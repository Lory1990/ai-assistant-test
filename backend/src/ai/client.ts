import { env } from "../config/env.js";
import { createAnthropicProvider } from "./anthropicProvider.js";
import { createOpenAiProvider } from "./openAiProvider.js";
import type { AiProvider } from "./types.js";

/**
 * Su Azure AI Foundry i due protocolli vivono su path diversi della stessa
 * risorsa: i modelli Claude sotto /anthropic (protocollo Anthropic nativo,
 * accetta l'header x-api-key dell'SDK), quelli GPT sotto /openai/v1
 * (OpenAI-compatibile, accetta Authorization: Bearer). Nel .env si mette
 * l'endpoint della risorsa come lo mostra il portale: il suffisso lo scegliamo
 * qui in base al modello, perche' e' un dettaglio di protocollo e non una
 * scelta di configurazione.
 */
function foundryBaseUrl(endpoint: string, suffix: "/anthropic" | "/openai/v1"): string {
  const trimmed = endpoint.replace(/\/$/, "");
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`;
}

/** I modelli Claude parlano il protocollo Anthropic, tutto il resto quello OpenAI. */
function usesAnthropicProtocol(model: string): boolean {
  return /claude/i.test(model);
}

/**
 * Provider AI da usare: Azure AI Foundry se configurato, altrimenti l'API
 * diretta di Anthropic. Il protocollo viene dedotto dal nome del modello, cosi'
 * per passare da Claude a GPT (o viceversa) basta cambiare
 * AZURE_AI_FOUNDRY_MODEL, senza toccare codice.
 */
export function getAiProvider(): AiProvider {
  const { endpoint, apiKey, model } = env.azureAiFoundry;
  if (endpoint && apiKey) {
    return usesAnthropicProtocol(model)
      ? createAnthropicProvider({ apiKey, baseURL: foundryBaseUrl(endpoint, "/anthropic"), model })
      : createOpenAiProvider({ apiKey, baseURL: foundryBaseUrl(endpoint, "/openai/v1"), model });
  }

  if (env.openAiChatModel && env.openAiApiKey) {
    return createOpenAiProvider({ apiKey: env.openAiApiKey, model: env.openAiChatModel });
  }

  if (!env.anthropicApiKey) {
    throw new Error(
      "Nessun provider AI configurato: imposta ANTHROPIC_API_KEY, oppure AZURE_AI_FOUNDRY_ENDPOINT + " +
        "AZURE_AI_FOUNDRY_API_KEY + AZURE_AI_FOUNDRY_MODEL in backend/.env.",
    );
  }
  return createAnthropicProvider({ apiKey: env.anthropicApiKey, model: "claude-sonnet-5" });
}
