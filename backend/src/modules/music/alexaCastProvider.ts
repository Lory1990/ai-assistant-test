import type { MusicTrack } from "./types.js";

/**
 * "Far partire un brano su Alexa da un bot" NON ha un'API pubblica e supportata
 * pensata per questo caso d'uso da singolo utente. Le due strade reali sono:
 *
 * 1) Music Skill API di Amazon (ufficiale): pensata per servizi di streaming
 *    che vogliono integrarsi nativamente con "Alexa, play X on <servizio>".
 *    Richiede di registrare una skill "Music" e passare la certificazione
 *    Amazon come provider musicale — pensata per aziende come Spotify/Apple
 *    Music stesse, non per un progetto personale. Complessita' alta, spesso
 *    non accessibile a un singolo sviluppatore indipendente.
 *
 * 2) Alexa Routines/Notifications via account personale (non ufficiale):
 *    librerie come `alexa-remote2` si autenticano con le stesse credenziali
 *    Amazon dell'utente (cookie di sessione, non OAuth) e replicano le
 *    chiamate usate dall'app Alexa per lanciare routine o comandi vocali
 *    simulati. Funziona per uso personale ma non e' un'API ufficiale, puo'
 *    rompersi con aggiornamenti Amazon e va verificato contro i Termini di
 *    Servizio Amazon prima di usarla.
 *
 * In entrambi i casi, se l'utente ha gia' collegato Apple Music come servizio
 * musicale di default in Alexa, il modo piu' semplice e robusto resta dire
 * direttamente "Alexa, riproduci <brano> da Apple Music" a voce: questo modulo
 * quindi si limita a cercare il brano (via Apple Music) e restituire un
 * riferimento chiaro, lasciando esplicito che l'invio del comando ad Alexa
 * va implementato con una delle due strade sopra una volta scelta.
 */
export async function requestPlayback(track: MusicTrack): Promise<never> {
  throw new Error(
    `Riproduzione su Alexa non ancora configurata. Brano trovato: "${track.title}" di ${track.artist}. ` +
      "Vedi i commenti in src/modules/music/alexaCastProvider.ts per le opzioni di integrazione reali.",
  );
}
