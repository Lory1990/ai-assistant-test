import { searchCatalog } from "./appleMusicProvider.js";
import { requestPlayback } from "./alexaCastProvider.js";

export async function playOnAlexa(query: string): Promise<string> {
  const results = await searchCatalog(query);
  if (results.length === 0) return `Nessun brano trovato su Apple Music per "${query}".`;

  const track = results[0];
  try {
    await requestPlayback(track);
    return `In riproduzione: ${track.title} — ${track.artist}`;
  } catch (err) {
    return (err as Error).message;
  }
}
