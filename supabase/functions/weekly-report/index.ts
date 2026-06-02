import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGemini, parseJSON } from '../_shared/gemini.ts'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { student_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

    // Compute current week Mon–Sun
    const now = new Date()
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const ws = mon.toISOString().split('T')[0]
    const we = sun.toISOString().split('T')[0]

    const [
      { data: student },
      { data: logs },
      { data: plans },
      { data: adaptations },
      { data: mocks },
      { data: weakTopics }
    ] = await Promise.all([
      supabase.from('students').select('*').eq('id', student_id).single(),
      supabase.from('session_logs').select('*')
        .eq('student_id', student_id).gte('log_date', ws).lte('log_date', we),
      supabase.from('daily_plans').select('sessions')
        .eq('student_id', student_id).gte('plan_date', ws).lte('plan_date', we),
      supabase.from('adaptation_logs').select('topic_affected,reason')
        .eq('student_id', student_id).gte('log_date', ws).lte('log_date', we),
      supabase.from('mock_results').select('id')
        .eq('student_id', student_id).gte('mock_date', ws).lte('mock_date', we),
      supabase.from('topic_weights').select('topic')
        .eq('student_id', student_id).gt('weight', 0.6)
        .order('weight', { ascending: false }).limit(5)
    ])

    const planned = (plans || []).reduce((s, p) =>
      s + ((p.sessions as unknown[]) || []).length, 0)
    const completed = (logs || []).filter(l => l.completed).length
    const topics = [...new Set((logs || []).map(l => l.topic))]
    const rated = (logs || []).filter(l => l.difficulty_rating && l.focus_rating)
    const avgDiff = rated.length
      ? rated.reduce((s, l) => s + l.difficulty_rating, 0) / rated.length : 0
    const avgFocus = rated.length
      ? rated.reduce((s, l) => s + l.focus_rating, 0) / rated.length : 0
    const daysRemaining = Math.max(0,
      Math.floor((new Date(student.exam_date).getTime() - Date.now()) / 86400000))
    const phase = daysRemaining >= 180 ? 'Foundation' : daysRemaining >= 60 ? 'Acceleration' : daysRemaining >= 7 ? 'Crunch' : 'FinalWeek'
    const rate = planned > 0 ? Math.round((completed / planned) * 100) : 0

    const prompt = `You are Goodluck's weekly coach for a CAT aspirant.

Student: ${student.name}, targeting ${student.target_percentile} percentile
Phase: ${phase}, ${daysRemaining} days to exam
Burnout risk score: ${(student.burnout_risk_score * 100).toFixed(0)}%

This week's data (${ws} to ${we}):
Sessions completed: ${completed} of ${planned} planned (${rate}%)
Topics studied: ${topics.join(', ') || 'none logged this week'}
Mock tests taken: ${(mocks || []).length}
Average difficulty rating: ${avgDiff.toFixed(1)}/5
Average focus rating: ${avgFocus.toFixed(1)}/5
Current weak topics: ${(weakTopics || []).map(t => t.topic).join(', ') || 'none'}
Plan adaptations this week: ${(adaptations || []).map(a => `${a.topic_affected}: ${a.reason}`).join(' | ') || 'none'}

${student.burnout_risk_score > 0.5 ? 'Note: burnout risk is elevated. Acknowledge fatigue without dwelling on it.' : ''}

Return a JSON object:
{
  "headline": "one honest sentence specific to the actual numbers — never generic",
  "what_worked": "2-3 sentences on genuine wins grounded in real data from this week",
  "what_to_watch": "one specific behavioral pattern the data reveals — direct but not harsh",
  "one_change": "the single most important thing to do differently next week — specific and actionable",
  "adaptation_summary": "plain language explanation of what changed in the plan this week and exactly why",
  "encouragement": "2 sentences grounded in actual progress data — not generic motivation"
}

Tone: coach who has seen every number and genuinely cares. Direct. Warm. Never preachy.`

    const raw = await callGemini(prompt, GEMINI_API_KEY)

    interface WeeklyNarrative {
      headline: string
      what_worked: string
      what_to_watch: string
      one_change: string
      adaptation_summary: string
      encouragement: string
    }

    let narrative: WeeklyNarrative
    try {
      narrative = parseJSON<WeeklyNarrative>(raw)
    } catch {
      return new Response(JSON.stringify({ error: 'Parse failed', raw }), { status: 500, headers: CORS })
    }

    const { data: report } = await supabase.from('weekly_reports').upsert({
      student_id,
      week_start: ws,
      week_end: we,
      sessions_planned: planned,
      sessions_completed: completed,
      topics_covered: topics,
      weak_topics: (weakTopics || []).map(t => t.topic),
      adaptation_changes: adaptations || [],
      mock_count: (mocks || []).length,
      narrative,
      generated_at: new Date().toISOString()
    }, { onConflict: 'student_id,week_start' }).select().single()

    return new Response(JSON.stringify(report), { headers: CORS })

  } catch (err) {
    console.error('weekly-report error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
