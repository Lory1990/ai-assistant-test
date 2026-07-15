import { hisenseTvClient } from "./client.js";

const KEY_ALIASES: Record<string, string> = {
  accendi: "KEY_POWER",
  spegni: "KEY_POWER",
  home: "KEY_HOME",
  volsu: "KEY_VOLUMEUP",
  volgiu: "KEY_VOLUMEDOWN",
  muto: "KEY_MUTE",
  sorgente: "KEY_SOURCE",
  su: "KEY_UP",
  giu: "KEY_DOWN",
  sinistra: "KEY_LEFT",
  destra: "KEY_RIGHT",
  ok: "KEY_OK",
  indietro: "KEY_BACK",
};

export async function turnOnTv(): Promise<string> {
  await hisenseTvClient.powerOnViaWol();
  return "Segnale di accensione (Wake-on-LAN) inviato alla TV.";
}

export async function sendTvCommand(commandText: string): Promise<string> {
  const key = KEY_ALIASES[commandText.toLowerCase().trim()];
  if (!key) {
    return `Comando non riconosciuto. Disponibili: ${Object.keys(KEY_ALIASES).join(", ")}`;
  }
  await hisenseTvClient.sendKey(key);
  return `Comando inviato: ${commandText}`;
}

export async function pairTv(pin: string): Promise<string> {
  await hisenseTvClient.authenticateWithPin(pin);
  return "PIN inviato alla TV per l'autorizzazione.";
}
