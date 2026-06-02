import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGemini, parseJSON } from '../_shared/gemini.ts'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

const PHASE_RULES: Record<string, string> = {
  Foundation: 'Prioritize concept coverage. Mock max 1 per 3 weeks. All session types allowed.',
  Acceleration: 'Mock minimum 1 per week. Prioritize weak topics aggressively. All session types.',
  Crunch: 'NO Learn sessions. Revise/Practice/Mock/Recovery only. Mock every 3 days.',
  FinalWeek: 'MAX 1 session total. Revise or Recovery ONLY. No mocks. No new topics.',
}

function getPhase(days: number) {
  return days >= 180 ? 'Foundation' : days >= 60 ? 'Acceleration' : days >= 7 ? 'Crunch' : 'FinalWeek'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { student_id, force_regenerate } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
    const today = new Date().toISOString().split('T')[0]

    // Return cached plan if exists and not force regenerating
    if (!force_regenerate) {
      const { data: existing } = await supabase
        .from('daily_plans')
        .select('*')
        .eq('student_id', student_id)
        .eq('plan_date', today)
        .single()
      if (existing) return new Response(JSON.stringify(existing), { headers: CORS })
    }

    // Fetch all needed data in parallel
    const [
      { data: student },
      { data: weights },
      { data: recentLogs }
    ] = await Promise.all([
      supabase.from('students').select('*').eq('id', student_id).single(),
      supabase.from('topic_weights')
        .select('topic,section,weight,coverage_percent,avoidance_flag,last_studied')
        .eq('student_id', student_id)
        .order('weight', { ascending: false }),
      supabase.from('session_logs')
        .select('topic,section,session_type,difficulty_rating,focus_rating,completed,log_date')
        .eq('student_id', student_id)
        .order('log_date', { ascending: false })
        .limit(14)
    ])

    if (!student) {
      return new Response(JSON.stringify({ error: 'Student not found' }), { status: 404, headers: CORS })
    }

    const daysRemaining = Math.max(0,
      Math.floor((new Date(student.exam_date).getTime() - Date.now()) / 86400000)
    )
    const phase = getPhase(daysRemaining)
    const isWeekend = [0, 6].includes(new Date().getDay())
    const hours = isWeekend ? student.available_hours_weekend : student.available_hours_weekday

    const prompt = `You are Goodluck's planning engine. Generate a daily CAT preparation plan.

Student: ${student.name}
Exam date: ${student.exam_date} (${daysRemaining} days remaining)
Current phase: ${phase}
Target percentile: ${student.target_percentile}
Available hours today: ${hours}h (${isWeekend ? 'weekend' : 'weekday'})
Peak energy window: ${student.peak_energy_window}
Biggest fear: ${student.biggest_fear || 'not specified'}

Topic weights (higher weight = needs more attention, avoidance_flag = student is avoiding this topic):
${JSON.stringify(weights || [])}

Recent 14 sessions:
${JSON.stringify(recentLogs || [])}

Phase rules: ${PHASE_RULES[phase]}

Return a JSON object with exactly this structure:
{
  "sessions": [
    {
      "topic": "exact topic name from the weights list above",
      "section": "VARC or DILR or Quant",
      "session_type": "Learn or Revise or Practice or Mock or Recovery",
      "duration_minutes": 45,
      "rationale": "one specific sentence referencing actual student data"
    }
  ],
  "rationale": "2-3 sentences on today's overall strategy specific to this student",
  "dynamic_alerts": [
    {
      "alert_type": "coverage_gap or pace_alert or revision_debt or mock_frequency or avoidance_pattern",
      "message": "specific honest message with real numbers",
      "severity": "info or warning or critical"
    }
  ]
}

Hard rules:
- Total session duration must not exceed ${Math.floor(hours * 60)} minutes
- Maximum 4 sessions per day
- Topics with avoidance_flag true MUST be included — never skip them
- Phase constraint: ${phase === 'Crunch' ? 'NO Learn sessions allowed' : phase === 'FinalWeek' ? 'Revise or Recovery ONLY, max 1 session' : 'All session types allowed'}
- Schedule highest weight topics during ${student.peak_energy_window}
- Only include dynamic_alerts if genuinely warranted — do not fabricate
- Every rationale must reference specific topics, ratings, or days remaining — never write generic advice`

    const raw = await callGemini(prompt, GEMINI_API_KEY)

    interface PlanSession {
      topic: string
      section: string
      session_type: string
      duration_minutes: number
      rationale: string
    }

    interface ParsedPlan {
      sessions: PlanSession[]
      rationale: string
      dynamic_alerts: Array<{ alert_type: string; message: string; severity: string }>
    }

    let parsed: ParsedPlan
    try {
      parsed = parseJSON<ParsedPlan>(raw)
    } catch {
      return new Response(JSON.stringify({ error: 'Gemini parse failed', raw }), { status: 500, headers: CORS })
    }

    // Enforce phase constraints on response
    if (phase === 'Crunch') {
      parsed.sessions = parsed.sessions.filter(s => s.session_type !== 'Learn')
    }
    if (phase === 'FinalWeek') {
      parsed.sessions = parsed.sessions
        .filter(s => ['Revise', 'Recovery'].includes(s.session_type))
        .slice(0, 1)
    }

    const sessions = parsed.sessions.map(s => ({ ...s, status: 'pending' }))

    // Upsert plan
    const { data: plan, error: planErr } = await supabase
      .from('daily_plans')
      .upsert({
        student_id,
        plan_date: today,
        prep_phase: phase,
        days_remaining: daysRemaining,
        sessions,
        rationale: parsed.rationale || '',
        dynamic_alerts: parsed.dynamic_alerts || [],
        generated_at: new Date().toISOString()
      }, { onConflict: 'student_id,plan_date' })
      .select()
      .single()

    if (planErr) {
      return new Response(JSON.stringify({ error: planErr.message }), { status: 500, headers: CORS })
    }

    // Update phase if changed
    if (student.prep_phase !== phase) {
      await Promise.all([
        supabase.from('students')
          .update({ prep_phase: phase, updated_at: new Date().toISOString() })
          .eq('id', student_id),
        supabase.from('adaptation_logs').insert({
          student_id,
          log_date: today,
          change_type: 'phase_transition',
          reason: `Entered ${phase} phase — ${daysRemaining} days remaining. Plan logic recalibrated automatically.`,
          triggered_by: 'countdown_engine'
        })
      ])
    }

    // Persist alerts
    if (parsed.dynamic_alerts?.length) {
      await supabase.from('dynamic_alerts').insert(
        parsed.dynamic_alerts.map(a => ({
          student_id,
          alert_date: today,
          alert_type: a.alert_type,
          message: a.message,
          severity: a.severity,
          dismissed: false
        }))
      )
    }

    return new Response(JSON.stringify(plan), { headers: CORS })

  } catch (err) {
    console.error('generate-plan error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
