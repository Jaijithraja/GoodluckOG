import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildMockDebriefPrompt } from '@/lib/ai/prompts'
import { computeCountdown } from '@/lib/engine/countdown'
import { callGemini, parseJSON } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  try {
    const { student_id, mock_id } = await req.json()
    if (!student_id || !mock_id) {
      return NextResponse.json({ error: 'student_id and mock_id required' }, { status: 400 })
    }

    const supabase = createServerClient()
    const geminiKey = process.env.GEMINI_API_KEY
    const apiKey = process.env.ANTHROPIC_API_KEY

    // 1. Fetch student details
    const { data: student } = await supabase.from('students').select('*').eq('id', student_id).single()
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    // 2. Fetch current mock
    const { data: mock } = await supabase.from('mock_results').select('*').eq('id', mock_id).single()
    if (!mock) {
      return NextResponse.json({ error: 'Mock result not found' }, { status: 404 })
    }

    // 3. Fetch past mocks for trend (up to 5)
    const { data: prevMocks } = await supabase
      .from('mock_results')
      .select('mock_date,overall_percentile,varc_percentile,dilr_percentile,quant_percentile')
      .eq('student_id', student_id)
      .neq('id', mock_id)
      .order('mock_date', { ascending: false })
      .limit(5)

    // 4. Calculate practice accuracy proxy (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0]

    const { data: practiceLogs } = await supabase
      .from('session_logs')
      .select('section,difficulty_rating')
      .eq('student_id', student_id)
      .in('session_type', ['Practice', 'Learn', 'Revise'])
      .gte('log_date', fromDate)
      .not('difficulty_rating', 'is', null)

    const calcPracticeAccuracy = (section: string) => {
      const sectionLogs = (practiceLogs || []).filter((l: any) => l.section === section)
      if (!sectionLogs.length) return 0.70 // Default proxy fallback
      // Invert difficulty rating as accuracy proxy (difficulty 1 = 100% accuracy proxy, 5 = 20%)
      const sum = sectionLogs.reduce((s: number, l: any) => s + ((6 - (l.difficulty_rating || 3)) / 5), 0)
      return sum / sectionLogs.length
    }

    const countdown = computeCountdown(student.exam_date)

    const varcPractice = calcPracticeAccuracy('VARC')
    const dilrPractice = calcPracticeAccuracy('DILR')
    const quantPractice = calcPracticeAccuracy('Quant')

    let debrief: {
      headline: string;
      three_things_to_fix: Array<{ issue: string; action: string }>;
      two_things_that_worked: string[];
      plan_adjustment: string;
      choke_risk: boolean;
      choke_note: string;
    }

    if (geminiKey) {
      // 🚀 Call Gemini API
      console.log('Using Gemini 2.0 Flash API for mock debrief.')
      
      const prompt = `You are Goodluck's mock analysis engine. A CAT aspirant just completed a mock test.

Student: ${student.name}, targeting ${student.target_percentile} percentile
Phase: ${countdown.phase}, ${countdown.daysRemaining} days to CAT exam

Latest mock (${mock.source}):
Overall: ${mock.overall_percentile} percentile
VARC: score=${mock.varc_score ?? 'N/A'} | ${mock.varc_percentile ?? 'N/A'}%ile | accuracy=${mock.varc_accuracy != null ? (mock.varc_accuracy * 100).toFixed(0) + '%' : 'N/A'} | ${mock.varc_time_minutes ?? 'N/A'} min
DILR: score=${mock.dilr_score ?? 'N/A'} | ${mock.dilr_percentile ?? 'N/A'}%ile | accuracy=${mock.dilr_accuracy != null ? (mock.dilr_accuracy * 100).toFixed(0) + '%' : 'N/A'} | ${mock.dilr_time_minutes ?? 'N/A'} min
Quant: score=${mock.quant_score ?? 'N/A'} | ${mock.quant_percentile ?? 'N/A'}%ile | accuracy=${mock.quant_accuracy != null ? (mock.quant_accuracy * 100).toFixed(0) + '%' : 'N/A'} | ${mock.quant_time_minutes ?? 'N/A'} min

Previous mock trend:
${(prevMocks || []).map((m: any) => `${m.mock_date}: ${m.overall_percentile}%ile (V:${m.varc_percentile ?? '?'} D:${m.dilr_percentile ?? '?'} Q:${m.quant_percentile ?? '?'})`).join('\n') || 'No previous mocks yet'}

Daily practice accuracy (last 30 days proxy):
VARC: ${varcPractice != null ? (varcPractice * 100).toFixed(0) + '%' : 'insufficient data'}
DILR: ${dilrPractice != null ? (dilrPractice * 100).toFixed(0) + '%' : 'insufficient data'}
Quant: ${quantPractice != null ? (quantPractice * 100).toFixed(0) + '%' : 'insufficient data'}

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

      const raw = await callGemini(prompt, geminiKey, 'application/json')
      try {
        debrief = parseJSON(raw)
      } catch {
        return NextResponse.json({ error: 'Gemini response parsing failed', raw }, { status: 500 })
      }
    } else if (apiKey) {
      const anthropic = new Anthropic({ apiKey })

      // 5. Build prompt
      const prompt = buildMockDebriefPrompt({
        name: student.name,
        targetPercentile: student.target_percentile,
        phase: countdown.phase,
        daysRemaining: countdown.daysRemaining,
        currentMock: {
          source: mock.source,
          overall_percentile: Number(mock.overall_percentile),
          varc: {
            score: Number(mock.varc_score || 0),
            percentile: Number(mock.varc_percentile || 50),
            accuracy: Number(mock.varc_accuracy || 0.70),
            time: Number(mock.varc_time_minutes || 40),
          },
          dilr: {
            score: Number(mock.dilr_score || 0),
            percentile: Number(mock.dilr_percentile || 50),
            accuracy: Number(mock.dilr_accuracy || 0.70),
            time: Number(mock.dilr_time_minutes || 40),
          },
          quant: {
            score: Number(mock.quant_score || 0),
            percentile: Number(mock.quant_percentile || 50),
            accuracy: Number(mock.quant_accuracy || 0.70),
            time: Number(mock.quant_time_minutes || 40),
          }
        },
        previousMocks: (prevMocks || []).map((pm: any) => ({
          date: pm.mock_date,
          overall_percentile: Number(pm.overall_percentile),
          varc_percentile: Number(pm.varc_percentile || 50),
          dilr_percentile: Number(pm.dilr_percentile || 50),
          quant_percentile: Number(pm.quant_percentile || 50),
        })),
        practiceAccuracy: {
          varc: varcPractice,
          dilr: dilrPractice,
          quant: quantPractice,
        }
      })

      // 6. Call Anthropic Claude API
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      try {
        debrief = JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim())
      } catch {
        return NextResponse.json({ error: 'Claude response parsing failed', raw }, { status: 500 })
      }
    } else {
      // 🚀 Smart Local Heuristic Fallback
      console.log('No Gemini or Anthropic key found. Using smart local heuristic fallback.');
      
      const overall = Number(mock.overall_percentile || 50);
      const varcPct = Number(mock.varc_percentile || 50);
      const dilrPct = Number(mock.dilr_percentile || 50);
      const quantPct = Number(mock.quant_percentile || 50);
      const targetPct = Number(student.target_percentile || 99);
      
      let headline = `Overall performance of ${overall}%ile indicates competitive progress, but key sectional gaps must be closed to hit your ${targetPct}%ile target.`;
      if (overall < targetPct - 8) {
        headline = `Diagnostic score of ${overall}%ile reveals a sharp deviation from your ${targetPct}%ile target, requiring immediate sectional interventions.`;
      } else if (overall >= targetPct) {
        headline = `Excellent performance at ${overall}%ile meets IIM target parameters; focus now shifts to speed stabilization and error minimization.`;
      }
      
      const three_things_to_fix: Array<{ issue: string; action: string }> = [];
      
      // Dynamic issue identification
      if (quantPct < 80) {
        three_things_to_fix.push({
          issue: `Quant: Arithmetic and Algebra accuracy slippage under timer pressure (${quantPct}%ile).`,
          action: "Drill 15-20 Arithmetic questions under a strict 2-minute hard stop constraint to build pacing discipline."
        });
      } else {
        three_things_to_fix.push({
          issue: "Quant: Higher order Number Theory and PnC selection lag.",
          action: "Spend the first 5 minutes of practice rounds scanning and categorizing solvable algebra blocks before writing code."
        });
      }
      
      if (dilrPct < 80) {
        three_things_to_fix.push({
          issue: `DILR: Selection delay in identifying the high-velocity matrix puzzle (${dilrPct}%ile).`,
          action: "Enforce a 4-minute maximum reading cutoff where you must either commit to a set or cycle to the next."
        });
      } else {
        three_things_to_fix.push({
          issue: "DILR: Stamina fatigue in the third set.",
          action: "Integrate a sectional DILR test twice a week in pressurized environments to build cognitive endurance."
        });
      }
      
      if (varcPct < 80) {
        three_things_to_fix.push({
          issue: `VARC: Reading Comprehension reading speed drop in later passages (${varcPct}%ile).`,
          action: "Engage in active paragraph summary practice to compress structural reading to 4 minutes per RC passage."
        });
      } else {
        three_things_to_fix.push({
          issue: "VARC: High error rate in critical inference questions.",
          action: "Identify paragraph boundary sentences and write down explicit justifications for eliminating choice options."
        });
      }
      
      // Ensure we have exactly 3 things to fix
      while (three_things_to_fix.length < 3) {
        three_things_to_fix.push({
          issue: "Mock stamina decay in final 30 minutes.",
          action: "Practice full length sectional drills after full work sessions to condition focus under extreme fatigue."
        });
      }
      
      const two_things_that_worked: string[] = [];
      const sections = [
        { name: "VARC", pct: varcPct },
        { name: "DILR", pct: dilrPct },
        { name: "Quant", pct: quantPct }
      ].sort((a: any, b: any) => b.pct - a.pct);
      
      two_things_that_worked.push(`${sections[0].name} Stamina: Solid execution leading to a sectional ${sections[0].pct}%ile, showing strong concept retention.`);
      two_things_that_worked.push(`Tactical Selection: Preserved sectional discipline and bypassed high-stiffness blocks successfully.`);
      
      const lowestSection = sections[2].name;
      const plan_adjustment = `Priorities for ${lowestSection} scaled upward (+0.15 attention weight) to double recall drill slots this cycle.`;
      
      // Analyze choke risk (high practice accuracy vs low mock accuracy)
      const mockAccAvg = (Number(mock.varc_accuracy || 0.7) + Number(mock.dilr_accuracy || 0.7) + Number(mock.quant_accuracy || 0.7)) / 3;
      const practiceAccAvg = (varcPractice + dilrPractice + quantPractice) / 3;
      const hasChokeRisk = practiceAccAvg > mockAccAvg + 0.15 || overall < 85;
      
      let choke_note = "";
      if (hasChokeRisk) {
        choke_note = `Critical variance detected: Your practice accuracy is highly stable (~${Math.round(practiceAccAvg * 100)}%) but mock accuracy fell to ${Math.round(mockAccAvg * 100)}%. This highlights cognitive choke risks under test pressure.`;
      } else {
        choke_note = "Practice metrics align safely with mock results. Continue reinforcing pacing constraints to scale accuracy.";
      }
      
      debrief = {
        headline,
        three_things_to_fix,
        two_things_that_worked,
        plan_adjustment,
        choke_risk: hasChokeRisk,
        choke_note
      };
    }

    // 7. Save debrief payload to mock_results table
    const { error: updateError } = await supabase
      .from('mock_results')
      .update({ debrief })
      .eq('id', mock_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 8. Recalibrate topic weights based on section percentiles
    const sections = [
      { key: 'varc_percentile', section: 'VARC' },
      { key: 'dilr_percentile', section: 'DILR' },
      { key: 'quant_percentile', section: 'Quant' }
    ]

    const todayStr = new Date().toISOString().split('T')[0]

    for (const { key, section } of sections) {
      const pct = mock[key]
      if (pct == null) continue
      
      const scorePct = Number(pct)
      const delta = scorePct < 50 ? 0.15 : scorePct > 80 ? -0.10 : 0
      if (delta === 0) continue

      const { data: sectionTopics } = await supabase
        .from('topic_weights')
        .select('id,topic,weight')
        .eq('student_id', student_id)
        .eq('section', section)

      for (const t of sectionTopics || []) {
        const newWeight = Math.min(1.0, Math.max(0.1, Number(t.weight) + delta))
        
        await supabase
          .from('topic_weights')
          .update({ weight: newWeight, updated_at: new Date().toISOString() })
          .eq('id', t.id)

        await supabase
          .from('adaptation_logs')
          .insert({
            student_id,
            log_date: todayStr,
            change_type: delta > 0 ? 'mock_weakness' : 'mock_strength',
            topic_affected: t.topic,
            reason: `${section} section mock score was ${scorePct}%ile in ${mock.source}. Priorities adjusted by ${delta > 0 ? '+' : ''}${delta.toFixed(2)}.`,
            previous_value: { weight: t.weight },
            new_value: { weight: newWeight },
            triggered_by: 'mock_result'
          })
      }
    }

    return NextResponse.json({ debrief })
  } catch (err) {
    console.error('mock-debrief error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
