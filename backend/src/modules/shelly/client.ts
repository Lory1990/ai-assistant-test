import { env } from "../../config/env.js";

export interface ShellyDevice {
  id: string;
  name: string;
  online: boolean;
  state?: "on" | "off";
}

/**
 * Client minimo per Shelly Cloud API (https://shelly-api-docs.shelly.cloud/cloud-control-api/).
 * SHELLY_CLOUD_SERVER e' l'host regionale restituito da Shelly dopo il login cloud
 * (es. https://shelly-XX-eu.shelly.cloud), SHELLY_CLOUD_AUTH_KEY e' l'auth key dell'app.
 */
class ShellyCloudClient {
  private get baseUrl() {
    if (!env.shelly.cloudServer) {
      throw new Error("SHELLY_CLOUD_SERVER non configurato");
    }
    return env.shelly.cloudServer;
  }

  private get authKey() {
    if (!env.shelly.authKey) {
      throw new Error("SHELLY_CLOUD_AUTH_KEY non configurato");
    }
    return env.shelly.authKey;
  }

  async listDevices(): Promise<ShellyDevice[]> {
    const res = await fetch(`${this.baseUrl}/device/all_status`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ auth_key: this.authKey }),
    });
    if (!res.ok) {
      throw new Error(`Shelly Cloud API error: ${res.status}`);
    }
    const data = (await res.json()) as any;
    // TODO: la forma esatta della risposta varia per tipo di device (switch, plug, rgbw...):
    // qui va normalizzata in base ai device reali dell'utente.
    return Object.entries(data?.data?.devices_status ?? {}).map(([id, status]: [string, any]) => ({
      id,
      name: status?.name ?? id,
      online: Boolean(status?.online),
      state: status?.relays?.[0]?.ison ? "on" : "off",
    }));
  }

  async setSwitch(deviceId: string, channel: number, on: boolean): Promise<void> {
    const res = await fetch(`${this.baseUrl}/device/relay/control`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        auth_key: this.authKey,
        id: deviceId,
        channel: String(channel),
        turn: on ? "on" : "off",
      }),
    });
    if (!res.ok) {
      throw new Error(`Shelly Cloud API error: ${res.status}`);
    }
  }
}

export const shellyClient = new ShellyCloudClient();
