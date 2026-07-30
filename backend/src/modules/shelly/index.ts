import { shellyClient, type ShellyDevice } from "./client.js";
import { cached, redis } from "../../cache/redis.js";

const LIST_CACHE_TTL_SECONDS = 30;

export async function getDevices(): Promise<ShellyDevice[]> {
  return cached("shelly:devices", LIST_CACHE_TTL_SECONDS, () => shellyClient.listDevices());
}

export async function listDevicesForUser(): Promise<string> {
  const devices = await getDevices();
  if (devices.length === 0) return "Nessun device Shelly trovato.";
  return devices
    .map((d) => `${d.name} (${d.id}) — ${d.online ? "online" : "offline"} — ${d.state ?? "?"}`)
    .join("\n");
}

export async function toggleDevice(deviceId: string, on: boolean): Promise<string> {
  await shellyClient.setSwitch(deviceId, 0, on);
  await redis.del("shelly:devices").catch(() => {});
  return `Device ${deviceId} impostato su ${on ? "ON" : "OFF"}.`;
}
