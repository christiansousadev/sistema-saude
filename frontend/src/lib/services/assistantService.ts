import api from '@/lib/api'
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  DoctorQuestionsResponse,
  ExecutiveSummaryResponse,
} from '@/types'

export async function sendAssistantMessage(
  payload: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  const { data } = await api.post<AssistantChatResponse>('/assistant/chat', payload)
  return data
}

export async function getExecutiveSummary(): Promise<ExecutiveSummaryResponse> {
  const { data } = await api.get<ExecutiveSummaryResponse>('/assistant/executive-summary')
  return data
}

export async function getDoctorQuestions(): Promise<DoctorQuestionsResponse> {
  const { data } = await api.get<DoctorQuestionsResponse>('/assistant/doctor-questions')
  return data
}

