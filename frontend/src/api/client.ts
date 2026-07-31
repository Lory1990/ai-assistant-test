import { getAccessToken } from "../auth/authStore";

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
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
      Authorization: `Bearer ${token}`,
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
  /** Utile al primo messaggio, quando la conversazione la crea il server. */
  conversationId: string;
}

export interface Conversation {
  id: string;
  channel: "web" | "telegram";
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolNames: string[];
  createdAt: string;
}

export function fetchConversations(): Promise<Conversation[]> {
  return authorizedFetch<Conversation[]>("/api/conversations");
}

export function fetchConversation(id: string): Promise<{ conversation: Conversation; messages: StoredMessage[] }> {
  return authorizedFetch(`/api/conversations/${id}`);
}

export function deleteConversation(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/conversations/${id}`, { method: "DELETE" });
}

/** Manda solo il messaggio nuovo: la history la ricostruisce il server da quella salvata. */
export function sendChatMessage(input: { conversationId?: string; message: string }): Promise<ChatResponse> {
  return authorizedFetch("/api/assistant/chat", { method: "POST", body: JSON.stringify(input) });
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

// --- Spese -------------------------------------------------------------------
// Personali come il portafoglio: le rotte non prendono mai un teamId.

/** Categorie proposte in dashboard; la colonna resta una stringa libera. */
export const EXPENSE_CATEGORIES = ['casa', 'spesa', 'trasporti', 'salute', 'svago', 'abbonamenti', 'altro'] as const

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  spentAt: string;
  notes: string | null;
}

export interface ExpensesResponse {
  expenses: Expense[];
  /** Totali calcolati dal server sulle spese elencate, filtri compresi. */
  total: number;
  byCategory: { category: string; total: number }[];
}

export interface ExpenseFilters {
  category?: string;
  from?: string;
  to?: string;
}

export function fetchExpenses(filters: ExpenseFilters = {}): Promise<ExpensesResponse> {
  const params = new URLSearchParams()
  if (filters.category) params.set("category", filters.category)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  const query = params.toString()
  return authorizedFetch<ExpensesResponse>(`/api/expenses${query ? `?${query}` : ""}`)
}

export interface AddExpenseInput {
  description: string;
  amount: number;
  category?: string;
  spentAt?: string;
  notes?: string;
}

export function addExpense(input: AddExpenseInput): Promise<Expense> {
  return authorizedFetch("/api/expenses", { method: "POST", body: JSON.stringify(input) });
}

export function removeExpense(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/expenses/${id}`, { method: "DELETE" });
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

export interface SocialAccount {
  id: string;
  provider: "facebook_page" | "instagram";
  externalId: string;
  name: string;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  content: string;
  mediaPath: string | null;
  scheduledAt: string;
  status: "pending" | "published" | "failed" | "canceled";
  externalPostId: string | null;
  error: string | null;
  publishedAt: string | null;
  socialAccount: SocialAccount;
}

export function fetchSocialAccounts(): Promise<SocialAccount[]> {
  return authorizedFetch<SocialAccount[]>("/api/integrations/meta/status");
}

export function requestMetaConnectUrl(): Promise<{ url: string }> {
  return authorizedFetch("/api/integrations/meta/connect");
}

export function disconnectSocialAccount(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/integrations/meta/${id}`, { method: "DELETE" });
}

export function fetchSocialPosts(): Promise<SocialPost[]> {
  return authorizedFetch<SocialPost[]>("/api/social/posts");
}

export interface SchedulePostInput {
  socialAccountId: string;
  content: string;
  scheduledAt: string;
  mediaPath?: string;
}

export function scheduleSocialPost(input: SchedulePostInput): Promise<SocialPost> {
  return authorizedFetch("/api/social/posts", { method: "POST", body: JSON.stringify(input) });
}

export function cancelSocialPost(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/social/posts/${id}`, { method: "DELETE" });
}

export type MarketingItemStatus = "idea" | "approved" | "discarded";

export interface MarketingPlanItem {
  id: string;
  scheduledFor: string;
  channel: string;
  format: string;
  title: string;
  copy: string;
  hashtags: string[];
  status: MarketingItemStatus;
  socialPostId: string | null;
}

export interface MarketingPlan {
  id: string;
  name: string;
  brief: string;
  audience: string | null;
  tone: string | null;
  objective: string | null;
  channels: string[];
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  items: MarketingPlanItem[];
}

export interface CreateMarketingPlanInput {
  name?: string;
  brief: string;
  audience?: string;
  tone?: string;
  objective?: string;
  channels: string[];
  periodStart: string;
  periodEnd: string;
  itemsPerWeek?: number;
}

export function fetchMarketingPlans(): Promise<MarketingPlan[]> {
  return authorizedFetch<MarketingPlan[]>("/api/marketing/plans");
}

export function createMarketingPlan(input: CreateMarketingPlanInput): Promise<MarketingPlan> {
  return authorizedFetch("/api/marketing/plans", { method: "POST", body: JSON.stringify(input) });
}

export function deleteMarketingPlan(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/marketing/plans/${id}`, { method: "DELETE" });
}

export function setMarketingItemStatus(id: string, status: MarketingItemStatus): Promise<MarketingPlanItem> {
  return authorizedFetch(`/api/marketing/items/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export interface ScheduleMarketingItemInput {
  socialAccountId: string;
  scheduledAt?: string;
  mediaPath?: string;
}

export function scheduleMarketingItem(id: string, input: ScheduleMarketingItemInput): Promise<MarketingPlanItem> {
  return authorizedFetch(`/api/marketing/items/${id}/schedule`, { method: "POST", body: JSON.stringify(input) });
}

// Upload multipart: il Content-Type con il boundary lo imposta il browser,
// quindi non passa da authorizedFetch (che forza application/json).
export async function uploadSocialMedia(file: File): Promise<{ mediaPath: string }> {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/social/media`, {
    method: "POST",
    body: form,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Upload fallito: ${res.status}`);
  }
  return res.json() as Promise<{ mediaPath: string }>;
}

// --- Schede (allenamento e alimentari) --------------------------------------
// Personali, non condivise col team: le rotte non prendono mai un teamId.

export interface TrainingPlanExercise {
  name: string;
  sets: number | null;
  /** Stringa: una scheda prescrive "8-10" o "a cedimento", non solo un numero. */
  reps: string | null;
  weightKg: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface TrainingPlanDay {
  order: number;
  name: string;
  notes: string | null;
  exercises: TrainingPlanExercise[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  notes: string | null;
  validFrom: string;
  /** null = scheda aperta, fino a nuovo ordine. */
  validTo: string | null;
  days: TrainingPlanDay[];
}

export interface TrainingToday {
  plan: TrainingPlan;
  day: TrainingPlanDay;
  started: boolean;
}

export interface NutritionPlanMeal {
  slot: string;
  description: string;
  grams: number | null;
  calories: number | null;
}

export interface NutritionPlanDay {
  order: number;
  name: string;
  notes: string | null;
  meals: NutritionPlanMeal[];
}

export interface NutritionPlan {
  id: string;
  name: string;
  notes: string | null;
  validFrom: string;
  validTo: string | null;
  days: NutritionPlanDay[];
}

export interface NutritionToday {
  plan: NutritionPlan;
  day: NutritionPlanDay;
  applied: boolean;
}

/**
 * In input i giorni non hanno `order`: la rotazione e' la posizione
 * nell'array, e il backend rinumera 1..N a ogni salvataggio.
 */
export interface TrainingExerciseInput {
  name: string;
  sets?: number | null;
  reps?: string | null;
  weightKg?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
}

export interface TrainingDayInput {
  name: string;
  notes?: string | null;
  exercises: TrainingExerciseInput[];
}

export interface TrainingPlanInput {
  name: string;
  notes?: string | null;
  validFrom: string;
  validTo?: string | null;
  days: TrainingDayInput[];
}

export interface NutritionMealInput {
  slot: string;
  description: string;
  grams?: number | null;
  calories?: number | null;
}

export interface NutritionDayInput {
  name: string;
  notes?: string | null;
  meals: NutritionMealInput[];
}

export interface NutritionPlanInput {
  name: string;
  notes?: string | null;
  validFrom: string;
  validTo?: string | null;
  days: NutritionDayInput[];
}

export function fetchTrainingPlans(): Promise<TrainingPlan[]> {
  return authorizedFetch<TrainingPlan[]>("/api/plans/training");
}

export function fetchTrainingToday(): Promise<TrainingToday | null> {
  return authorizedFetch<TrainingToday | null>("/api/plans/training/today");
}

export function createTrainingPlan(input: TrainingPlanInput): Promise<TrainingPlan> {
  return authorizedFetch("/api/plans/training", { method: "POST", body: JSON.stringify(input) });
}

export function updateTrainingPlan(id: string, input: TrainingPlanInput): Promise<TrainingPlan> {
  return authorizedFetch(`/api/plans/training/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteTrainingPlan(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/plans/training/${id}`, { method: "DELETE" });
}

export function fetchNutritionPlans(): Promise<NutritionPlan[]> {
  return authorizedFetch<NutritionPlan[]>("/api/plans/nutrition");
}

export function fetchNutritionToday(): Promise<NutritionToday | null> {
  return authorizedFetch<NutritionToday | null>("/api/plans/nutrition/today");
}

export function createNutritionPlan(input: NutritionPlanInput): Promise<NutritionPlan> {
  return authorizedFetch("/api/plans/nutrition", { method: "POST", body: JSON.stringify(input) });
}

export function updateNutritionPlan(id: string, input: NutritionPlanInput): Promise<NutritionPlan> {
  return authorizedFetch(`/api/plans/nutrition/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteNutritionPlan(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/plans/nutrition/${id}`, { method: "DELETE" });
}

export function applyNutritionToday(): Promise<{ created: number; alreadyApplied: boolean }> {
  return authorizedFetch("/api/plans/nutrition/today/apply", { method: "POST" });
}

export interface MemoryFact {
  id: string;
  content: string;
  category: string | null;
  /** "assistant" se l'ha imparato parlando con te, "user" se l'hai scritto tu. */
  source: 'assistant' | 'user';
  createdAt: string;
}

export function fetchMemory(): Promise<MemoryFact[]> {
  return authorizedFetch<MemoryFact[]>("/api/memory");
}

export function addMemoryFact(content: string, category?: string): Promise<MemoryFact> {
  return authorizedFetch("/api/memory", { method: "POST", body: JSON.stringify({ content, category }) });
}

export function removeMemoryFact(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/memory/${id}`, { method: "DELETE" });
}

// --- Progetti -------------------------------------------------------------

export type ProjectScope = 'personal' | 'team'
export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived'
export type ProductStatus = 'idea' | 'building' | 'live' | 'archived'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type TransactionType = 'revenue' | 'cost'

export interface Project {
  id: string;
  name: string;
  description: string | null;
  scope: ProjectScope;
  status: ProjectStatus;
  createdAt: string;
  createdBy: string | null;
  productCount: number;
}

export interface ProjectsResponse {
  teamProjects: Project[];
  personalProjects: Project[];
}

/** Riassunto del Gantt di un prodotto, calcolato dal server. */
export interface ProductSchedule {
  startsAt: string | null;
  endsAt: string | null;
  progress: number;
  taskCount: number;
}

export interface Product {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  createdAt: string;
  noteCount: number;
  schedule: ProductSchedule;
}

export interface ProductTask {
  id: string;
  productId: string;
  name: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  progress: number;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface ProductNote {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  author: string | null;
}

export interface ProductDetail {
  product: Omit<Product, 'noteCount' | 'schedule'>;
  project: { id: string; name: string; scope: ProjectScope };
  tasks: ProductTask[];
  notes: ProductNote[];
  schedule: ProductSchedule;
}

export interface TeamMember {
  id: string;
  displayName: string | null;
  email: string | null;
}

export interface ProjectTransaction {
  id: string;
  projectId: string;
  productId: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  category: string | null;
  occurredAt: string;
  product: { id: string; name: string } | null;
}

export interface EconomicsTotals {
  revenue: number;
  cost: number;
  margin: number;
}

export interface ProjectEconomics extends EconomicsTotals {
  byProduct: (EconomicsTotals & { productId: string | null; productName: string | null })[];
  transactionCount: number;
}

export function fetchProjects(): Promise<ProjectsResponse> {
  return authorizedFetch<ProjectsResponse>("/api/projects");
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  scope?: ProjectScope;
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return authorizedFetch("/api/projects", { method: "POST", body: JSON.stringify(input) });
}

export function fetchProject(id: string): Promise<{ project: Project; products: Product[] }> {
  return authorizedFetch(`/api/projects/${id}`);
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  scope?: ProjectScope;
  status?: ProjectStatus;
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  return authorizedFetch(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/projects/${id}`, { method: "DELETE" });
}

export function fetchTeamMembers(): Promise<TeamMember[]> {
  return authorizedFetch<TeamMember[]>("/api/projects/team-members");
}

export interface ProductInput {
  name?: string;
  description?: string | null;
  status?: ProductStatus;
}

export function createProduct(projectId: string, input: ProductInput): Promise<Product> {
  return authorizedFetch(`/api/projects/${projectId}/products`, { method: "POST", body: JSON.stringify(input) });
}

export function fetchProduct(id: string): Promise<ProductDetail> {
  return authorizedFetch<ProductDetail>(`/api/products/${id}`);
}

export function updateProduct(id: string, input: ProductInput): Promise<Product> {
  return authorizedFetch(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteProduct(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/products/${id}`, { method: "DELETE" });
}

export interface TaskInput {
  name?: string;
  notes?: string | null;
  /** ISO: il server accetta qualsiasi data valida, la dashboard manda il giorno scelto. */
  startsAt?: string;
  endsAt?: string;
  progress?: number;
  status?: TaskStatus;
  assigneeId?: string | null;
}

export function createProductTask(productId: string, input: TaskInput): Promise<ProductTask> {
  return authorizedFetch(`/api/products/${productId}/tasks`, { method: "POST", body: JSON.stringify(input) });
}

export function updateProductTask(id: string, input: TaskInput): Promise<ProductTask> {
  return authorizedFetch(`/api/product-tasks/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteProductTask(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/product-tasks/${id}`, { method: "DELETE" });
}

export function addProductNote(productId: string, input: { title?: string; content: string }): Promise<ProductNote> {
  return authorizedFetch(`/api/products/${productId}/notes`, { method: "POST", body: JSON.stringify(input) });
}

export function deleteProductNote(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/product-notes/${id}`, { method: "DELETE" });
}

export function fetchProjectEconomics(projectId: string): Promise<ProjectEconomics> {
  return authorizedFetch<ProjectEconomics>(`/api/projects/${projectId}/economics`);
}

export interface AddTransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  category?: string;
  occurredAt?: string;
  productId?: string;
}

export function addProjectTransaction(projectId: string, input: AddTransactionInput): Promise<ProjectTransaction> {
  return authorizedFetch(`/api/projects/${projectId}/economics`, { method: "POST", body: JSON.stringify(input) });
}

export function deleteProjectTransaction(id: string): Promise<{ ok: boolean }> {
  return authorizedFetch(`/api/economics/${id}`, { method: "DELETE" });
}
