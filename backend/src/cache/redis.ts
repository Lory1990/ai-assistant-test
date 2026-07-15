import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

/**
 * Cache-aside helper: ritorna il valore in cache se presente, altrimenti lo
 * calcola con `fetcher`, lo salva con TTL e lo ritorna. Se Redis non e'
 * raggiungibile, ricade silenziosamente su `fetcher` senza cache.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // Redis non disponibile: procedi senza cache.
  }

  const value = await fetcher();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Redis non disponibile: il valore calcolato viene comunque ritornato.
  }

  return value;
}
