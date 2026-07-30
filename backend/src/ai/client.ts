import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

export interface AiClient {
  client: Anthropic;
  model: string;
}

/**
 * Su Azure AI Foundry i modelli Claude vivono sotto /anthropic, che parla lo
 * stesso protocollo dell'API Anthropic nativa (e accetta l'header x-api-key
 * che l'SDK manda gia' di suo). Nel .env si mette l'endpoint della risorsa
 * cosi' come lo mostra il portale: il suffisso lo aggiungiamo qui, perche' e'
 * un dettaglio del protocollo, non una scelta di configurazione.
 */
function anthropicBaseUrl(endpoint: string): string {
  const trimmed = endpoint.replace(/\/$/, "");
  return trimmed.endsWith("/anthropic") ? trimmed : `${trimmed}/anthropic`;
}

/**
 * Sceglie il provider AI: Azure AI Foundry se configurato, altrimenti l'API
 * Anthropic diretta.
 *
 * Attenzione: entrambe le strade parlano il protocollo Anthropic, quindi il
 * deployment su Azure deve essere di un modello Claude. Un deployment GPT non
 * e' utilizzabile da qui — richiederebbe un client in formato OpenAI e un
 * agent loop diverso (tool_calls invece di tool_use, altro formato immagini).
 */
export function getAiClient(): AiClient {
  const { endpoint, apiKey, model } = env.azureAiFoundry;
  if (endpoint && apiKey) {
    if (!/claude/i.test(model)) {
      throw new Error(
        `AZURE_AI_FOUNDRY_MODEL="${model}" non sembra un modello Claude. Questo client parla il protocollo ` +
          "Anthropic (/anthropic/v1/messages su Foundry): serve il nome di un deployment Claude, es. " +
          '"claude-sonnet-5". Crea il deployment nel portale Azure AI Foundry (Deployments > Deploy model) ' +
          "e usa qui il nome che gli hai dato.",
      );
    }
    return { client: new Anthropic({ apiKey, baseURL: anthropicBaseUrl(endpoint) }), model };
  }

  if (!env.anthropicApiKey) {
    throw new Error(
      "Nessun provider AI configurato: imposta ANTHROPIC_API_KEY oppure AZURE_AI_FOUNDRY_ENDPOINT + AZURE_AI_FOUNDRY_API_KEY in backend/.env.",
    );
  }
  return { client: new Anthropic({ apiKey: env.anthropicApiKey }), model: "claude-sonnet-5" };
}
