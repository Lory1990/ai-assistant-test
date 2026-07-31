import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMe,
  fetchTeamSummary,
  fetchShellyDevices,
  toggleShellyDevice,
  fetchTahomaShutters,
  sendTahomaCommand,
  fetchRecentWorkouts,
  requestWorkoutRecap,
  logWorkout,
  createGoal,
  requestLinkCode,
  linkTelegram,
  fetchPortfolio,
  addHolding,
  removeHolding,
  fetchExpenses,
  addExpense,
  removeExpense,
  sendChatMessage,
  fetchMemory,
  addMemoryFact,
  removeMemoryFact,
  fetchConversations,
  fetchConversation,
  deleteConversation,
  fetchGoogleStatus,
  requestGoogleConnectUrl,
  disconnectGoogle,
  fetchDiaryEntries,
  addDiaryEntry,
  removeDiaryEntry,
  fetchSocialAccounts,
  requestMetaConnectUrl,
  disconnectSocialAccount,
  fetchSocialPosts,
  scheduleSocialPost,
  cancelSocialPost,
  uploadSocialMedia,
  fetchTrainingPlans,
  fetchTrainingToday,
  createTrainingPlan,
  updateTrainingPlan,
  deleteTrainingPlan,
  fetchNutritionPlans,
  fetchNutritionToday,
  createNutritionPlan,
  updateNutritionPlan,
  deleteNutritionPlan,
  applyNutritionToday,
  fetchMarketingPlans,
  createMarketingPlan,
  deleteMarketingPlan,
  setMarketingItemStatus,
  scheduleMarketingItem,
  type CreateMarketingPlanInput,
  type MarketingItemStatus,
  type ScheduleMarketingItemInput,
  type CreateGoalInput,
  type AddHoldingInput,
  type AddExpenseInput,
  type ExpenseFilters,
  type SchedulePostInput,
  type TrainingPlanInput,
  type NutritionPlanInput,
} from './api/client'

export const queryKeys = {
  me: ['me'] as const,
  teamSummary: ['team-summary'] as const,
  shellyDevices: ['shelly-devices'] as const,
  tahomaShutters: ['tahoma-shutters'] as const,
  recentWorkouts: ['recent-workouts'] as const,
  portfolio: ['portfolio'] as const,
  // I filtri fanno parte della chiave: cambiare categoria o periodo e' una
  // query diversa, e la precedente resta in cache mentre si torna indietro.
  expenses: (filters: ExpenseFilters = {}) => ['expenses', filters] as const,
  googleStatus: ['google-status'] as const,
  diary: ['diary'] as const,
  memory: ['memory'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  socialAccounts: ['social-accounts'] as const,
  socialPosts: ['social-posts'] as const,
  trainingPlans: ['training-plans'] as const,
  trainingToday: ['training-today'] as const,
  nutritionPlans: ['nutrition-plans'] as const,
  nutritionToday: ['nutrition-today'] as const,
  marketingPlans: ['marketing-plans'] as const,
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: fetchMe })
}

export function useTeamSummary() {
  return useQuery({ queryKey: queryKeys.teamSummary, queryFn: fetchTeamSummary })
}

export function useShellyDevices() {
  return useQuery({ queryKey: queryKeys.shellyDevices, queryFn: fetchShellyDevices })
}

export function useToggleShellyDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceId, on }: { deviceId: string; on: boolean }) => toggleShellyDevice(deviceId, on),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shellyDevices }),
  })
}

export function useTahomaShutters() {
  return useQuery({ queryKey: queryKeys.tahomaShutters, queryFn: fetchTahomaShutters })
}

export function useSendTahomaCommand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deviceURL, command }: { deviceURL: string; command: 'open' | 'close' | 'stop' }) =>
      sendTahomaCommand(deviceURL, command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tahomaShutters }),
  })
}

export function useRecentWorkouts() {
  return useQuery({ queryKey: queryKeys.recentWorkouts, queryFn: fetchRecentWorkouts })
}

export function useWorkoutRecap() {
  return useMutation({ mutationFn: requestWorkoutRecap })
}

export function useLogWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => logWorkout(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recentWorkouts })
      // La prima registrazione della giornata timbra il giorno di scheda e fa
      // avanzare la rotazione: "oggi tocca" non e' piu' quello di prima.
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingToday })
    },
  })
}

export function useCreateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teamSummary }),
  })
}

export function useRequestLinkCode() {
  return useMutation({ mutationFn: requestLinkCode })
}

export function useLinkTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => linkTelegram(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  })
}

export function usePortfolio() {
  return useQuery({ queryKey: queryKeys.portfolio, queryFn: fetchPortfolio })
}

export function useAddHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddHoldingInput) => addHolding(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
  })
}

export function useRemoveHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeHolding(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
  })
}

export function useExpenses(filters: ExpenseFilters = {}) {
  return useQuery({ queryKey: queryKeys.expenses(filters), queryFn: () => fetchExpenses(filters) })
}

/** Invalida tutte le combinazioni di filtri: una spesa nuova cambia anche le liste filtrate. */
export function useAddExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddExpenseInput) => addExpense(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useRemoveExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeExpense(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useMemory() {
  return useQuery({ queryKey: queryKeys.memory, queryFn: fetchMemory })
}

export function useAddMemoryFact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ content, category }: { content: string; category?: string }) => addMemoryFact(content, category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.memory }),
  })
}

export function useRemoveMemoryFact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeMemoryFact(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.memory }),
  })
}

export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: fetchConversations })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? ''),
    queryFn: () => fetchConversation(id!),
    enabled: id !== null,
  })
}

export function useSendChatMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { conversationId?: string; message: string }) => sendChatMessage(input),
    onSuccess: (res) => {
      // I messaggi salvati e l'ordine della lista sono cambiati entrambi.
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(res.conversationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  })
}

export function useGoogleStatus() {
  return useQuery({ queryKey: queryKeys.googleStatus, queryFn: fetchGoogleStatus })
}

export function useRequestGoogleConnectUrl() {
  return useMutation({ mutationFn: requestGoogleConnectUrl })
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: disconnectGoogle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.googleStatus }),
  })
}

export function useDiaryEntries() {
  return useQuery({ queryKey: queryKeys.diary, queryFn: fetchDiaryEntries })
}

export function useAddDiaryEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ content, mood }: { content: string; mood?: string }) => addDiaryEntry(content, mood),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diary }),
  })
}

export function useRemoveDiaryEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeDiaryEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diary }),
  })
}

export function useSocialAccounts() {
  return useQuery({ queryKey: queryKeys.socialAccounts, queryFn: fetchSocialAccounts })
}

export function useRequestMetaConnectUrl() {
  return useMutation({ mutationFn: requestMetaConnectUrl })
}

export function useDisconnectSocialAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => disconnectSocialAccount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.socialAccounts }),
  })
}

export function useSocialPosts() {
  return useQuery({ queryKey: queryKeys.socialPosts, queryFn: fetchSocialPosts })
}

export function useUploadSocialMedia() {
  return useMutation({ mutationFn: (file: File) => uploadSocialMedia(file) })
}

export function useScheduleSocialPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SchedulePostInput) => scheduleSocialPost(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.socialPosts }),
  })
}

export function useCancelSocialPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelSocialPost(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.socialPosts }),
  })
}

// --- Schede di allenamento ---------------------------------------------------

export function useTrainingPlans() {
  return useQuery({ queryKey: queryKeys.trainingPlans, queryFn: fetchTrainingPlans })
}

export function useTrainingToday() {
  return useQuery({ queryKey: queryKeys.trainingToday, queryFn: fetchTrainingToday })
}

/**
 * Salvare una scheda puo' cambiarne un'altra: creando una scheda nuova quella
 * aperta prima viene chiusa il giorno precedente. Per questo si invalida
 * tutta la lista, non solo la scheda toccata.
 */
export function useSaveTrainingPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TrainingPlanInput }) =>
      id ? updateTrainingPlan(id, input) : createTrainingPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingPlans })
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingToday })
    },
  })
}

export function useDeleteTrainingPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTrainingPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingPlans })
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingToday })
    },
  })
}

// --- Schede alimentari -------------------------------------------------------

export function useNutritionPlans() {
  return useQuery({ queryKey: queryKeys.nutritionPlans, queryFn: fetchNutritionPlans })
}

export function useNutritionToday() {
  return useQuery({ queryKey: queryKeys.nutritionToday, queryFn: fetchNutritionToday })
}

export function useSaveNutritionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: NutritionPlanInput }) =>
      id ? updateNutritionPlan(id, input) : createNutritionPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nutritionPlans })
      queryClient.invalidateQueries({ queryKey: queryKeys.nutritionToday })
    },
  })
}

export function useDeleteNutritionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteNutritionPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nutritionPlans })
      queryClient.invalidateQueries({ queryKey: queryKeys.nutritionToday })
    },
  })
}

/** Genera i pasti pianificati di oggi dal giorno di scheda che tocca. */
export function useApplyNutritionToday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: applyNutritionToday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nutritionToday })
      // I pasti generati finiscono tra quelli di oggi, che sono del team.
      queryClient.invalidateQueries({ queryKey: queryKeys.teamSummary })
    },
  })
}

export function useMarketingPlans() {
  return useQuery({ queryKey: queryKeys.marketingPlans, queryFn: fetchMarketingPlans })
}

/** La generazione passa dall'AI: può volerci qualche decina di secondi, non c'è nulla di ottimistico da mostrare. */
export function useCreateMarketingPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMarketingPlanInput) => createMarketingPlan(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.marketingPlans }),
  })
}

export function useDeleteMarketingPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMarketingPlan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.marketingPlans }),
  })
}

export function useSetMarketingItemStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MarketingItemStatus }) => setMarketingItemStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.marketingPlans }),
  })
}

export function useScheduleMarketingItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: ScheduleMarketingItemInput & { id: string }) => scheduleMarketingItem(id, input),
    onSuccess: () => {
      // Il contenuto ora punta a un post, e il post compare tra quelli programmati.
      queryClient.invalidateQueries({ queryKey: queryKeys.marketingPlans })
      queryClient.invalidateQueries({ queryKey: queryKeys.socialPosts })
    },
  })
}

/** L'assistente puo' aver chiamato qualsiasi tool: invalidiamo tutte le query dati dopo un messaggio con tool-call. */
export function useInvalidateAllData() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.teamSummary })
    queryClient.invalidateQueries({ queryKey: queryKeys.shellyDevices })
    queryClient.invalidateQueries({ queryKey: queryKeys.tahomaShutters })
    queryClient.invalidateQueries({ queryKey: queryKeys.recentWorkouts })
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolio })
    queryClient.invalidateQueries({ queryKey: queryKeys.trainingToday })
    queryClient.invalidateQueries({ queryKey: queryKeys.nutritionToday })
    queryClient.invalidateQueries({ queryKey: queryKeys.marketingPlans })
  }
}
