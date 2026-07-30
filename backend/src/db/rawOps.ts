import { prisma } from "./client.js";

/**
 * Rimuove del tutto uno o piu' campi da un utente (invece di impostarli a
 * null). Necessario perche' Prisma su MongoDB, quando riceve `campo: null`
 * in una update, scrive un null esplicito nel documento invece di rimuovere
 * la chiave: un null esplicito viene comunque indicizzato (anche con indice
 * sparse, che esclude solo i campi del tutto assenti), quindi basta un
 * secondo utente con quel campo gia' assente per far scattare un conflitto
 * di unicita' spurio (telegramId, keycloakId, telegramLinkCode sono tutti
 * @unique su campi opzionali). Il $unset via comando raw evita il problema.
 */
export async function unsetUserFields(userId: string, fields: string[]): Promise<void> {
  const unset = Object.fromEntries(fields.map((f) => [f, ""]));
  await prisma.$runCommandRaw({
    update: "User",
    updates: [{ q: { _id: { $oid: userId } }, u: { $unset: unset } }],
  });
}
