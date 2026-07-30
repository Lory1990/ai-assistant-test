import { env } from "../../config/env.js";
import { cached } from "../../cache/redis.js";

export interface Quote {
  symbol: string;
  price: number;
}

// Il piano gratuito di Alpha Vantage e' limitato (25 richieste/giorno sul
// tier free attuale): cache aggressiva per non sprecare le chiamate a
// ricaricamenti ravvicinati della dashboard.
const QUOTE_CACHE_TTL_SECONDS = 15 * 60;

/**
 * Prezzo corrente di un titolo/ETF via Alpha Vantage GLOBAL_QUOTE.
 * Richiede una chiave gratuita da https://www.alphavantage.co/support/#api-key.
 */
export async function getQuote(symbol: string): Promise<Quote> {
  if (!env.alphaVantageApiKey) {
    throw new Error("ALPHA_VANTAGE_API_KEY non configurato: impostalo in backend/.env");
  }

  return cached(`investments:quote:${symbol.toUpperCase()}`, QUOTE_CACHE_TTL_SECONDS, async () => {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", env.alphaVantageApiKey!);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Alpha Vantage API error: ${res.status}`);

    const data = (await res.json()) as any;
    const price = Number(data?.["Global Quote"]?.["05. price"]);
    if (!price || Number.isNaN(price)) {
      // Il tier free ritorna {} o un messaggio "Note"/"Information" quando si
      // supera il rate limit, oppure il simbolo non e' valido.
      throw new Error(data?.Note || data?.Information || `Prezzo non disponibile per "${symbol}"`);
    }

    return { symbol: symbol.toUpperCase(), price };
  });
}
