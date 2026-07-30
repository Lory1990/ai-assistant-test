import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/plugin.js";
import { getDevices as getShellyDevices, toggleDevice } from "../modules/shelly/index.js";
import { getShutters, openShutter, closeShutter, stopShutter } from "../modules/tahoma/index.js";
import { broadcastToTeam } from "../ws/index.js";

interface ShellyToggleBody {
  deviceId: string;
  on: boolean;
}

interface TahomaCommandBody {
  deviceURL: string;
  command: "open" | "close" | "stop";
}

export function registerHomeRoutes(app: FastifyInstance): void {
  app.get("/api/home/shelly", { preHandler: authenticate }, async (_request, reply) => {
    try {
      return await getShellyDevices();
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  app.post<{ Body: ShellyToggleBody }>("/api/home/shelly/toggle", { preHandler: authenticate }, async (request, reply) => {
    const { deviceId, on } = request.body;
    if (!deviceId || typeof on !== "boolean") {
      return reply.code(400).send({ error: "deviceId e on sono obbligatori" });
    }
    try {
      const message = await toggleDevice(deviceId, on);
      broadcastToTeam(request.currentUser!.teamId, { type: "data-updated", reason: "shelly-toggled" });
      return { message };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  app.get("/api/home/tahoma", { preHandler: authenticate }, async (_request, reply) => {
    try {
      return await getShutters();
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  app.post<{ Body: TahomaCommandBody }>("/api/home/tahoma/command", { preHandler: authenticate }, async (request, reply) => {
    const { deviceURL, command } = request.body;
    if (!deviceURL || !command) {
      return reply.code(400).send({ error: "deviceURL e command sono obbligatori" });
    }
    try {
      const action = { open: openShutter, close: closeShutter, stop: stopShutter }[command];
      if (!action) return reply.code(400).send({ error: `Comando non valido: ${command}` });
      const message = await action(deviceURL);
      broadcastToTeam(request.currentUser!.teamId, { type: "data-updated", reason: "tahoma-command" });
      return { message };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });
}
