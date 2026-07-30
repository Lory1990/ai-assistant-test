import type { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import type { WebSocket } from "ws";
import { verifyAccessToken } from "../auth/keycloak.js";
import { ensureUserForClaims } from "../auth/bootstrap.js";

const AUTH_TIMEOUT_MS = 5000;

// Connessioni attive raggruppate per team, per il broadcast degli aggiornamenti live.
// In-memory: va bene per un singolo processo (personal project), si perde a un riavvio.
const teamSockets = new Map<string, Set<WebSocket>>();

export interface LiveEvent {
  type: string;
  [key: string]: unknown;
}

/** Notifica tutti i client connessi di un team (es. "qualcosa e' cambiato, ricarica i dati"). */
export function broadcastToTeam(teamId: string, event: LiveEvent): void {
  const sockets = teamSockets.get(teamId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

/**
 * WebSocket per messaggi/aggiornamenti bidirezionali in tempo reale.
 * Il browser non puo' impostare header custom sull'handshake WS, quindi
 * l'autenticazione avviene con il primo messaggio inviato dal client
 * ({type:"auth", token}) invece che via header Authorization: se non arriva
 * entro AUTH_TIMEOUT_MS o il token non e' valido, la connessione si chiude.
 */
export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(websocketPlugin);

  app.get("/ws", { websocket: true }, (socket, _req) => {
    let teamId: string | null = null;

    const authTimeout = setTimeout(() => {
      if (!teamId) socket.close(4001, "Auth timeout");
    }, AUTH_TIMEOUT_MS);

    socket.on("message", async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "auth" && !teamId) {
        try {
          const claims = await verifyAccessToken(msg.token);
          const user = await ensureUserForClaims(claims);
          teamId = user.teamId;
          clearTimeout(authTimeout);

          if (!teamSockets.has(teamId)) teamSockets.set(teamId, new Set());
          teamSockets.get(teamId)!.add(socket);
          socket.send(JSON.stringify({ type: "auth-ok" }));
        } catch {
          socket.send(JSON.stringify({ type: "auth-error", message: "Token non valido o scaduto" }));
          socket.close(4001, "Auth failed");
        }
        return;
      }

      if (msg.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
      }
    });

    socket.on("close", () => {
      clearTimeout(authTimeout);
      if (teamId) teamSockets.get(teamId)?.delete(socket);
    });
  });
}
