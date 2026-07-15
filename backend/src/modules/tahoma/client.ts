import { env } from "../../config/env.js";

export interface TahomaDevice {
  deviceURL: string;
  label: string;
  controllable: boolean;
}

/**
 * Client per Overkiz Cloud API (il backend cloud dietro Somfy TaHoma).
 * A differenza di Shelly, l'autenticazione e' a sessione (cookie JSESSIONID),
 * non a bearer token: va rifatto il login quando la sessione scade (~8 min
 * di inattivita'). OVERKIZ_SERVER va scelto in base al server assegnato
 * all'account (es. https://ha101-1.overkiz.com/enduser-mobile-web/enduserAPI):
 * si trova nella risposta dell'app TaHoma o via il servizio di discovery Somfy.
 */
class OverkizClient {
  private sessionCookie: string | null = null;

  private get baseUrl() {
    if (!env.overkiz.server) throw new Error("OVERKIZ_SERVER non configurato");
    return env.overkiz.server;
  }

  private async login(): Promise<void> {
    if (!env.overkiz.username || !env.overkiz.password) {
      throw new Error("OVERKIZ_USERNAME/OVERKIZ_PASSWORD non configurati");
    }
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ userId: env.overkiz.username, userPassword: env.overkiz.password }),
    });
    if (!res.ok) throw new Error(`Overkiz login fallito: ${res.status}`);

    const setCookie = res.headers.get("set-cookie");
    const match = setCookie?.match(/JSESSIONID=[^;]+/);
    if (!match) throw new Error("Overkiz login: cookie di sessione non trovato nella risposta");
    this.sessionCookie = match[0];
  }

  private async request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    if (!this.sessionCookie) await this.login();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, Cookie: this.sessionCookie! },
    });

    if (res.status === 401 && retry) {
      this.sessionCookie = null;
      return this.request(path, init, false);
    }
    return res;
  }

  async listDevices(): Promise<TahomaDevice[]> {
    const res = await this.request("/setup/devices");
    if (!res.ok) throw new Error(`Overkiz API error: ${res.status}`);
    const data = (await res.json()) as any[];
    return data.map((d) => ({
      deviceURL: d.deviceURL,
      label: d.label,
      controllable: d.available !== false,
    }));
  }

  /**
   * command: "open" | "close" | "stop" | "setClosure" (con parametri es. [50] per il 50%)
   */
  async executeCommand(deviceURL: string, command: string, parameters: unknown[] = []): Promise<void> {
    const res = await this.request("/exec/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Personal AI Assistant",
        actions: [{ deviceURL, commands: [{ name: command, parameters }] }],
      }),
    });
    if (!res.ok) throw new Error(`Overkiz API error: ${res.status}`);
  }
}

export const tahomaClient = new OverkizClient();
