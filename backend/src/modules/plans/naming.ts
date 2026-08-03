/**
 * Riconoscere che due nomi parlano della stessa cosa, quando uno arriva da una
 * scheda e l'altro da come una persona lo dice in chat: "rematore" per
 * "Rematore con bilanciere", "pasta al pomodoro" per "pranzo: pasta al
 * pomodoro". Regola condivisa dalla scheda di allenamento e da quella
 * alimentare, come le regole di validita' in validity.ts.
 */

/** Accenti via, punteggiatura via: "Rematore con bilanciere" e "rematore bilanciere" sono la stessa cosa. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Parole che da sole identificano qualcosa: "rematore", "pomodoro" — non "con", "su", "ai". */
function significantWords(normalized: string): string[] {
  return normalized.split(" ").filter((word) => word.length >= 4);
}

/**
 * Basta una parola in comune, oltre al caso banale dei nomi uguali — ma deve
 * essere quella che nomina la cosa, non un contorno. In italiano quella parola
 * apre il nome ("Rematore con bilanciere", "Pasta al pomodoro"), e i prefissi
 * stanno tutti sull'altro lato: lo slot di un pasto in scheda ("pranzo: pasta
 * al pomodoro") o quello che il parser a regex non ha ripulito ("ho fatto di
 * rematore"). Per questo la prima parola piena di *uno dei due* lati basta.
 *
 * Le due strettoie servono entrambe. Un includes secco direbbe che "con" e
 * "curl con manubri" sono la stessa cosa; una parola in comune qualsiasi
 * accomunerebbe "croci ai cavi" e "trazioni ai cavi", che condividono
 * l'attrezzo e nient'altro. Nel dubbio non si riconosce il match e si chiede:
 * attribuire la giornata alla scheda sbagliata, o spuntare il pasto sbagliato,
 * e' peggio di una domanda in piu'.
 */
export function namesMatch(a: string, b: string): boolean {
  const [na, nb] = [normalizeName(a), normalizeName(b)];
  if (!na || !nb) return false;
  if (na === nb) return true;

  const [wordsA, wordsB] = [significantWords(na), significantWords(nb)];
  const shared = wordsA.filter((word) => wordsB.includes(word));
  return shared.includes(wordsA[0]) || shared.includes(wordsB[0]);
}
