import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildWeeklyReportPrompt } from '@/lib/ai/prompts'
import { computeCountdown } from '@/lib/engine/countdown'
import { callGemini, parseJSON } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  try {
    const { student_id } = await req.json()
    if (!student_id) {
      return NextResponse.json({ error: 'student_id required' }, { status: 400 })
    }

    const supabase = createServerClient()
    const geminiKey = process.env.GEMINI_API_KEY
    const apiKey = process.env.ANTHROPIC_API_KEY

    const now = new Date()
    const weekStart = new Date(now)
    // Find Monday of the current week
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const wsStr = weekStart.toISOString().split('T')[0]
    const weStr = weekEnd.toISOString().split('T')[0]

    // 1. Fetch student profile
    const { data: student } = await supabase.from('students').select('*').eq('id', student_id).single()
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    // 2. Fetch logged sessions this week
    const { data: logs } = await supabase
      .from('session_logs')
      .select('*')
      .eq('student_id', student_id)
      .gte('log_date', wsStr)
      .lte('log_date', weStr)

    // 3. Fetch planned sessions this week
    const { data: plans } = await supabase
      .from('daily_plans')
      .select('sessions')
      .eq('student_id', student_id)
      .gte('plan_date', wsStr)
      .lte('plan_date', weStr)

    // 4. Fetch adaptations this week
    const { data: adaptations } = await supabase
      .from('adaptation_logs')
      .select('topic_affected,reason,change_type')
      .eq('student_id', student_id)
      .gte('log_date', wsStr)
      .lte('log_date', weStr)

    // 5. Fetch mocks taken this week
    const { data: mocks } = await supabase
      .from('mock_results')
      .select('id')
      .eq('student_id', student_id)
      .gte('mock_date', wsStr)
      .lte('mock_date', weStr)

    // 6. Fetch weak topics (weight > 0.6)
    const { data: weakTopics } = await supabase
      .from('topic_weights')
      .select('topic')
      .eq('student_id', student_id)
      .gt('weight', 0.6)
      .order('weight', { ascending: false })
      .limit(5)

    const plannedCount = (plans || []).reduce((s: number, p: any) => s + ((p.sessions as unknown[]) || []).length, 0)
    const completedCount = (logs || []).filter((l: any) => l.completed).length
    const uniqueTopicsStudied = Array.from(new Set((logs || []).map((l: any) => l.topic)))
    
    const ratedLogs = (logs || []).filter((l: any) => l.difficulty_rating != null && l.focus_rating != null)
    const avgDiff = ratedLogs.length ? ratedLogs.reduce((s: number, l: any) => s + (l.difficulty_rating || 0), 0) / ratedLogs.length : 0.0
    const avgFocus = ratedLogs.length ? ratedLogs.reduce((s: number, l: any) => s + (l.focus_rating || 0), 0) / ratedLogs.length : 0.0

    const countdown = computeCountdown(student.exam_date)

    let narrative: {
      headline: string;
      what_worked: string;
      what_to_watch: string;
      one_change: string;
      adaptation_summary: string;
      encouragement: string;
    }

    if (geminiKey) {
      // 🚀 Call Gemini API
      console.log('Using Gemini 2.0 Flash API for weekly report.')
      
      const prompt = `You are Goodluck's weekly coach for a CAT aspirant.

Student: ${student.name}, targeting ${student.target_percentile} percentile
Phase: ${countdown.phase}, ${countdown.daysRemaining} days to exam
Burnout risk score: ${(Number(student.burnout_risk_score || 0) * 100).toFixed(0)}%

This week's data (${wsStr} to ${weStr}):
Sessions completed: ${completedCount} of ${plannedCount} planned (${plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0}%)
Topics studied: ${uniqueTopicsStudied.join(', ') || 'none logged this week'}
Mock tests taken: ${(mocks || []).length}
Average difficulty rating: ${avgDiff.toFixed(1)}/5
Average focus rating: ${avgFocus.toFixed(1)}/5
Current weak topics: ${(weakTopics || []).map((t: any) => t.topic).join(', ') || 'none'}
Plan adaptations this week: ${(adaptations || []).map((a: any) => `${a.topic_affected}: ${a.reason}`).join(' | ') || 'none'}

${Number(student.burnout_risk_score || 0) > 0.5 ? 'Note: burnout risk is elevated. Acknowledge fatigue without dwelling on it.' : ''}

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

      const raw = await callGemini(prompt, geminiKey, 'application/json')
      try {
        narrative = parseJSON(raw)
      } catch {
        return NextResponse.json({ error: 'Gemini response parsing failed', raw }, { status: 500 })
      }
    } else if (apiKey) {
      const anthropic = new Anthropic({ apiKey })

      // 7. Build weekly report prompt
      const prompt = buildWeeklyReportPrompt({
        name: student.name,
        targetPercentile: student.target_percentile,
        phase: countdown.phase,
        daysRemaining: countdown.daysRemaining,
        weekStats: {
          sessionsPlanned: plannedCount,
          sessionsCompleted: completedCount,
          topicsCovered: uniqueTopicsStudied as string[],
          weakTopics: (weakTopics || []).map((t: any) => t.topic),
          mockCount: (mocks || []).length,
          avgDifficulty: avgDiff,
          avgFocus: avgFocus,
        },
        adaptationChanges: (adaptations || []).map((a: any) => ({
          topic: a.topic_affected || 'General',
          reason: a.reason,
          changeType: a.change_type,
        })),
        burnoutRiskScore: Number(student.burnout_risk_score || 0),
      })

      // 8. Call Anthropic Claude API
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      try {
        narrative = JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim())
      } catch {
        return NextResponse.json({ error: 'Claude response parsing failed', raw }, { status: 500 })
      }
    } else {
      // 🚀 Smart Local Heuristic Fallback
      console.log('No Gemini or Anthropic key found. Using smart local heuristic fallback.');
      
      const compRate = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;
      let headline = `Rolling velocity reached ${completedCount}/${plannedCount} planned blocks (${compRate}%), reflecting extremely steady and focused execution momentum.`;
      if (compRate < 75) {
        headline = `Rolling execution completed ${completedCount}/${plannedCount} planned blocks (${compRate}%), indicating calendar friction and a mild velocity drop.`;
      } else if (compRate >= 90) {
        headline = `Superb weekly completion at ${completedCount}/${plannedCount} blocks (${compRate}%), maintaining peak tactical pacing and concept coverage.`;
      }
      
      let what_worked = `Your VARC practice has remained highly active, maintaining stable focus ratings (~${avgFocus > 0 ? avgFocus.toFixed(1) : '4.0'}/5) across completed sessions. Additionally, scheduling study slots during your ${student.peak_energy_window} peak energy zone has stabilized topic comprehension.`;
      if (uniqueTopicsStudied.length > 0) {
        what_worked += ` Concept reinforcement in ${uniqueTopicsStudied.slice(0, 2).join(', ')} is showing active retention gains.`;
      }
      
      let what_to_watch = "Watch out for topic avoidance on high weight subjects. Omitted topics compound over time; today's study block is key.";
      if (Number(student.burnout_risk_score) > 0.65) {
        what_to_watch = `Rolling fatigue has risen to ${Math.round(Number(student.burnout_risk_score) * 100)}%. Avoid compressing study slots into late-night hours to prevent cognitive decay.`;
      }
      
      const weakList = (weakTopics || []).map((t: any) => t.topic);
      let adaptation_summary = "Priorities have adapted automatically, scaling attention weights to increase active recall frequency.";
      if (weakList.length > 0) {
        adaptation_summary = `Adaptation engine scaled weights for ${weakList.slice(0, 2).join(' and ')} upward to expand drill frequencies next week.`;
      }
      
      narrative = {
        headline,
        what_worked,
        what_to_watch,
        one_change: "Commit to completing at least one sectional Quant drill early in your focus zone to secure core momentum.",
        adaptation_summary,
        encouragement: "Execution is not about having a perfect record; it's about showing up today regardless of yesterday's miss."
      };
    }

    // 9. Upsert report inside weekly_reports
    const { data: report, error: reportError } = await supabase
      .from('weekly_reports')
      .upsert({
        student_id,
        week_start: wsStr,
        week_end: weStr,
        sessions_planned: plannedCount,
        sessions_completed: completedCount,
        topics_covered: uniqueTopicsStudied as string[],
        weak_topics: (weakTopics || []).map((t: any) => t.topic),
        adaptation_changes: adaptations || [],
        mock_count: (mocks || []).length,
        narrative,
        generated_at: new Date().toISOString()
      }, { onConflict: 'student_id,week_start' })
      .select()
      .single()

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }

    return NextResponse.json(report)
  } catch (err) {
    console.error('weekly-report error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
