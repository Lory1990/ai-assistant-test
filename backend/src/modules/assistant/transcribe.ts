import { env } from "../../config/env.js";

/**
 * Trascrive un audio (es. messaggio vocale Telegram, formato ogg/opus) in
 * testo via OpenAI Whisper API. Usato solo per questo: il resto del sistema
 * puo' restare su Anthropic/Azure AI Foundry senza dipendere da OpenAI.
 */
export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY non configurato: impostalo in backend/.env per trascrivere gli audio.");
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openAiApiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trascrizione audio fallita: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { text?: string };
  if (!data.text) throw new Error("Trascrizione audio: risposta senza testo.");
  return data.text;
}
