import mqtt from "mqtt";
import { env } from "../../config/env.js";
import { wakeOnLan } from "./wol.js";

/**
 * Le TV Hisense con VIDAA OS espongono un broker MQTT locale su TLS (porta
 * 36669 di default) usato dall'app companion per il telecomando remoto.
 * Non e' un protocollo documentato ufficialmente da Hisense: i topic qui
 * sotto ricalcano quanto usato da progetti community di reverse engineering
 * (es. le integrazioni "hisense_tv" per Home Assistant). Su alcuni
 * modelli/firmware i topic o il flusso di pairing potrebbero differire:
 * verificare con uno sniffer MQTT se i comandi non hanno effetto.
 *
 * Flusso:
 * 1. Alla prima connessione la TV mostra un codice PIN a schermo.
 * 2. Va inviato il PIN sul topic di autenticazione per autorizzare il client.
 * 3. Da quel momento si possono inviare tasti remoti (KEY_POWER, KEY_HOME, ...).
 *
 * L'accensione (TV spenta = niente Wi-Fi = niente MQTT) passa invece da
 * Wake-on-LAN, che va abilitato nelle impostazioni di rete della TV.
 */
class HisenseTvClient {
  private client: mqtt.MqttClient | null = null;

  private get baseUrl(): string {
    if (!env.hisenseTv.ip) throw new Error("HISENSE_TV_IP non configurato");
    return `mqtts://${env.hisenseTv.ip}:${env.hisenseTv.mqttPort}`;
  }

  private async connect(): Promise<mqtt.MqttClient> {
    if (this.client?.connected) return this.client;

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(this.baseUrl, {
        rejectUnauthorized: false, // la TV usa un certificato self-signed
        username: "hisenseservice",
        password: "multimqttservice",
        clientId: `personal-ai-assistant-${Date.now()}`,
        connectTimeout: 5000,
      });
      client.once("connect", () => {
        this.client = client;
        resolve(client);
      });
      client.once("error", reject);
    });
  }

  /**
   * Da chiamare una volta manualmente: la TV mostrera' un PIN a schermo,
   * da passare qui per autorizzare il client in modo permanente.
   * TODO: verificare il topic esatto di autenticazione sul proprio modello.
   */
  async authenticateWithPin(pin: string): Promise<void> {
    const client = await this.connect();
    client.publish(
      "/remoteapp/tv/ui_service/authentication",
      JSON.stringify({ authNum: pin }),
    );
  }

  /**
   * Invia un tasto del telecomando virtuale, es. "KEY_POWER", "KEY_HOME",
   * "KEY_VOLUMEUP", "KEY_VOLUMEDOWN", "KEY_MUTE", "KEY_SOURCE".
   */
  async sendKey(key: string): Promise<void> {
    const client = await this.connect();
    client.publish("/remoteapp/tv/remote_service/actions/sendkey", key);
  }

  async powerOnViaWol(): Promise<void> {
    if (!env.hisenseTv.mac) throw new Error("HISENSE_TV_MAC non configurato");
    await wakeOnLan(env.hisenseTv.mac);
  }

  disconnect(): void {
    this.client?.end();
    this.client = null;
  }
}

export const hisenseTvClient = new HisenseTvClient();
