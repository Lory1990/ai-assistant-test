/**
 * Da un esercizio registrato al giorno di scheda che si sta eseguendo.
 *
 * Logica pura e senza database, tenuta fuori da index.ts perche' e' l'unica
 * parte che decide *se si sa* quale giorno e' in corso: sbagliarla significa
 * attribuire un allenamento al giorno sbagliato (o assillare l'utente con una
 * domanda che non serviva).
 */

export interface PlanDayRef {
  order: number;
  name: string;
}

export function toDayRef(day: PlanDayRef): PlanDayRef {
  return { order: day.order, name: day.name };
}

/** Accenti via, punteggiatura via: "Rematore con bilanciere" e "rematore bilanciere" sono la stessa cosa. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Parole che da sole identificano un esercizio: "rematore", "panca" — non "con", "su", "ai". */
function significantWords(normalized: string): string[] {
  return normalized.split(" ").filter((word) => word.length >= 4);
}

/**
 * Il nome scritto in chat non e' quello della scheda: "rematore" sta per
 * "rematore con bilanciere", e il parser a regex puo' lasciare dentro pezzi di
 * frase ("ho fatto di rematore"). Basta quindi una parola in comune, oltre al
 * caso banale dei nomi uguali — ma deve essere quella che nomina il movimento.
 *
 * Le due strettoie servono entrambe. Un includes secco direbbe che "con" e
 * "curl con manubri" sono lo stesso esercizio; una parola in comune qualsiasi
 * accomunerebbe "croci ai cavi" e "trazioni ai cavi", che condividono
 * l'attrezzo e nient'altro. Nel dubbio non si riconosce il match e si chiede:
 * attribuire l'allenamento al giorno sbagliato e' peggio di una domanda in piu'.
 */
export function namesMatch(a: string, b: string): boolean {
  const [na, nb] = [normalizeName(a), normalizeName(b)];
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [wordsA, wordsB] = [significantWords(na), significantWords(nb)];
  const shared = wordsA.filter((word) => wordsB.includes(word));
  // In italiano il movimento apre il nome ("Rematore con bilanciere", "Croci ai
  // cavi"), quindi la prima parola piena di uno dei due lati e' quella che deve
  // combaciare. "ho fatto di rematore" ci arriva dall'altro lato: la prima
  // parola piena della scheda e' "rematore", e tanto basta.
  return shared.includes(wordsA[0]) || shared.includes(wordsB[0]);
}

export interface PlanDayLike extends PlanDayRef {
  exercises: { name: string }[];
}

/** I giorni della scheda che prevedono un esercizio con questo nome. */
export function daysMatchingExercise<T extends PlanDayLike>(days: T[], exerciseName: string): T[] {
  return days.filter((day) => day.exercises.some((planned) => namesMatch(planned.name, exerciseName)));
}

export interface DayResolution<T extends PlanDayLike> {
  /** Il giorno in corso, quando si sa davvero quale sia. */
  day: T | null;
  /**
   * I giorni tra cui far scegliere l'utente, quando non si sa: quelli
   * compatibili con l'esercizio se sono piu' d'uno, altrimenti tutta la scheda
   * (l'esercizio non e' in scheda, quindi non restringe niente).
   */
  options: PlanDayRef[];
}

/**
 * Un solo giorno compatibile con l'esercizio, oppure una scheda con un solo
 * giorno: in questi due casi il giorno e' determinato e non c'e' niente da
 * chiedere. In tutti gli altri si sceglie di non indovinare.
 */
export function resolveDay<T extends PlanDayLike>(days: T[], exerciseName: string): DayResolution<T> {
  if (days.length === 1) return { day: days[0], options: [] };

  const candidates = daysMatchingExercise(days, exerciseName);
  if (candidates.length === 1) return { day: candidates[0], options: [] };

  return { day: null, options: (candidates.length > 1 ? candidates : days).map(toDayRef) };
}
