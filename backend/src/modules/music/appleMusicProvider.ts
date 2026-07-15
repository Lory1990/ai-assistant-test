import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { MusicTrack } from "./types.js";

/**
 * Apple Music API (catalogo) — funziona solo con un "developer token": un JWT
 * ES256 firmato con una chiave privata scaricata dall'Apple Developer Portal
 * (MusicKit identifier). Serve un account Apple Developer (99$/anno).
 * Questo copre SOLO la ricerca nel catalogo, non la riproduzione: per far
 * "suonare" davvero un brano su un dispositivo serve MusicKit JS/nativo in
 * esecuzione lato client con anche uno "music-user-token" ottenuto tramite
 * il login dell'utente — non e' qualcosa che un backend headless puo' fare da solo.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

function getDeveloperToken(): string {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  if (!env.appleMusic.teamId || !env.appleMusic.keyId || !env.appleMusic.privateKeyPath) {
    throw new Error(
      "Apple Music non configurato: servono APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, APPLE_MUSIC_PRIVATE_KEY_PATH " +
        "(chiave .p8 scaricata da developer.apple.com/account/resources/authkeys)",
    );
  }

  const privateKey = readFileSync(env.appleMusic.privateKeyPath, "utf-8");
  const expiresInSeconds = 60 * 60 * 12; // max consentito da Apple: 6 mesi, qui piu' prudente

  const token = jwt.sign({}, privateKey, {
    algorithm: "ES256",
    expiresIn: expiresInSeconds,
    issuer: env.appleMusic.teamId,
    header: { alg: "ES256", kid: env.appleMusic.keyId },
  });

  cachedToken = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
  return token;
}

export async function searchCatalog(query: string, storefront = "it"): Promise<MusicTrack[]> {
  const token = getDeveloperToken();
  const res = await fetch(
    `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(query)}&types=songs&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Apple Music API error: ${res.status}`);

  const data = (await res.json()) as any;
  const songs = data?.results?.songs?.data ?? [];
  return songs.map((s: any) => ({
    id: s.id,
    title: s.attributes?.name,
    artist: s.attributes?.artistName,
    appleMusicUrl: s.attributes?.url,
  }));
}
