import { prisma } from "./client.js";

/**
 * Prisma su MongoDB non supporta indici "sparse" dallo schema (`@unique` su
 * un campo opzionale genera comunque un indice unique pieno): con piu' di un
 * documento che non valorizza il campo, MongoDB tratta i valori assenti come
 * "null" duplicati e la seconda insert fallisce con E11000. Dato che
 * telegramId/keycloakId/telegramLinkCode su User sono legittimamente assenti
 * per molti utenti contemporaneamente (utente solo-Telegram, utente solo-web,
 * nessun link attivo), ricreiamo questi indici come sparse ad ogni avvio.
 */
const SPARSE_UNIQUE_FIELDS = ["telegramId", "keycloakId", "telegramLinkCode"] as const;

export async function ensureSparseUniqueIndexes(): Promise<void> {
  for (const field of SPARSE_UNIQUE_FIELDS) {
    const indexName = `User_${field}_key`;
    try {
      await prisma.$runCommandRaw({ dropIndexes: "User", index: indexName });
    } catch {
      // indice assente o gia' nella forma attesa: si prosegue comunque con la createIndexes.
    }
    await prisma.$runCommandRaw({
      createIndexes: "User",
      indexes: [{ key: { [field]: 1 }, name: indexName, unique: true, sparse: true }],
    });
  }
}
