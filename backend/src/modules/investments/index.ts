import { prisma } from "../../db/client.js";
import { getQuote } from "./client.js";

export async function addHolding(userId: string, symbol: string, quantity: number, costBasis?: number) {
  return prisma.holding.create({
    data: { userId, symbol: symbol.toUpperCase(), quantity, costBasis },
  });
}

export async function listHoldings(userId: string) {
  return prisma.holding.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function removeHolding(userId: string, holdingId: string) {
  return prisma.holding.deleteMany({ where: { id: holdingId, userId } });
}

export interface HoldingWithValue {
  id: string;
  symbol: string;
  quantity: number;
  costBasis: number | null;
  price: number | null;
  value: number | null;
  gainLoss: number | null;
  error?: string;
}

/**
 * Portafoglio con prezzi live: se il lookup di un titolo fallisce (rate limit
 * Alpha Vantage, simbolo non valido, chiave assente) l'holding resta nella
 * lista con l'errore associato invece di far fallire l'intero portafoglio.
 */
export async function getPortfolio(userId: string): Promise<{ holdings: HoldingWithValue[]; totalValue: number }> {
  const holdings = await listHoldings(userId);

  const withValues = await Promise.all(
    holdings.map(async (h): Promise<HoldingWithValue> => {
      try {
        const quote = await getQuote(h.symbol);
        const value = quote.price * h.quantity;
        const gainLoss = h.costBasis != null ? (quote.price - h.costBasis) * h.quantity : null;
        return { id: h.id, symbol: h.symbol, quantity: h.quantity, costBasis: h.costBasis, price: quote.price, value, gainLoss };
      } catch (err) {
        return {
          id: h.id,
          symbol: h.symbol,
          quantity: h.quantity,
          costBasis: h.costBasis,
          price: null,
          value: null,
          gainLoss: null,
          error: (err as Error).message,
        };
      }
    }),
  );

  const totalValue = withValues.reduce((sum, h) => sum + (h.value ?? 0), 0);
  return { holdings: withValues, totalValue };
}
