import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { callGemini } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  try {
    const { student_id } = await req.json()
    if (!student_id) {
      return NextResponse.json({ error: 'student_id required' }, { status: 400 })
    }

    const supabase = createServerClient()
    const geminiKey = process.env.GEMINI_API_KEY
    const apiKey = process.env.ANTHROPIC_API_KEY

    // 1. Fetch student details
    const { data: student } = await supabase.from('students').select('*').eq('id', student_id).single()
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    // 2. Fetch latest burnout score records
    const { data: latestBurnout } = await supabase
      .from('burnout_scores')
      .select('*')
      .eq('student_id', student_id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const examDate = new Date(student.exam_date)
    const daysRemaining = Math.max(0, Math.floor((examDate.getTime() - new Date().getTime()) / 86400000))
    const prepDay = Math.floor((new Date().getTime() - new Date(student.created_at).getTime()) / 86400000)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const fromDate = sevenDaysAgo.toISOString().split('T')[0]

    // 3. Fetch logs and plans for the last 7 days
    const { data: weekLogs } = await supabase
      .from('session_logs')
      .select('completed')
      .eq('student_id', student_id)
      .gte('log_date', fromDate)

    const { data: weekPlans } = await supabase
      .from('daily_plans')
      .select('sessions')
      .eq('student_id', student_id)
      .gte('plan_date', fromDate)

    const plannedSessions = (weekPlans || []).reduce((s: number, p: any) => s + ((p.sessions as unknown[]) || []).length, 0)
    const completedSessions = (weekLogs || []).filter((l: any) => l.completed).length

    let message = '';

    if (geminiKey) {
      // 🚀 Call Gemini API
      console.log('Using Gemini 2.0 Flash API for burnout message.')
      
      const prompt = `You are Goodluck's care layer. A student's execution data is showing burnout signals.

Student: ${student.name}, Day ${prepDay} of their prep journey, ${daysRemaining} days to CAT
Sessions this week: ${completedSessions} of ${plannedSessions}
Sessions abandoned or skipped (last 7 days): ${Math.round((latestBurnout?.abandonment_rate_7d || 0) * 10)}
Days with zero sessions this week: ${latestBurnout?.streak_breaks_7d || 0}

Write exactly 3-4 sentences that:
1. Acknowledge what the data shows without any judgment
2. Normalize the genuine difficulty of sustaining 12 months of focused preparation
3. Offer one small, concrete, achievable next step

Absolute rules:
- No greeting, no "Hey", no signature
- No JSON, no formatting — just the message text
- Never use: "you've got this", "keep going", "I believe in you", "hang in there", "you can do it"
- This student is intelligent. They will immediately detect hollow encouragement.
- Say something real and specific to their situation.`

      const raw = await callGemini(prompt, geminiKey)
      message = raw.trim()
    } else if (apiKey) {
      const anthropic = new Anthropic({ apiKey })

      // 4. Build prompt
      const prompt = `You are Goodluck's care layer. A student's execution data is showing burnout signals.

Student: ${student.name}, Day ${prepDay} of their prep journey, ${daysRemaining} days to CAT
Sessions this week: ${completedSessions} of ${plannedSessions}
Sessions abandoned or skipped (last 7 days): ${Math.round((latestBurnout?.abandonment_rate_7d || 0) * 10)}
Days with zero sessions this week: ${latestBurnout?.streak_breaks_7d || 0}

Write exactly 3-4 sentences that:
1. Acknowledge what the data shows without any judgment
2. Normalize the genuine difficulty of sustaining 12 months of focused preparation
3. Offer one small, concrete, achievable next step

Absolute rules:
- No greeting, no "Hey", no signature
- No JSON, no formatting — just the message text
- Never use: "you've got this", "keep going", "I believe in you", "hang in there", "you can do it"
- This student is intelligent. They will immediately detect hollow encouragement.
- Say something real and specific to their situation.`

      // 5. Call Anthropic Claude API
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })

      message = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    } else {
      // 🚀 Smart Local Heuristic Fallback
      console.log('No Gemini or Anthropic key found. Using smart local heuristic fallback.');
      
      const streakBreaks = latestBurnout?.streak_breaks_7d || 0;
      message = `Your study metrics show you completed ${completedSessions} of ${plannedSessions} sessions this week, with ${streakBreaks} days of zero sessions as fatigue has built up. Sustaining rigorous preparation for a high-stakes exam like CAT is an immense mental marathon, and hitting a wall is a normal biological signal rather than an execution failure. For your next slot, bypass all full-length problem sets and do just one light, 15-minute concept revision on a topic you are comfortable with. Keep the pressure low today so your cognitive system can decompress and reset.`;
    }
    
    return NextResponse.json({ message })
  } catch (err) {
    console.error('burnout-message error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
