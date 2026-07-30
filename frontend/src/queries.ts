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
  fetchGoogleStatus,
  requestGoogleConnectUrl,
  disconnectGoogle,
  fetchDiaryEntries,
  addDiaryEntry,
  removeDiaryEntry,
  type CreateGoalInput,
  type AddHoldingInput,
  type ChatMessage,
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

export function useSendChatMessage() {
  return useMutation({ mutationFn: (messages: ChatMessage[]) => sendChatMessage(messages) })
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
