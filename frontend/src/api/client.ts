import { keycloak } from "../auth/keycloak";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface MeResponse {
  id: string;
  displayName: string | null;
  email: string | null;
  telegramLinked: boolean;
  team: { id: string; name: string };
}

export interface GoalSummary {
  id: string;
  title: string;
  description: string | null;
  category: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  important: boolean;
  createdBy: string | null;
}

export interface TeamSummaryResponse {
  team: { id: string; name: string };
  meals: {
    id: string
    description: string
    grams: number | null
    calories: number | null
    loggedAt: string
    loggedBy: string | null
    planned: boolean
  }[];
  totalCaloriesEatenToday: number;
  totalCaloriesPlannedToday: number;
  teamGoals: GoalSummary[];
  personalGoals: Omit<GoalSummary, 'createdBy'>[];
  upcomingEvents: { id: string; title: string; startsAt: string }[];
  workoutSessionsThisWeek: number;
  shoppingList: { id: string; name: string; quantity: string | null; checked: boolean }[];
}

export interface LinkCodeResponse {
  code: string;
  expiresAt: string;
}

export interface ShellyDevice {
  id: string;
  name: string;
  online: boolean;
  state?: "on" | "off";
}

export interface TahomaDevice {
  deviceURL: string;
  label: string;
  controllable: boolean;
}

async function authorizedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  await keycloak.updateToken(30).catch(() => undefined);
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
      Authorization: `Bearer ${keycloak.token}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Richiesta fallita: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchMe(): Promise<MeResponse> {
  return authorizedFetch<MeResponse>("/api/me");
}

export function fetchTeamSummary(): Promise<TeamSummaryResponse> {
  return authorizedFetch<TeamSummaryResponse>("/api/team/summary");
}

export function requestLinkCode(): Promise<LinkCodeResponse> {
  return authorizedFetch<LinkCodeResponse>("/api/team/link-code", { method: "POST" });
}

export function linkTelegram(code: string): Promise<{ ok: boolean; telegramLinked: boolean }> {
  return authorizedFetch("/api/team/link-telegram", { method: "POST", body: JSON.stringify({ code }) });
}

export function fetchShellyDevices(): Promise<ShellyDevice[]> {
  return authorizedFetch<ShellyDevice[]>("/api/home/shelly");
}

export function toggleShellyDevice(deviceId: string, on: boolean): Promise<{ message: string }> {
  return authorizedFetch("/api/home/shelly/toggle", { method: "POST", body: JSON.stringify({ deviceId, on }) });
}

export function fetchTahomaShutters(): Promise<TahomaDevice[]> {
  return authorizedFetch<TahomaDevice[]>("/api/home/tahoma");
}

export function sendTahomaCommand(deviceURL: string, command: "open" | "close" | "stop"): Promise<{ message: string }> {
  return authorizedFetch("/api/home/tahoma/command", { method: "POST", body: JSON.stringify({ deviceURL, command }) });
}

export interface WorkoutSessionResponse {
  id: string;
  loggedAt: string;
  memberName: string | null;
  exercises: { name: string; sets: number | null; reps: number | null; weightKg: number | null }[];
}

export function fetchRecentWorkouts(): Promise<WorkoutSessionResponse[]> {
  return authorizedFetch<WorkoutSessionResponse[]>("/api/team/workouts/recent");
}

export function requestWorkoutRecap(): Promise<{ recap: string }> {
  return authorizedFetch("/api/team/workouts/recap", { method: "POST" });
}

export function logWorkout(text: string): Promise<{ message: string }> {
  return authorizedFetch("/api/team/workouts", { method: "POST", body: JSON.stringify({ text }) });
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category?: "general" | "gym";
  scope?: "personal" | "team";
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  important?: boolean;
}

export function createGoal(input: CreateGoalInput): Promise<{ id: string; title: string; category: string }> {
  return authorizedFetch("/api/team/goals", { method: "POST", body: JSON.stringify(input) });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatToolCall {
  name: string;
  input: unknown;
  result: string;
}

export interface ChatResponse {
  reply: string;
  toolCalls: ChatToolCall[];
}

export function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  return authorizedFetch("/api/assistant/chat", { method: "POST", body: JSON.stringify({ messages }) });
}

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  costBasis: number | null;
  price: number | null;
  value: number | null;
  gainLoss: number | null;
  error?: string;
}

export interface PortfolioResponse {
  holdings: Holding[];
  totalValue: number;
}

export function fetchPortfolio(): Promise<PortfolioResponse> {
  return authorizedFetch<PortfolioResponse>("/api/investments");
}

export interface AddHoldingInput {
  symbol: string;
  quantity: number;
  costBasis?: number;
}

export function addHolding(input: AddHoldingInput): Promise<Holding> {
  return authorizedFetch("/api/investments", { method: "POST", body: JSON.stringify(input) });
}

export function removeHolding(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/investments/${id}`, { method: "DELETE" });
}

export interface GoogleStatusResponse {
  connected: boolean;
  email?: string;
}

export function fetchGoogleStatus(): Promise<GoogleStatusResponse> {
  return authorizedFetch<GoogleStatusResponse>("/api/integrations/google/status");
}

export function requestGoogleConnectUrl(): Promise<{ url: string }> {
  return authorizedFetch("/api/integrations/google/connect");
}

export function disconnectGoogle(): Promise<{ ok: boolean }> {
  return authorizedFetch("/api/integrations/google/disconnect", { method: "POST" });
}

export interface DiaryEntry {
  id: string;
  content: string;
  mood: string | null;
  createdAt: string;
}

export function fetchDiaryEntries(): Promise<DiaryEntry[]> {
  return authorizedFetch<DiaryEntry[]>("/api/diary");
}

export function addDiaryEntry(content: string, mood?: string): Promise<DiaryEntry> {
  return authorizedFetch("/api/diary", { method: "POST", body: JSON.stringify({ content, mood }) });
}

export function removeDiaryEntry(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/diary/${id}`, { method: "DELETE" });
}
