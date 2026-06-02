import { SupabaseClient } from '@supabase/supabase-js'
import { BurnoutSignals, BurnoutIntervention } from '@/types'

export async function computeBurnoutScore(
  studentId: string,
  supabase: SupabaseClient
): Promise<BurnoutSignals> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const fromDate = sevenDaysAgo.toISOString().split('T')[0]

  const { data: logs } = await supabase
    .from('session_logs')
    .select('*')
    .eq('student_id', studentId)
    .gte('log_date', fromDate)
    .order('logged_at', { ascending: true })

  if (!logs || logs.length === 0) {
    return {
      abandonmentRate: 0,
      streakBreaks: 0,
      difficultyTrend: 0,
      durationTrend: 0,
      sessionTimeDrift: 0,
      riskScore: 0,
      intervention: 'none'
    }
  }

  // 1. Abandonment rate
  const started = logs.filter(l => l.actual_duration_minutes > 0)
  const abandoned = started.filter(l => !l.completed || l.abandoned_at_minute != null)
  const abandonmentRate = started.length > 0 ? abandoned.length / started.length : 0

  // 2. Streak breaks — days with zero sessions in last 7
  const datesWithSessions = new Set(logs.map(l => l.log_date))
  let streakBreaks = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    if (!datesWithSessions.has(d.toISOString().split('T')[0])) streakBreaks++
  }

  // 3. Difficulty trend — slope of difficulty ratings over time
  const ratedLogs = logs.filter(l => l.difficulty_rating != null)
  let difficultyTrend = 0
  if (ratedLogs.length >= 3) {
    const mid = Math.floor(ratedLogs.length / 2)
    const firstHalf = ratedLogs.slice(0, mid).map(l => l.difficulty_rating || 0)
    const secondHalf = ratedLogs.slice(mid).map(l => l.difficulty_rating || 0)
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    difficultyTrend = Math.abs(avgSecond - avgFirst) / 5
  }

  // 4. Duration trend — are sessions getting shorter?
  let durationTrend = 0
  if (logs.length >= 4) {
    const firstHalf = logs.slice(0, Math.floor(logs.length / 2))
    const secondHalf = logs.slice(Math.floor(logs.length / 2))
    const avgFirst = firstHalf.reduce((s, l) => s + l.actual_duration_minutes, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, l) => s + l.actual_duration_minutes, 0) / secondHalf.length
    durationTrend = avgFirst > 0 ? Math.max(0, (avgFirst - avgSecond) / avgFirst) : 0
  }

  // 5. Session time drift — shifting to late night
  const logsWithTime = logs.filter(l => l.logged_at)
  let sessionTimeDrift = 0
  if (logsWithTime.length >= 3) {
    const lateNightCount = logsWithTime.filter(l => {
      const hour = new Date(l.logged_at).getHours()
      return hour >= 23 || hour < 4
    }).length
    sessionTimeDrift = lateNightCount / logsWithTime.length
  }

  // Weighted score
  const riskScore = Math.min(1, Math.max(0,
    abandonmentRate * 0.30 +
    (streakBreaks / 7) * 0.25 +
    difficultyTrend * 0.20 +
    durationTrend * 0.15 +
    sessionTimeDrift * 0.10
  ))

  let intervention: BurnoutIntervention = 'none'
  if (riskScore > 0.9) intervention = 'pod_alert'
  else if (riskScore > 0.75) intervention = 'recovery_day'
  else if (riskScore > 0.6) intervention = 'check_in'

  // Persist score
  await supabase.from('burnout_scores').insert({
    student_id: studentId,
    risk_score: riskScore,
    abandonment_rate_7d: abandonmentRate,
    streak_breaks_7d: streakBreaks,
    difficulty_trend: difficultyTrend,
    duration_trend: durationTrend,
    session_time_drift: sessionTimeDrift,
    intervention_triggered: intervention
  })

  // Update student burnout_risk_score
  await supabase.from('students')
    .update({ burnout_risk_score: riskScore })
    .eq('id', studentId)

  return {
    abandonmentRate,
    streakBreaks,
    difficultyTrend,
    durationTrend,
    sessionTimeDrift,
    riskScore,
    intervention
  }
}
