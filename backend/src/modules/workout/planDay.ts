/**
 * Da un esercizio registrato al giorno di scheda che si sta eseguendo.
 *
 * Logica pura e senza database, tenuta fuori da index.ts perche' e' l'unica
 * parte che decide *se si sa* quale giorno e' in corso: sbagliarla significa
 * attribuire un allenamento al giorno sbagliato (o assillare l'utente con una
 * domanda che non serviva).
 */
import { namesMatch } from "../plans/naming.js";

export interface PlanDayRef {
  order: number;
  name: string;
}

export function toDayRef(day: PlanDayRef): PlanDayRef {
  return { order: day.order, name: day.name };
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
