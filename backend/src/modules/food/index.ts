import { prisma } from "../../db/client.js";
import { namesMatch } from "../plans/naming.js";
import { getNutritionToday } from "../plans/nutrition.js";
import { lookupCalories } from "./calorieLookup.js";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface LogMealInput {
  userId: string;
  teamId: string;
  description: string;
  grams?: number;
  photoPath?: string;
  /** Se gia' nota (es. da un piano alimentare AI), salta il lookup su DB calorie esterno. */
  calories?: number;
  /** true se e' un pasto pianificato (non ancora mangiato), es. generato da un piano AI. */
  planned?: boolean;
  /** Scheda alimentare e giorno della rotazione che si stava seguendo, se noti. */
  planId?: string | null;
  planDayOrder?: number | null;
}

/**
 * TODO: description/grams qui sono gia' estratti a monte (dal router NLU).
 * In una versione successiva questo modulo potrebbe fare da solo il parsing
 * del testo libero ("150g di pasta al pomodoro") usando l'LLM.
 */
export async function logMeal(input: LogMealInput) {
  const calories = input.calories ?? (await lookupCalories(input.description, input.grams))?.calories;

  const meal = await prisma.meal.create({
    data: {
      userId: input.userId,
      teamId: input.teamId,
      description: input.description,
      grams: input.grams,
      photoPath: input.photoPath,
      calories,
      planned: input.planned ?? false,
      planId: input.planId ?? null,
      planDayOrder: input.planDayOrder ?? null,
    },
  });

  return meal;
}

export interface EatenMealInput {
  description: string;
  grams?: number;
  /** Se l'utente la dice o la si stima da una foto; altrimenti si cerca sul DB calorie. */
  calories?: number;
}

export interface PlannedMealRef {
  id: string;
  description: string;
}

export interface NutritionDayRef {
  order: number;
  name: string;
}

/**
 * Il giorno della scheda alimentare che si sta seguendo oggi non e' deducibile.
 * `suggested` e' quello che toccherebbe secondo la rotazione: un default da
 * proporre, non una risposta.
 */
export interface NutritionDayQuestion {
  planName: string;
  options: NutritionDayRef[];
  suggested: NutritionDayRef | null;
}

export type LogMealResult =
  /** Registrato tra i pasti mangiati di oggi. */
  | {
      status: "eaten";
      meal: Awaited<ReturnType<typeof logMeal>>;
      /** true se e' stato spuntato un pasto che era in programma, invece di aggiungerne uno nuovo. */
      fromPlanned: boolean;
      day: NutritionDayRef | null;
      question: NutritionDayQuestion | null;
    }
  /** Piu' pasti in programma corrispondono a quello che ha detto: va chiesto quale. */
  | { status: "which-planned"; description: string; options: PlannedMealRef[] };

/**
 * "Ho mangiato la pasta al pomodoro" → tra i pasti mangiati di oggi.
 *
 * Se quel piatto era in programma oggi (materializzato dalla scheda alimentare
 * o generato da un piano AI) lo si spunta come mangiato invece di aggiungere
 * una riga nuova: un doppione conterebbe le calorie due volte. Quando i pasti
 * in programma che corrispondono sono piu' d'uno — capita, "pasta" sta sia a
 * pranzo che a cena — non si tira a indovinare e non si registra niente: quel
 * cibo e' gia' contato nella giornata, e chiedere quale spuntare e' meglio che
 * raddoppiarlo. Tutto il resto (un caffe', uno spuntino fuori programma)
 * diventa un pasto nuovo, come prima.
 *
 * Il pasto porta anche scheda e giorno che si stava seguendo, ereditati dagli
 * altri pasti di oggi. Se non si sa a che giorno della rotazione si e' — la
 * scheda c'e' ma la giornata non e' ancora stata materializzata — la domanda
 * torna a chi chiama, come per gli allenamenti: la risposta si salva con
 * setTodayNutritionDay.
 */
export async function logMealEaten(userId: string, teamId: string, input: EatenMealInput): Promise<LogMealResult> {
  const today = startOfToday();
  // I pasti di una giornata nascono tutti insieme, quindi loggedAt da solo non
  // li ordina: l'id spareggia sull'ordine di inserimento, che e' quello degli
  // slot in scheda (colazione, pranzo, cena). Conta perche' questa lista puo'
  // finire sotto gli occhi dell'utente come elenco di scelte.
  const planned = await prisma.meal.findMany({
    where: { userId, planned: true, loggedAt: { gte: today } },
    orderBy: [{ loggedAt: "asc" }, { id: "asc" }],
  });
  const matching = planned.filter((meal) => namesMatch(dishOf(meal.description), input.description));

  if (matching.length > 1) {
    return {
      status: "which-planned",
      description: input.description,
      options: matching.map((meal) => ({ id: meal.id, description: meal.description })),
    };
  }

  if (matching.length === 1) {
    const meal = await markPlannedEaten(matching[0], input);
    return { status: "eaten", meal, fromPlanned: true, day: await describeDay(meal), question: null };
  }

  const attribution = await resolveTodayAttribution(userId, today);
  const meal = await logMeal({
    userId,
    teamId,
    description: input.description,
    grams: input.grams,
    calories: input.calories,
    planId: attribution.planId,
    planDayOrder: attribution.planDayOrder,
  });

  return {
    status: "eaten",
    meal,
    fromPlanned: false,
    day: attribution.day,
    question: attribution.question,
  };
}

/**
 * Registra su quale giorno della scheda alimentare si e' oggi: la risposta alla
 * domanda di logMealEaten. Timbra tutti i pasti di oggi che non ce l'hanno, non
 * solo l'ultimo — il giorno vale per la giornata — ed essendo la timbratura da
 * cui si ricava la rotazione, sistema di conseguenza anche i giorni dopo.
 */
export async function setTodayNutritionDay(
  userId: string,
  dayOrder: number,
): Promise<
  | { ok: true; day: NutritionDayRef; planName: string; updated: number }
  | { ok: false; reason: "no-plan" }
  | { ok: false; reason: "no-day"; planName: string; options: NutritionDayRef[] }
> {
  const today = await getNutritionToday(userId);
  if (!today) return { ok: false, reason: "no-plan" };

  const day = today.plan.days.find((d) => d.order === dayOrder);
  if (!day) {
    return { ok: false, reason: "no-day", planName: today.plan.name, options: today.plan.days.map(toDayRef) };
  }

  const { count } = await prisma.meal.updateMany({
    where: { userId, loggedAt: { gte: startOfToday() }, planDayOrder: null },
    data: { planId: today.plan.id, planDayOrder: day.order },
  });
  return { ok: true, day: toDayRef(day), planName: today.plan.name, updated: count };
}

/** Spunta come mangiato uno dei pasti in programma di oggi, scelto dall'utente. */
export async function markPlannedMealEaten(
  userId: string,
  mealId: string,
  input: EatenMealInput = { description: "" },
): Promise<{ ok: true; meal: Awaited<ReturnType<typeof logMeal>> } | { ok: false; reason: "not-found" }> {
  // L'id arriva dal modello, che potrebbe averlo inventato o ripescato da
  // un'altra chat: va sempre ricontrollato contro i pasti in programma di oggi
  // di *questo* utente.
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId, planned: true, loggedAt: { gte: startOfToday() } },
  });
  if (!meal) return { ok: false, reason: "not-found" };
  return { ok: true, meal: await markPlannedEaten(meal, { ...input, description: meal.description }) };
}

/**
 * Il piatto, senza lo slot davanti. I pasti in programma si chiamano
 * "slot: piatto" ("pranzo: pasta al pomodoro"), sia quelli materializzati da
 * una scheda sia quelli di un piano AI, e per riconoscerli conta il piatto: lo
 * slot e' metadato, ed e' anche la prima parola piena della descrizione.
 * Lasciarlo dentro farebbe combaciare "cena fuori casa" con la cena prevista,
 * qualunque essa fosse.
 */
function dishOf(description: string): string {
  const separator = description.indexOf(":");
  if (separator === -1) return description;
  return description.slice(separator + 1).trim() || description;
}

type MealRow = Awaited<ReturnType<typeof logMeal>>;

/**
 * Da "in programma" a "mangiato", tenendo scheda e giorno che il pasto aveva.
 * `loggedAt` passa all'ora in cui si e' mangiato: i pasti di una scheda nascono
 * tutti insieme quando la giornata viene materializzata, quindi l'ora della
 * materializzazione non dice niente, mentre quella del pasto ordina davvero la
 * giornata (ed e' cio' su cui si aggancia la foto mandata su Telegram).
 */
async function markPlannedEaten(meal: MealRow, input: EatenMealInput): Promise<MealRow> {
  const grams = input.grams ?? meal.grams ?? undefined;
  const calories =
    input.calories ??
    // Se la quantita' mangiata e' diversa da quella prevista le calorie della
    // scheda non valgono piu': si rifanno i conti.
    (input.grams && input.grams !== meal.grams ? (await lookupCalories(meal.description, grams))?.calories : undefined) ??
    meal.calories ??
    undefined;

  return prisma.meal.update({
    where: { id: meal.id },
    data: { planned: false, loggedAt: new Date(), grams, calories },
  });
}

interface TodayAttribution {
  planId: string | null;
  planDayOrder: number | null;
  day: NutritionDayRef | null;
  question: NutritionDayQuestion | null;
}

/**
 * Scheda e giorno da mettere su un pasto nuovo di oggi. Se un pasto di oggi e'
 * gia' attribuito il giorno e' quello, senza chiedere niente; se la scheda ha
 * un giorno solo non c'e' ambiguita'. Altrimenti non si indovina.
 */
async function resolveTodayAttribution(userId: string, today: Date): Promise<TodayAttribution> {
  const attributed = await prisma.meal.findFirst({
    where: { userId, loggedAt: { gte: today }, planDayOrder: { not: null } },
    orderBy: { loggedAt: "asc" },
  });
  if (attributed) {
    return {
      planId: attributed.planId,
      planDayOrder: attributed.planDayOrder,
      day: await describeDay(attributed),
      question: null,
    };
  }

  const nutrition = await getNutritionToday(userId);
  if (!nutrition) return { planId: null, planDayOrder: null, day: null, question: null };

  if (nutrition.plan.days.length === 1) {
    const day = toDayRef(nutrition.plan.days[0]);
    return { planId: nutrition.plan.id, planDayOrder: day.order, day, question: null };
  }

  return {
    planId: null,
    planDayOrder: null,
    day: null,
    question: {
      planName: nutrition.plan.name,
      options: nutrition.plan.days.map(toDayRef),
      suggested: toDayRef(nutrition.day),
    },
  };
}

function toDayRef(day: { order: number; name: string }): NutritionDayRef {
  return { order: day.order, name: day.name };
}

async function describeDay(meal: { planId: string | null; planDayOrder: number | null }): Promise<NutritionDayRef | null> {
  if (!meal.planId || meal.planDayOrder === null) return null;
  const plan = await prisma.nutritionPlan.findUnique({ where: { id: meal.planId } });
  const day = plan?.days.find((d) => d.order === meal.planDayOrder);
  return day ? toDayRef(day) : null;
}

/** Conferma da mandare all'utente, con la domanda sulla scheda quando serve. */
export function formatMealLogResult(result: LogMealResult): string {
  if (result.status === "which-planned") {
    return [
      `"${result.description}" corrisponde a più pasti in programma oggi. Quale hai mangiato?`,
      ...result.options.map((meal, index) => `${index + 1}) ${meal.description} (id: ${meal.id})`),
    ].join("\n");
  }

  const { meal, fromPlanned, day, question } = result;
  const kcal = meal.calories ? ` — ${Math.round(meal.calories)} kcal` : "";
  const lines = [
    fromPlanned
      ? `Spuntato come mangiato dai pasti in programma: ${meal.description}${kcal}`
      : `Pasto registrato: ${meal.description}${kcal}`,
  ];
  if (day) lines[0] += ` (scheda: giorno ${day.order}, ${day.name})`;

  if (question) {
    lines.push(
      `Quale giorno della scheda alimentare "${question.planName}" stai seguendo oggi?`,
      ...question.options.map(
        (option) => `${option.order}) ${option.name}${question.suggested?.order === option.order ? " — il prossimo della rotazione" : ""}`,
      ),
    );
  }

  return lines.join("\n");
}

/**
 * Aggancia una foto al pasto piu' recente dell'utente che non ne ha ancora
 * una, se registrato negli ultimi 2 minuti. Serve quando il pasto viene
 * creato dall'assistente AI (tool call) a partire da una foto Telegram: il
 * tool non conosce il path del file salvato su disco, quindi lo colleghiamo
 * dopo, invece di far gestire anche quello al modello.
 */
export async function attachPhotoToLatestMeal(userId: string, photoPath: string): Promise<boolean> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const meal = await prisma.meal.findFirst({
    where: { userId, photoPath: null, loggedAt: { gte: twoMinutesAgo } },
    orderBy: { loggedAt: "desc" },
  });
  if (!meal) return false;
  await prisma.meal.update({ where: { id: meal.id }, data: { photoPath } });
  return true;
}

/**
 * Pasti di tutto il team (non solo di chi chiama): il tracciamento
 * alimentare e' condiviso tra i membri, come deciso per il concetto di Team.
 * Include sia i pasti gia' mangiati sia quelli pianificati (planned=true).
 */
export async function getTodayMeals(teamId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.meal.findMany({
    where: { teamId, loggedAt: { gte: startOfDay } },
    orderBy: { loggedAt: "asc" },
    include: { user: true },
  });
}
