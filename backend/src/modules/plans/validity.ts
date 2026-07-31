/**
 * Regole di validita' condivise da schede di allenamento e schede alimentari.
 *
 * Per uno stesso utente e uno stesso tipo di scheda ne vale una sola per
 * volta: le finestre [validFrom, validTo] non si sovrappongono mai. MongoDB
 * non sa esprimere questo vincolo, quindi vive qui ed e' l'unico posto che
 * lo decide — sia in creazione che in modifica.
 */

export class PlanOverlapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanOverlapError";
  }
}

export interface ValidityWindow {
  id: string;
  name: string;
  validFrom: Date;
  validTo: Date | null;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("it-IT");
}

function windowsOverlap(a: ValidityWindow, from: Date, to: Date | null): boolean {
  // validTo null = aperta: nessun limite superiore.
  const aEnds = a.validTo?.getTime() ?? Infinity;
  const bEnds = to?.getTime() ?? Infinity;
  return a.validFrom.getTime() <= bEnds && from.getTime() <= aEnds;
}

export interface WindowResolution {
  /** Estremi normalizzati: la validita' si ragiona a giornate intere. */
  validFrom: Date;
  validTo: Date | null;
  /** Schede aperte da chiudere prima di inserire la nuova, con la loro nuova fine. */
  toClose: { id: string; validTo: Date }[];
}

/**
 * Verifica che una finestra sia inseribile e prepara le chiusure necessarie.
 *
 * Una scheda aperta ("fino a nuovo ordine") che e' cominciata prima non e' un
 * conflitto: e' semplicemente quella che la nuova sostituisce, e viene chiusa
 * al giorno prima. Qualsiasi altra sovrapposizione e' un errore, perche'
 * accorciare o spezzare una scheda con date esplicite significherebbe
 * indovinare cosa voleva l'utente.
 *
 * `excludeId` serve in modifica: una scheda non si sovrappone a se stessa.
 */
export function resolveWindow(
  existing: ValidityWindow[],
  rawValidFrom: Date,
  rawValidTo: Date | null,
  excludeId?: string,
): WindowResolution {
  const validFrom = startOfDay(rawValidFrom);
  const validTo = rawValidTo ? endOfDay(rawValidTo) : null;

  if (validTo && validTo < validFrom) {
    throw new PlanOverlapError("La data di fine non può precedere quella di inizio.");
  }

  const toClose: { id: string; validTo: Date }[] = [];

  for (const plan of existing) {
    if (plan.id === excludeId) continue;
    if (!windowsOverlap(plan, validFrom, validTo)) continue;

    if (plan.validTo === null && plan.validFrom < validFrom) {
      const closesAt = endOfDay(new Date(validFrom.getTime() - 24 * 60 * 60 * 1000));
      toClose.push({ id: plan.id, validTo: closesAt });
      continue;
    }

    const range = plan.validTo
      ? `${formatDay(plan.validFrom)} → ${formatDay(plan.validTo)}`
      : `dal ${formatDay(plan.validFrom)}, aperta`;
    throw new PlanOverlapError(
      `Il periodo si sovrappone alla scheda "${plan.name}" (${range}). Chiudila o sposta le date: può esserci una sola scheda attiva per volta.`,
    );
  }

  return { validFrom, validTo, toClose };
}

/**
 * Normalizza i giorni di una scheda: l'ordine e' la posizione nell'array, non
 * un campo che chi chiama deve tenere coerente. Rinumerando 1..N a ogni
 * salvataggio, riordinare i giorni e' un'operazione che non puo' produrre
 * buchi o duplicati.
 */
export function withOrder<T>(days: T[]): (T & { order: number })[] {
  return days.map((day, index) => ({ ...day, order: index + 1 }));
}

/**
 * Il giorno della rotazione da fare oggi, dato l'ultimo registrato.
 *
 * `lastOrder` null (mai allenato con questa scheda) parte dal primo giorno.
 * Il modulo sul numero di giorni copre anche il caso di una scheda accorciata
 * dopo che si era gia' arrivati a un giorno che ora non esiste piu'.
 */
export function nextDayOrder(lastOrder: number | null, dayCount: number): number {
  if (dayCount === 0) return 1;
  if (lastOrder === null) return 1;
  return (lastOrder % dayCount) + 1;
}
