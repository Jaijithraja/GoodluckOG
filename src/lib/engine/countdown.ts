import { differenceInDays } from 'date-fns'
import { PrepPhase, CountdownState, DynamicAlert } from '@/types'

export function computeCountdown(examDate: string): CountdownState {
  const days = differenceInDays(new Date(examDate), new Date())

  let phase: PrepPhase
  let phaseProgress: number
  let phaseLabel: string
  let phaseDescription: string
  let phaseRules: string

  if (days >= 180) {
    phase = 'Foundation'
    phaseProgress = Math.max(0, 1 - (days - 180) / 180)
    phaseLabel = 'Foundation Phase'
    phaseDescription = 'Building concepts. Wide coverage. Steady pace.'
    phaseRules = 'Prioritize concept coverage. Mock max 1 per 3 weeks. All session types allowed. Flexible pacing is fine.'
  } else if (days >= 60) {
    phase = 'Acceleration'
    phaseProgress = 1 - (days - 60) / 120
    phaseLabel = 'Acceleration Phase'
    phaseDescription = 'Mock-heavy. Weak topics intensive. Gap closing.'
    phaseRules = 'Mock minimum 1 per week. Prioritize weak topics aggressively. All session types allowed. Start sectional mocks.'
  } else if (days >= 7) {
    phase = 'Crunch'
    phaseProgress = 1 - (days - 7) / 53
    phaseLabel = 'Crunch Phase'
    phaseDescription = 'Revision and mocks only. No new topics. Protect energy.'
    phaseRules = 'CRITICAL: NO Learn sessions at all. Revise, Practice, Mock, Recovery only. Mock every 3 days minimum.'
  } else {
    phase = 'FinalWeek'
    phaseProgress = 1 - days / 7
    phaseLabel = 'Final Week'
    phaseDescription = 'Light revision. Rest. Trust your preparation.'
    phaseRules = 'CRITICAL: Max 1 session per day. Revise or Recovery ONLY. Absolutely no new topics or Learn sessions.'
  }

  return { daysRemaining: days, phase, phaseProgress, phaseLabel, phaseDescription, phaseRules }
}

export interface AlertContext {
  topicWeights: { topic: string; section: string; coverage_percent: number; weight: number; avoidance_flag: boolean }[]
  sessionLogs14d: { log_date: string; completed: boolean }[]
  mockCount30d: number
  phase: PrepPhase
  daysRemaining: number
  revisedTopicsCount: number
  studiedTopicsCount: number
}

export function computeDynamicAlerts(ctx: AlertContext): DynamicAlert[] {
  const alerts: DynamicAlert[] = []

  // Coverage gap
  const lowCoverage = ctx.topicWeights.filter(
    t => t.coverage_percent < 60 && ctx.daysRemaining < 90
  )
  if (lowCoverage.length > 0) {
    alerts.push({
      alert_type: 'coverage_gap',
      message: `${lowCoverage.length} topic${lowCoverage.length > 1 ? 's' : ''} under 60% coverage with ${ctx.daysRemaining} days left: ${lowCoverage.slice(0, 2).map(t => t.topic).join(', ')}${lowCoverage.length > 2 ? '...' : ''}.`,
      severity: ctx.daysRemaining < 45 ? 'critical' : 'warning',
      dismissed: false
    })
  }

  // Pace alert — under 70% completion over last 14 days
  if (ctx.sessionLogs14d.length > 0) {
    const completed = ctx.sessionLogs14d.filter(l => l.completed).length
    const rate = completed / ctx.sessionLogs14d.length
    if (rate < 0.7) {
      alerts.push({
        alert_type: 'pace_alert',
        message: `You've completed ${Math.round(rate * 100)}% of planned sessions in the last 2 weeks. The gap compounds — today's effort matters more than yesterday's miss.`,
        severity: rate < 0.5 ? 'critical' : 'warning',
        dismissed: false
      })
    }
  }

  // Revision debt
  if (ctx.studiedTopicsCount > 0 && ctx.revisedTopicsCount < ctx.studiedTopicsCount * 0.4) {
    alerts.push({
      alert_type: 'revision_debt',
      message: `You've studied ${ctx.studiedTopicsCount} topics but only revised ${ctx.revisedTopicsCount}. Without revision, retention drops by 70% in a week.`,
      severity: 'warning',
      dismissed: false
    })
  }

  // Mock frequency
  const requiredMocks = ctx.phase === 'Acceleration' ? 4 : ctx.phase === 'Crunch' ? 10 : 1
  if (ctx.mockCount30d < requiredMocks && ctx.phase !== 'Foundation') {
    alerts.push({
      alert_type: 'mock_frequency',
      message: `${ctx.phase} phase requires ${requiredMocks} mocks per month. You've taken ${ctx.mockCount30d}. Mock practice is non-negotiable now.`,
      severity: 'warning',
      dismissed: false
    })
  }

  // Avoidance patterns
  const avoidedTopics = ctx.topicWeights.filter(t => t.avoidance_flag)
  if (avoidedTopics.length > 0) {
    alerts.push({
      alert_type: 'avoidance_pattern',
      message: `You've been avoiding ${avoidedTopics.map(t => t.topic).join(', ')}. Goodluck has moved ${avoidedTopics.length === 1 ? 'it' : 'them'} to your peak energy window this week.`,
      severity: 'info',
      dismissed: false
    })
  }

  return alerts
}
