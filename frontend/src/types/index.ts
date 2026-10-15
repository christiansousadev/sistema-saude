// tipos espelhando os schemas Pydantic do backend

// ─── auth ────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: number
  name: string
  email: string
  is_active: boolean
  is_superadmin: boolean
  is_totp_enabled?: boolean
  height_cm: number | null
  birth_date: string | null
  created_at: string
}

export interface AdminUserResponse extends UserResponse {
  clinical_count: number
  physical_count: number
  active_engine: EngineMode | null
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
}

// ─── configuração de ia ───────────────────────────────────────────────────────

export type EngineMode = 'local' | 'llm'

export interface ApiConfiguration {
  id: number
  user_id: number
  engine_mode: EngineMode
  api_key: string | null
  model_name: string
  base_url: string | null
  clinical_system_prompt: string | null
  physical_system_prompt: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── evolução física ──────────────────────────────────────────────────────────

export interface PhysicalResponse {
  id: number
  user_id: number
  recorded_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  photo_path: string | null
  photo_back_path?: string | null
  photo_side_path?: string | null
  waist_cm?: number | null
  hip_cm?: number | null
  chest_cm?: number | null
  arm_cm?: number | null
  thigh_cm?: number | null
  neck_cm?: number | null
  waist_to_hip_ratio?: number | null
  waist_to_height_ratio?: number | null
  cardiovascular_risk?: 'baixo' | 'moderado' | 'elevado' | null
  ai_analysis: Record<string, unknown> | null
  notes: string | null
  created_at: string
}

export interface PhysicalListResponse {
  total: number
  items: PhysicalResponse[]
}

// ─── exames clínicos ──────────────────────────────────────────────────────────

export interface ClinicalMarker {
  name: string
  value: number | string
  unit: string
  reference_range: string | null
  status: 'normal' | 'alto' | 'baixo' | null
}

export interface ClinicalExtractedData {
  engine: EngineMode | 'local_cv'
  status: string
  exam_type?: string
  exam_date?: string | null
  markers?: ClinicalMarker[]
  lab_name?: string | null
  [key: string]: unknown
}

export interface ClinicalResponse {
  id: number
  user_id: number
  recorded_at: string
  file_path: string | null
  extracted_data: ClinicalExtractedData | null
  extraction_engine: EngineMode | null
  notes: string | null
  is_validated: boolean
  created_at: string
}

export interface ClinicalListResponse {
  total: number
  items: ClinicalResponse[]
}

// ─── relatórios ───────────────────────────────────────────────────────────────

export interface PatientProfileSummary {
  name: string
  email: string
  height_cm: number | null
  birth_date: string | null
  age: number | null
  created_at: string
}

export interface PhysicalSummaryReport {
  total_records: number
  first_record_date: string | null
  latest_record_date: string | null
  first_weight_kg: number | null
  latest_weight_kg: number | null
  delta_weight_kg: number | null
  first_body_fat_pct: number | null
  latest_body_fat_pct: number | null
  delta_body_fat_pct: number | null
  latest_muscle_mass_kg: number | null
  latest_imc: number | null
  imc_classification: string | null
  latest_ai_analysis: Record<string, unknown> | null
}

export interface EnrichedMarker {
  name: string
  value: number | string
  unit: string
  reference_range: string | null
  status: 'normal' | 'alto' | 'baixo' | null
  delta_value: number | null
  delta_pct: number | null
  trend: 'melhora' | 'piora' | 'estavel' | 'novo'
  alert: string | null
}

export interface ActiveAlert {
  marker: string
  value: string
  status: string
  message: string
}

export interface ClinicalSummaryReport {
  total_exams: number
  latest_exam_date: string | null
  latest_markers: EnrichedMarker[]
  active_alerts: ActiveAlert[]
  validated_exams_count: number
}

export interface MedicalSummaryResponse {
  generated_at: string
  patient: PatientProfileSummary
  physical: PhysicalSummaryReport
  clinical: ClinicalSummaryReport
  disclaimer: string
}

// ─── assistente de ia ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantChatRequest {
  message: string
  conversation_history?: ChatMessage[]
}

export interface AssistantChatResponse {
  reply: string
  context_used: Record<string, unknown>
  disclaimer: string
  timestamp: string
}

export interface ExecutiveSummaryResponse {
  summary_headline: string
  overall_status: 'otimo' | 'estavel' | 'atencao'
  physical_insights: string
  clinical_insights: string
  habits_insights: string
  action_plan: string[]
  generated_at: string
  disclaimer: string
}

export interface DoctorQuestionsResponse {
  questions: string[]
  abnormal_markers_found: string[]
  generated_at: string
  disclaimer: string
}

// ─── paginação ────────────────────────────────────────────────────────────────

export interface PaginationParams {
  skip?: number
  limit?: number
}

// ─── hábitos e hidratação ───────────────────────────────────────────────────

export interface DailyHabitResponse {
  id: number
  user_id: number
  date: string
  water_ml: number
  water_goal_ml: number
  pct: number
  sleep_hours?: number | null
  sleep_quality?: number | null
  energy_level?: number | null
  workout_done?: boolean
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface WaterHistoryResponse {
  items: DailyHabitResponse[]
  average_ml: number
  days_logged: number
  goal_reached_days: number
}

// ─── evolução e timeline de biomarcadores ────────────────────────────────────

export interface BiomarkerDataPoint {
  date: string
  value: number
  unit: string
  reference_range: string | null
  status: 'normal' | 'alto' | 'baixo' | null
  exam_id: number
}

export interface BiomarkerTimelineItem {
  name: string
  category: string | null
  unit: string
  reference_range: string | null
  latest_value: number | null
  latest_status: 'normal' | 'alto' | 'baixo' | null
  data_points: BiomarkerDataPoint[]
}

export interface BiomarkerTimelineResponse {
  biomarkers: BiomarkerTimelineItem[]
}

// ─── medicamentos e suplementos ──────────────────────────────────────────────

export interface MedicationCreate {
  name: string
  dosage: string
  frequency: string
  category?: string
  instructions?: string | null
  is_active?: boolean
  start_date?: string | null
  end_date?: string | null
}

export interface MedicationUpdate {
  name?: string
  dosage?: string
  frequency?: string
  category?: string
  instructions?: string | null
  is_active?: boolean
  start_date?: string | null
  end_date?: string | null
}

export interface MedicationResponse {
  id: number
  user_id: number
  name: string
  dosage: string
  frequency: string
  category: string
  instructions?: string | null
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  created_at: string
  updated_at: string
}

export interface MedicationListResponse {
  items: MedicationResponse[]
  total: number
}

// ─── acesso temporário convidado médico ───────────────────────────────────────

export interface DoctorShareCreate {
  recipient_name?: string | null
  expires_in_hours?: number
  pin?: string | null
}

export interface DoctorShareResponse {
  id: number
  token: string
  recipient_name: string | null
  expires_at: string
  created_at: string
  access_count: number
  is_active: boolean
  has_pin?: boolean
  share_url?: string | null
}

export interface DoctorShareCheckResponse {
  requires_pin: boolean
  recipient_name: string | null
  is_valid: boolean
  expires_at: string
}

export interface DoctorShareListResponse {
  items: DoctorShareResponse[]
  total: number
}

// ─── autenticação em duas etapas (2fa / totp) ────────────────────────────────

export interface User2FASetupResponse {
  secret: string
  otpauth_url: string
}

export interface User2FAStatusResponse {
  is_totp_enabled: boolean
}


