import { SupabaseClient } from '@supabase/supabase-js'
import { SessionLog, TopicWeight } from '@/types'

const WEIGHT_MAX = 1.0
const WEIGHT_MIN = 0.1

interface AdaptationChange {
  topic: string
  section: string
  previousWeight: number
  newWeight: number
  reason: string
  changeType: string
}

export async function runAdaptation(
  studentId: string,
  supabase: SupabaseClient
): Promise<AdaptationChange[]> {
  const changes: AdaptationChange[] = []

  // Fetch last 21 session logs
  const { data: logs } = await supabase
    .from('session_logs')
    .select('*')
    .eq('student_id', studentId)
    .order('log_date', { ascending: false })
    .limit(21)

  if (!logs || logs.length === 0) return changes

  // Fetch all topic weights
  const { data: weights } = await supabase
    .from('topic_weights')
    .select('*')
    .eq('student_id', studentId)

  if (!weights) return changes

  const weightMap = new Map<string, TopicWeight>(weights.map(w => [w.topic, w]))

  // Group logs by topic
  const byTopic = new Map<string, SessionLog[]>()
  for (const log of logs) {
    if (!byTopic.has(log.topic)) byTopic.set(log.topic, [])
    byTopic.get(log.topic)!.push(log)
  }

  const now = new Date().toISOString().split('T')[0]

  for (const [topic, topicLogs] of Array.from(byTopic.entries())) {
    const weight = weightMap.get(topic)
    if (!weight) continue

    let newWeight = weight.weight
    let reason = ''
    let changeType = ''
    let changed = false

    // Rule 1: High difficulty over last 3 sessions → increase weight
    const last3 = topicLogs.slice(0, 3)
    if (last3.length >= 3 && last3.every(l => l.difficulty_rating != null)) {
      const avgDifficulty = last3.reduce((s, l) => s + (l.difficulty_rating || 0), 0) / last3.length
      if (avgDifficulty > 3.5) {
        newWeight = Math.min(WEIGHT_MAX, weight.weight + 0.1)
        reason = `Consistently rated difficult (avg ${avgDifficulty.toFixed(1)}/5 over last 3 sessions) — scheduling more frequently`
        changeType = 'difficulty_increase'
        changed = true
      } else if (avgDifficulty < 2.0) {
        newWeight = Math.max(WEIGHT_MIN, weight.weight - 0.1)
        reason = `Consistently rated easy (avg ${avgDifficulty.toFixed(1)}/5 over last 3 sessions) — reducing frequency`
        changeType = 'difficulty_decrease'
        changed = true
      }
    }

    // Rule 2: Avoidance pattern — 3+ skips/abandonments in last 10
    const last10 = topicLogs.slice(0, 10)
    const abandonCount = last10.filter(l => !l.completed || l.abandoned_at_minute != null).length
    if (abandonCount >= 3 && !weight.avoidance_flag) {
      await supabase.from('topic_weights').update({ avoidance_flag: true })
        .eq('student_id', studentId).eq('topic', topic)
      reason = `Skipped or abandoned ${abandonCount} times recently — flagged as avoidance pattern`
      changeType = 'avoidance_flagged'
      changed = true
    }

    // Rule 3: Not studied in 7+ days → nudge weight up slightly
    if (weight.last_studied) {
      const daysSince = Math.floor(
        (new Date(now).getTime() - new Date(weight.last_studied).getTime()) / 86400000
      )
      if (daysSince >= 7 && !changed) {
        newWeight = Math.min(WEIGHT_MAX, weight.weight + 0.05)
        reason = `Not studied in ${daysSince} days — increasing priority`
        changeType = 'staleness_nudge'
        changed = true
      }
    }

    if (changed && Math.abs(newWeight - weight.weight) > 0.001) {
      // Update topic weight
      await supabase.from('topic_weights')
        .update({ weight: newWeight, updated_at: new Date().toISOString() })
        .eq('student_id', studentId).eq('topic', topic)

      // Write adaptation log
      await supabase.from('adaptation_logs').insert({
        student_id: studentId,
        log_date: now,
        change_type: changeType,
        topic_affected: topic,
        reason,
        previous_value: { weight: weight.weight },
        new_value: { weight: newWeight },
        triggered_by: 'session_log'
      })

      changes.push({
        topic,
        section: weight.section,
        previousWeight: weight.weight,
        newWeight,
        reason,
        changeType
      })
    }
  }

  return changes
}
