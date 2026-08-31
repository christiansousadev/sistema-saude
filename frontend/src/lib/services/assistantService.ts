import api from '@/lib/api'
import type { AssistantChatRequest, AssistantChatResponse } from '@/types'

export async function sendAssistantMessage(
  payload: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  const { data } = await api.post<AssistantChatResponse>('/assistant/chat', payload)
  return data
}
