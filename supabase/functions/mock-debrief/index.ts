import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGemini, parseJSON } from '../_shared/gemini.ts'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { student_id, mock_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

    const [
      { data: student },
      { data: mock },
      { data: prevMocks },
      { data: practiceLogs }
    ] = await Promise.all([
      supabase.from('students').select('*').eq('id', student_id).single(),
      supabase.from('mock_results').select('*').eq('id', mock_id).single(),
      supabase.from('mock_results')
        .select('mock_date,overall_percentile,varc_percentile,dilr_percentile,quant_percentile')
        .eq('student_id', student_id)
        .neq('id', mock_id)
        .order('mock_date', { ascending: false })
        .limit(5),
      supabase.from('session_logs')
        .select('section,difficulty_rating')
        .eq('student_id', student_id)
        .in('session_type', ['Practice', 'Learn', 'Revise'])
        .gte('log_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        .not('difficulty_rating', 'is', null)
    ])

    const practiceAccuracy = (section: string) => {
      const sl = (practiceLogs || []).filter(l => l.section === section)
      if (!sl.length) return null
      return sl.reduce((s: number, l: { difficulty_rating: number }) =>
        s + (6 - l.difficulty_rating) / 5, 0) / sl.length
    }

    const daysRemaining = Math.max(0,
      Math.floor((new Date(student.exam_date).getTime() - Date.now()) / 86400000)
    )
    const phase = daysRemaining >= 180 ? 'Foundation' : daysRemaining >= 60 ? 'Acceleration' : daysRemaining >= 7 ? 'Crunch' : 'FinalWeek'

    const va = practiceAccuracy('VARC')
    const da = practiceAccuracy('DILR')
    const qa = practiceAccuracy('Quant')

    const prompt = `You are Goodluck's mock analysis engine. A CAT aspirant just completed a mock test.

Student: ${student.name}, targeting ${student.target_percentile} percentile
Phase: ${phase}, ${daysRemaining} days to CAT exam

Latest mock (${mock.source}):
Overall: ${mock.overall_percentile} percentile
VARC: score=${mock.varc_score ?? 'N/A'} | ${mock.varc_percentile ?? 'N/A'}%ile | accuracy=${mock.varc_accuracy != null ? (mock.varc_accuracy * 100).toFixed(0) + '%' : 'N/A'} | ${mock.varc_time_minutes ?? 'N/A'} min
DILR: score=${mock.dilr_score ?? 'N/A'} | ${mock.dilr_percentile ?? 'N/A'}%ile | accuracy=${mock.dilr_accuracy != null ? (mock.dilr_accuracy * 100).toFixed(0) + '%' : 'N/A'} | ${mock.dilr_time_minutes ?? 'N/A'} min
Quant: score=${mock.quant_score ?? 'N/A'} | ${mock.quant_percentile ?? 'N/A'}%ile | accuracy=${mock.quant_accuracy != null ? (mock.quant_accuracy * 100).toFixed(0) + '%' : 'N/A'} | ${mock.quant_time_minutes ?? 'N/A'} min

Previous mock trend:
${(prevMocks || []).map(m => `${m.mock_date}: ${m.overall_percentile}%ile (V:${m.varc_percentile ?? '?'} D:${m.dilr_percentile ?? '?'} Q:${m.quant_percentile ?? '?'})`).join('\n') || 'No previous mocks yet'}

Daily practice accuracy (last 30 days proxy):
VARC: ${va != null ? (va * 100).toFixed(0) + '%' : 'insufficient data'}
DILR: ${da != null ? (da * 100).toFixed(0) + '%' : 'insufficient data'}
Quant: ${qa != null ? (qa * 100).toFixed(0) + '%' : 'insufficient data'}

Return a JSON object:
{
  "headline": "one honest sentence about what this mock actually means",
  "three_things_to_fix": [
    {"issue": "specific problem from the data", "action": "concrete fix — never say just practice more"},
    {"issue": "specific problem", "action": "concrete fix"},
    {"issue": "specific problem", "action": "concrete fix"}
  ],
  "two_things_that_worked": [
    "specific strength from the data",
    "specific strength from the data"
  ],
  "plan_adjustment": "exactly what changes in next week's plan based on this mock",
  "choke_risk": false,
  "choke_note": null
}

Set choke_risk to true and fill choke_note if practice accuracy is significantly higher than mock accuracy in any section.
Tone: direct and honest. Like a coach who respects the student's intelligence. No false comfort. No panic.`

    const raw = await callGemini(prompt, GEMINI_API_KEY)

    interface MockDebrief {
      headline: string
      three_things_to_fix: Array<{ issue: string; action: string }>
      two_things_that_worked: string[]
      plan_adjustment: string
      choke_risk: boolean
      choke_note: string | null
    }

    let debrief: MockDebrief
    try {
      debrief = parseJSON<MockDebrief>(raw)
    } catch {
      return new Response(JSON.stringify({ error: 'Parse failed', raw }), { status: 500, headers: CORS })
    }

    // Save debrief
    await supabase.from('mock_results').update({ debrief }).eq('id', mock_id)

    // Recalibrate topic weights from section percentiles
    const sections = [
      { key: 'varc_percentile' as keyof typeof mock, section: 'VARC' },
      { key: 'dilr_percentile' as keyof typeof mock, section: 'DILR' },
      { key: 'quant_percentile' as keyof typeof mock, section: 'Quant' }
    ]

    for (const { key, section } of sections) {
      const pct = mock[key] as number | null
      if (pct == null) continue
      const delta = pct < 50 ? 0.15 : pct > 80 ? -0.10 : 0
      if (delta === 0) continue

      const { data: sectionTopics } = await supabase
        .from('topic_weights')
        .select('id,topic,weight')
        .eq('student_id', student_id)
        .eq('section', section)

      for (const t of sectionTopics || []) {
        const newWeight = Math.min(1.0, Math.max(0.1, t.weight + delta))
        await Promise.all([
          supabase.from('topic_weights')
            .update({ weight: newWeight, updated_at: new Date().toISOString() })
            .eq('id', t.id),
          supabase.from('adaptation_logs').insert({
            student_id,
            log_date: new Date().toISOString().split('T')[0],
            change_type: delta > 0 ? 'mock_weakness' : 'mock_strength',
            topic_affected: t.topic,
            reason: `${section} scored ${pct}%ile in ${mock.source} — ${delta > 0 ? 'increasing' : 'reducing'} priority for ${t.topic}`,
            previous_value: { weight: t.weight },
            new_value: { weight: newWeight },
            triggered_by: 'mock_result'
          })
        ])
      }
    }

    return new Response(JSON.stringify({ debrief }), { headers: CORS })

  } catch (err) {
    console.error('mock-debrief error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
