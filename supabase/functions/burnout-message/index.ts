import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { student_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

    const [{ data: student }, { data: latest }] = await Promise.all([
      supabase.from('students').select('*').eq('id', student_id).single(),
      supabase.from('burnout_scores').select('*')
        .eq('student_id', student_id)
        .order('computed_at', { ascending: false })
        .limit(1)
        .single()
    ])

    const daysRemaining = Math.max(0,
      Math.floor((new Date(student.exam_date).getTime() - Date.now()) / 86400000))
    const prepDay = Math.floor((Date.now() - new Date(student.created_at).getTime()) / 86400000)

    const sevenAgo = new Date()
    sevenAgo.setDate(sevenAgo.getDate() - 7)

    const [{ data: wLogs }, { data: wPlans }] = await Promise.all([
      supabase.from('session_logs').select('completed')
        .eq('student_id', student_id)
        .gte('log_date', sevenAgo.toISOString().split('T')[0]),
      supabase.from('daily_plans').select('sessions')
        .eq('student_id', student_id)
        .gte('plan_date', sevenAgo.toISOString().split('T')[0])
    ])

    const planned = (wPlans || []).reduce((s, p) =>
      s + ((p.sessions as unknown[]) || []).length, 0)
    const done = (wLogs || []).filter(l => l.completed).length

    const prompt = `You are Goodluck's care layer. A student's execution data is showing burnout signals.

Student: ${student.name}, Day ${prepDay} of their prep, ${daysRemaining} days to CAT
Sessions this week: ${done} completed out of ${planned} planned
Sessions abandoned or skipped in last 7 days: ${Math.round((latest?.abandonment_rate_7d || 0) * 10)}
Days with zero sessions this week: ${latest?.streak_breaks_7d || 0}

Write exactly 3-4 sentences:
1. Acknowledge what the data shows without any judgment
2. Normalize the genuine difficulty of maintaining execution over 12 months
3. Offer one small, concrete, achievable next step

Rules:
- No greeting, no signature
- Return plain text only — not JSON
- Never use: "you've got this", "keep going", "I believe in you", "hang in there", "you can do it"
- This student is intelligent and will detect hollow encouragement immediately
- Say something real and specific to their actual situation`

    // Burnout message uses plain text — use direct fetch not shared callGemini
    const response = await fetch(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
          // No responseMimeType here — we want plain text
        },
      }),
    })

    const data = await response.json()
    const message = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

    return new Response(JSON.stringify({ message }), { headers: CORS })

  } catch (err) {
    console.error('burnout-message error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS })
  }
})
