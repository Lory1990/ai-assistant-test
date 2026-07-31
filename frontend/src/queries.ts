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
  sendChatMessage,
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
  type CreateGoalInput,
  type AddHoldingInput,
  type SchedulePostInput,
} from './api/client'

export const queryKeys = {
  me: ['me'] as const,
  teamSummary: ['team-summary'] as const,
  shellyDevices: ['shelly-devices'] as const,
  tahomaShutters: ['tahoma-shutters'] as const,
  recentWorkouts: ['recent-workouts'] as const,
  portfolio: ['portfolio'] as const,
  googleStatus: ['google-status'] as const,
  diary: ['diary'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  socialAccounts: ['social-accounts'] as const,
  socialPosts: ['social-posts'] as const,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recentWorkouts }),
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

/** L'assistente puo' aver chiamato qualsiasi tool: invalidiamo tutte le query dati dopo un messaggio con tool-call. */
export function useInvalidateAllData() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.teamSummary })
    queryClient.invalidateQueries({ queryKey: queryKeys.shellyDevices })
    queryClient.invalidateQueries({ queryKey: queryKeys.tahomaShutters })
    queryClient.invalidateQueries({ queryKey: queryKeys.recentWorkouts })
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolio })
  }
}
