import dgram from "node:dgram";

/**
 * Invia un pacchetto magico Wake-on-LAN: 6 byte 0xFF seguiti da 16 ripetizioni
 * del MAC address. Il televisore deve avere il Wake-on-LAN/Wake-on-Wireless-LAN
 * attivo nelle impostazioni di rete (spesso disattivato di default).
 */
export function wakeOnLan(mac: string): Promise<void> {
  const macBytes = mac
    .split(/[:-]/)
    .map((b) => parseInt(b, 16));
  if (macBytes.length !== 6 || macBytes.some((b) => Number.isNaN(b))) {
    throw new Error(`MAC address non valido: ${mac}`);
  }

  const magicPacket = Buffer.alloc(6 + 16 * 6, 0xff);
  for (let i = 0; i < 16; i++) {
    Buffer.from(macBytes).copy(magicPacket, 6 + i * 6);
  }

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.once("error", (err) => {
      socket.close();
      reject(err);
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(magicPacket, 9, "255.255.255.255", (err) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}
