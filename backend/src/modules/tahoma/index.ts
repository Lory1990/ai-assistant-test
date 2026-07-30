import { tahomaClient, type TahomaDevice } from "./client.js";
import { cached, redis } from "../../cache/redis.js";

const LIST_CACHE_TTL_SECONDS = 30;

export async function getShutters(): Promise<TahomaDevice[]> {
  return cached("tahoma:devices", LIST_CACHE_TTL_SECONDS, () => tahomaClient.listDevices());
}

export async function listShutters(): Promise<string> {
  const devices = await getShutters();
  if (devices.length === 0) return "Nessuna serranda trovata.";
  return devices.map((d) => `${d.label} (${d.deviceURL}) — ${d.controllable ? "disponibile" : "non disponibile"}`).join("\n");
}

async function invalidateCache() {
  await redis.del("tahoma:devices").catch(() => {});
}

export async function openShutter(deviceURL: string): Promise<string> {
  await tahomaClient.executeCommand(deviceURL, "open");
  await invalidateCache();
  return `Serranda ${deviceURL} in apertura.`;
}

export async function closeShutter(deviceURL: string): Promise<string> {
  await tahomaClient.executeCommand(deviceURL, "close");
  await invalidateCache();
  return `Serranda ${deviceURL} in chiusura.`;
}

export async function stopShutter(deviceURL: string): Promise<string> {
  await tahomaClient.executeCommand(deviceURL, "stop");
  await invalidateCache();
  return `Serranda ${deviceURL} fermata.`;
}

export async function setShutterPosition(deviceURL: string, percentClosed: number): Promise<string> {
  await tahomaClient.executeCommand(deviceURL, "setClosure", [percentClosed]);
  await invalidateCache();
  return `Serranda ${deviceURL} impostata al ${percentClosed}% di chiusura.`;
}
