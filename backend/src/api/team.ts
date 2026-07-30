import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { unsetUserFields } from "../db/rawOps.js";
import { authenticate } from "../auth/plugin.js";
import { generateCode } from "../utils/code.js";
import { getTodayMeals } from "../modules/food/index.js";
import { createGoal, listGoals } from "../modules/goals/index.js";
import { getUpcomingImportantEvents } from "../modules/calendar/index.js";
import { getSessionsSince, generateRecap, logExerciseFromText } from "../modules/workout/index.js";
import { listItems } from "../modules/shoppingList/index.js";
import { broadcastToTeam } from "../ws/index.js";

const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export function registerTeamRoutes(app: FastifyInstance): void {
  app.get("/api/me", { preHandler: authenticate }, async (request) => {
    const user = request.currentUser!;
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      telegramLinked: Boolean(user.telegramId),
      team: { id: user.team.id, name: user.team.name },
    };
  });

  app.get("/api/team/summary", { preHandler: authenticate }, async (request) => {
    const { teamId, id: userId } = request.currentUser!;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [meals, { teamGoals, personalGoals }, events, workoutSessions, shoppingList] = await Promise.all([
      getTodayMeals(teamId),
      listGoals(teamId, userId),
      getUpcomingImportantEvents(teamId),
      getSessionsSince(teamId, sevenDaysAgo),
      listItems(teamId),
    ]);

    const eatenMeals = meals.filter((m) => !m.planned);
    const plannedMeals = meals.filter((m) => m.planned);
    const totalCaloriesEatenToday = eatenMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
    const totalCaloriesPlannedToday = plannedMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);

    return {
      team: request.currentUser!.team,
      meals: meals.map((m) => ({
        id: m.id,
        description: m.description,
        grams: m.grams,
        calories: m.calories,
        loggedAt: m.loggedAt,
        loggedBy: m.user.displayName ?? m.user.telegramId,
        planned: m.planned,
      })),
      totalCaloriesEatenToday,
      totalCaloriesPlannedToday,
      teamGoals: teamGoals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        category: g.category,
        dueDate: g.dueDate,
        priority: g.priority,
        important: g.important,
        createdBy: g.user.displayName ?? g.user.telegramId,
      })),
      personalGoals: personalGoals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        category: g.category,
        dueDate: g.dueDate,
        priority: g.priority,
        important: g.important,
      })),
      upcomingEvents: events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt })),
      workoutSessionsThisWeek: workoutSessions.length,
      shoppingList: shoppingList.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, checked: i.checked })),
    };
  });

  app.get("/api/team/workouts/recent", { preHandler: authenticate }, async (request) => {
    const { teamId } = request.currentUser!;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sessions = await getSessionsSince(teamId, sevenDaysAgo);

    return sessions
      .slice()
      .reverse()
      .map((s) => ({
        id: s.id,
        loggedAt: s.loggedAt,
        memberName: s.user.displayName ?? s.user.telegramId,
        exercises: s.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, weightKg: e.weightKg })),
      }));
  });

  app.post("/api/team/workouts/recap", { preHandler: authenticate }, async (request) => {
    const { teamId, team } = request.currentUser!;
    const recap = await generateRecap(teamId, team.recapFrequencyDays);
    return { recap };
  });

  interface LogWorkoutBody {
    text: string;
  }

  app.post<{ Body: LogWorkoutBody }>("/api/team/workouts", { preHandler: authenticate }, async (request, reply) => {
    const text = request.body.text?.trim();
    if (!text) return reply.code(400).send({ error: "text è obbligatorio" });

    const user = request.currentUser!;
    const session = await logExerciseFromText(user.id, user.teamId, text);
    const last = session.exercises.at(-1)!;
    broadcastToTeam(user.teamId, { type: "data-updated", reason: "workout-logged" });
    return {
      message: `Esercizio registrato: ${last.name}${last.sets ? ` ${last.sets}x${last.reps ?? "?"}` : ""}${last.weightKg ? ` @ ${last.weightKg}kg` : ""}`,
    };
  });

  interface CreateGoalBody {
    title: string;
    description?: string;
    category?: "general" | "gym";
    scope?: "personal" | "team";
    dueDate?: string;
    priority?: "low" | "medium" | "high";
    important?: boolean;
  }

  app.post<{ Body: CreateGoalBody }>("/api/team/goals", { preHandler: authenticate }, async (request, reply) => {
    const { title, description, category, scope, dueDate, priority, important } = request.body;
    if (!title?.trim()) return reply.code(400).send({ error: "title è obbligatorio" });

    const user = request.currentUser!;
    const goal = await createGoal({
      userId: user.id,
      teamId: user.teamId,
      title: title.trim(),
      description,
      category,
      scope,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority,
      important,
    });
    broadcastToTeam(user.teamId, { type: "data-updated", reason: "goal-created" });
    return { id: goal.id, title: goal.title, category: goal.category };
  });

  app.post("/api/team/link-code", { preHandler: authenticate }, async (request) => {
    const user = request.currentUser!;
    const code = generateCode(6);
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramLinkCode: code, telegramLinkCodeExpiresAt: expiresAt },
    });

    return { code, expiresAt };
  });

  interface LinkTelegramBody {
    code: string;
  }

  /**
   * Flusso inverso: il bot genera un codice al primo contatto (vedi bot/index.ts)
   * e l'utente lo incolla qui, nel proprio profilo web gia' autenticato. A
   * differenza di /api/team/link-code (dove il codice nasce sul web ed e'
   * consumato dal bot), qui il codice nasce sul bot e viene consumato dal web:
   * il telegramId dell'account standalone creato dal bot viene spostato
   * sull'utente web corrente, che diventa l'account "sopravvissuto".
   */
  app.post<{ Body: LinkTelegramBody }>("/api/team/link-telegram", { preHandler: authenticate }, async (request, reply) => {
    const code = request.body.code?.trim().toUpperCase();
    if (!code) return reply.code(400).send({ error: "code è obbligatorio" });

    const source = await prisma.user.findUnique({ where: { telegramLinkCode: code } });
    if (!source || !source.telegramLinkCodeExpiresAt || source.telegramLinkCodeExpiresAt < new Date() || !source.telegramId) {
      return reply.code(400).send({ error: "Codice non valido o scaduto" });
    }

    const user = request.currentUser!;
    const telegramId = source.telegramId;

    await unsetUserFields(source.id, ["telegramId", "telegramLinkCode", "telegramLinkCodeExpiresAt"]);
    await prisma.user.update({ where: { id: user.id }, data: { telegramId } });

    return { ok: true, telegramLinked: true };
  });
}
