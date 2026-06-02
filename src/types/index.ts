export type PrepPhase = 'Foundation' | 'Acceleration' | 'Crunch' | 'FinalWeek'
export type Section = 'VARC' | 'DILR' | 'Quant'
export type SessionType = 'Learn' | 'Revise' | 'Practice' | 'Mock' | 'Recovery'
export type SessionStatus = 'pending' | 'active' | 'logged' | 'skipped'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type BurnoutIntervention = 'none' | 'check_in' | 'recovery_day' | 'pod_alert'
export type ExecutionStatus = 'completed' | 'partial' | 'missed'
export type MockSource = 'SimCAT' | 'AIMCAT' | 'CL' | 'TIME' | 'IMS' | 'Other'

export interface Student {
  id: string
  user_id: string
  name: string
  exam_date: string
  target_percentile: number
  available_hours_weekday: number
  available_hours_weekend: number
  peak_energy_window: 'morning' | 'afternoon' | 'night'
  study_style: 'structured' | 'flexible'
  biggest_fear?: string
  archetype?: string
  prep_phase: PrepPhase
  burnout_risk_score: number
  onboarding_complete: boolean
  pod_id?: string
  pod_alert_opt_in: boolean
  created_at: string
  updated_at: string
  dreamIIM?: string
  days_remaining?: number
}

export interface TopicWeight {
  id: string
  student_id: string
  topic: string
  section: Section
  weight: number
  coverage_percent: number
  revision_count: number
  last_studied?: string
  fatigue_score: number
  avoidance_flag: boolean
  updated_at: string
}

export interface PlannedSession {
  topic: string
  section: Section
  session_type: SessionType
  duration_minutes: number
  rationale: string
  status: SessionStatus
}

export interface DailyPlan {
  id: string
  student_id: string
  plan_date: string
  prep_phase: PrepPhase
  days_remaining: number
  sessions: PlannedSession[]
  rationale: string
  dynamic_alerts: DynamicAlert[]
  generated_at: string
}

export interface SessionLog {
  id: string
  student_id: string
  plan_id?: string
  log_date: string
  topic: string
  section: Section
  session_type: SessionType
  planned_duration_minutes?: number
  actual_duration_minutes: number
  difficulty_rating?: number
  focus_rating?: number
  completed: boolean
  abandoned_at_minute?: number
  notes?: string
  logged_at: string
}

export interface MockResult {
  id: string
  student_id: string
  mock_date: string
  source: MockSource
  overall_percentile: number
  varc_score?: number
  varc_percentile?: number
  varc_accuracy?: number
  varc_time_minutes?: number
  dilr_score?: number
  dilr_percentile?: number
  dilr_accuracy?: number
  dilr_time_minutes?: number
  quant_score?: number
  quant_percentile?: number
  quant_accuracy?: number
  quant_time_minutes?: number
  total_attempts?: number
  total_accuracy?: number
  debrief?: MockDebrief
  logged_at: string
}

export interface MockDebrief {
  headline: string
  three_things_to_fix: { issue: string; action: string }[]
  two_things_that_worked: string[]
  plan_adjustment: string
  choke_risk: boolean
  choke_note?: string
}

export interface AdaptationLog {
  id: string
  student_id: string
  log_date: string
  change_type: string
  topic_affected?: string
  reason: string
  previous_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  triggered_by: string
  created_at: string
}

export interface BurnoutScore {
  id: string
  student_id: string
  computed_at: string
  risk_score: number
  abandonment_rate_7d: number
  streak_breaks_7d: number
  difficulty_trend: number
  duration_trend: number
  session_time_drift: number
  intervention_triggered: BurnoutIntervention
}

export interface WeeklyReport {
  id: string
  student_id: string
  week_start: string
  week_end: string
  sessions_planned: number
  sessions_completed: number
  topics_covered: string[]
  weak_topics: string[]
  adaptation_changes: AdaptationLog[]
  mock_count: number
  narrative?: WeeklyNarrative
  generated_at: string
}

export interface WeeklyNarrative {
  headline: string
  what_worked: string
  what_to_watch: string
  one_change: string
  adaptation_summary: string
  encouragement: string
}

export interface DynamicAlert {
  id?: string
  alert_type: string
  message: string
  severity: AlertSeverity
  dismissed: boolean
}

export interface Pod {
  id: string
  target_percentile_range: string
  exam_date_range: string
  member_ids: string[]
  active: boolean
  created_at: string
}

export interface PodExecutionLog {
  pod_id: string
  student_id: string
  log_date: string
  execution_status: ExecutionStatus
  streak_days: number
}

// Computed types
export interface CountdownState {
  daysRemaining: number
  phase: PrepPhase
  phaseProgress: number
  phaseLabel: string
  phaseDescription: string
  phaseRules: string
}

export interface BurnoutSignals {
  abandonmentRate: number
  streakBreaks: number
  difficultyTrend: number
  durationTrend: number
  sessionTimeDrift: number
  riskScore: number
  intervention: BurnoutIntervention
}
