import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildPlanPrompt } from '@/lib/ai/prompts'
import { computeCountdown } from '@/lib/engine/countdown'
import { callGemini, parseJSON } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  try {
    const { student_id, force_regenerate } = await req.json()
    if (!student_id) {
      return NextResponse.json({ error: 'student_id required' }, { status: 400 })
    }

    const supabase = createServerClient()
    const geminiKey = process.env.GEMINI_API_KEY
    const apiKey = process.env.ANTHROPIC_API_KEY
    const today = new Date().toISOString().split('T')[0]

    // 1. If not forcing regenerate, check if plan already exists for today
    if (!force_regenerate) {
      const { data: existing } = await supabase
        .from('daily_plans')
        .select('*')
        .eq('student_id', student_id)
        .eq('plan_date', today)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(existing)
      }
    }

    // 2. Fetch student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', student_id)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 })
    }

    // 3. Fetch topic weights
    const { data: topicWeights } = await supabase
      .from('topic_weights')
      .select('topic,section,weight,coverage_percent,avoidance_flag,last_studied')
      .eq('student_id', student_id)
      .order('weight', { ascending: false })

    // 4. Fetch recent logs (last 14)
    const { data: recentLogs } = await supabase
      .from('session_logs')
      .select('topic,section,session_type,difficulty_rating,focus_rating,completed,log_date')
      .eq('student_id', student_id)
      .order('log_date', { ascending: false })
      .limit(14)

    // 5. Calculate countdown statistics
    const countdown = computeCountdown(student.exam_date)
    const isWeekend = [0, 6].includes(new Date().getDay())
    const availableHours = isWeekend ? student.available_hours_weekend : student.available_hours_weekday

    let parsed: {
      sessions: Array<{ topic: string; section: string; session_type: string; duration_minutes: number; rationale: string }>;
      rationale: string;
      dynamic_alerts: Array<{ alert_type: string; message: string; severity: string }>;
    }

    if (geminiKey) {
      // 🚀 Call Gemini API
      console.log('Using Gemini 2.0 Flash API for daily plan.');
      const prompt = `You are Goodluck's planning engine. Generate a daily CAT preparation plan.

Student: ${student.name}
Exam date: ${student.exam_date} (${countdown.daysRemaining} days remaining)
Current phase: ${countdown.phase}
Target percentile: ${student.target_percentile}
Available hours today: ${availableHours}h (${isWeekend ? 'weekend' : 'weekday'})
Peak energy window: ${student.peak_energy_window}
Biggest fear: ${student.biggest_fear || 'not specified'}

Topic weights (higher weight = needs more attention, avoidance_flag = student is avoiding this topic):
${JSON.stringify(topicWeights || [])}

Recent 14 sessions:
${JSON.stringify(recentLogs || [])}

Phase rules: ${countdown.phaseRules}

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
- Total session duration must not exceed ${Math.floor(availableHours * 60)} minutes
- Maximum 4 sessions per day
- Topics with avoidance_flag true MUST be included — never skip them
- Phase constraint: ${countdown.phase === 'Crunch' ? 'NO Learn sessions allowed' : countdown.phase === 'FinalWeek' ? 'Revise or Recovery ONLY, max 1 session' : 'All session types allowed'}
- Schedule highest weight topics during ${student.peak_energy_window}
- Only include dynamic_alerts if genuinely warranted — do not fabricate
- Every rationale must reference specific topics, ratings, or days remaining — never write generic advice`

      const raw = await callGemini(prompt, geminiKey, 'application/json')
      try {
        parsed = parseJSON(raw)
      } catch {
        return NextResponse.json({ error: 'Gemini plan generation parse failed', raw }, { status: 500 })
      }
    } else if (apiKey) {
      const anthropic = new Anthropic({ apiKey })

      // 6. Build Claude prompt
      const prompt = buildPlanPrompt({
        name: student.name,
        examDate: student.exam_date,
        daysRemaining: countdown.daysRemaining,
        phase: countdown.phase,
        targetPercentile: student.target_percentile,
        availableHoursToday: availableHours,
        peakEnergyWindow: student.peak_energy_window,
        biggestFear: student.biggest_fear || 'Not specified',
        topicWeights: (topicWeights || []).map((tw: any) => ({
          topic: tw.topic,
          section: tw.section,
          weight: Number(tw.weight),
          coverage_percent: Number(tw.coverage_percent),
          avoidance_flag: tw.avoidance_flag,
          last_studied: tw.last_studied || null,
        })),
        recentLogs: (recentLogs || []).map((rl: any) => ({
          topic: rl.topic,
          section: rl.section,
          session_type: rl.session_type,
          difficulty_rating: rl.difficulty_rating || 3,
          focus_rating: rl.focus_rating || 4,
          completed: rl.completed,
          log_date: rl.log_date,
        })),
        isWeekend,
        phaseRules: countdown.phaseRules || '',
      })

      // 7. Call Anthropic Claude API
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })

      const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
      try {
        parsed = JSON.parse(rawText.replace(/```json\n?|```\n?/g, '').trim())
      } catch {
        console.error('Claude JSON parse failed:', rawText)
        return NextResponse.json({ error: 'Claude response parsing failed', raw: rawText }, { status: 500 })
      }
    } else {
      // 🚀 Smart Local Heuristic Fallback
      console.log('No Gemini or Anthropic key found. Using smart local heuristic fallback.');
      
      const sortedWeights = (topicWeights || []).sort((a: any, b: any) => Number(b.weight) - Number(a.weight));
      const sessions: Array<{ topic: string; section: string; session_type: string; duration_minutes: number; rationale: string }> = [];
      const alerts: Array<{ alert_type: string; message: string; severity: string }> = [];
      
      if (Number(student.burnout_risk_score) >= 0.75) {
        sessions.push({
          topic: "Rest & Cognitive Decompression",
          section: "Quant",
          session_type: "Recovery",
          duration_minutes: 60,
          rationale: "Burnout risk score crossed safe threshold. Rest slot scheduled to lower fatigue levels."
        });
        alerts.push({
          alert_type: "burnout_intervention",
          message: `Active decompression mode: rolled back work blocks to protect stamina.`,
          severity: "critical"
        });
      } else {
        // Normal scheduling
        const top1 = sortedWeights[0];
        const top2 = sortedWeights[1];
        
        let s1Type = "Practice";
        let s2Type = "Revise";
        
        if (countdown.phase === "Foundation") {
          s1Type = "Learn";
          s2Type = "Practice";
        } else if (countdown.phase === "Acceleration") {
          s1Type = "Practice";
          s2Type = "Revise";
        } else if (countdown.phase === "Crunch") {
          s1Type = "Revise";
          s2Type = "Practice";
        } else if (countdown.phase === "FinalWeek") {
          s1Type = "Revise";
          s2Type = "Recovery";
        }
        
        const min1 = Math.round(availableHours * 60 * 0.6);
        const min2 = Math.round(availableHours * 60 * 0.4);
        
        if (top1) {
          sessions.push({
            topic: top1.topic,
            section: top1.section as string,
            session_type: s1Type,
            duration_minutes: min1 > 0 ? min1 : 45,
            rationale: `Prioritizing ${top1.topic} because attention weight is high (${Number(top1.weight).toFixed(2)}) for dynamic gap close.`
          });
        }
        
        if (availableHours >= 2.0 && top2) {
          sessions.push({
            topic: top2.topic,
            section: top2.section as string,
            session_type: s2Type,
            duration_minutes: min2 > 0 ? min2 : 30,
            rationale: `Active session on ${top2.topic} planned to secure sectional strength during peak slots.`
          });
        }
        
        const lowCoverage = (topicWeights || []).filter((w: any) => Number(w.coverage_percent) < 50);
        if (lowCoverage.length > 0) {
          alerts.push({
            alert_type: "coverage_gap",
            message: `Dynamic calibration flags low concept coverage in: ${lowCoverage.map((c: any) => c.topic).slice(0, 2).join(', ')}.`,
            severity: "warning"
          });
        }
        
        const avoided = (topicWeights || []).find((w: any) => w.avoidance_flag);
        if (avoided) {
          alerts.push({
            alert_type: "avoidance_pattern",
            message: `Omission signals detected on ${avoided.topic}. Shifting block to ${student.peak_energy_window} peak energy zone.`,
            severity: "critical"
          });
        }
      }
      
      const primaryTop = sessions[0]?.topic || "Arithmetic";
      parsed = {
        sessions,
        rationale: `Engine calibration for ${student.name} targeting IIM (${student.target_percentile}%ile). Focusing on ${primaryTop} under ${student.study_style} pacing to maintain continuous momentum during the ${countdown.phaseLabel}.`,
        dynamic_alerts: alerts
      };
    }

    // 8. Enforce phase rules boundaries
    if (countdown.phase === 'Crunch') {
      parsed.sessions = (parsed.sessions || []).filter((s: { session_type: string }) => s.session_type !== 'Learn')
    }
    if (countdown.phase === 'FinalWeek') {
      parsed.sessions = (parsed.sessions || []).filter((s: { session_type: string }) => ['Revise', 'Recovery'].includes(s.session_type)).slice(0, 1)
    }

    const sessions = (parsed.sessions || []).map((s: Record<string, unknown>) => ({ ...s, status: 'pending' }))

    // 9. Save Daily Plan to Supabase
    const { data: plan, error: planErr } = await supabase
      .from('daily_plans')
      .upsert({
        student_id,
        plan_date: today,
        prep_phase: countdown.phase,
        days_remaining: countdown.daysRemaining,
        sessions,
        rationale: parsed.rationale || '',
        dynamic_alerts: parsed.dynamic_alerts || [],
        generated_at: new Date().toISOString()
      }, { onConflict: 'student_id,plan_date' })
      .select()
      .single()

    if (planErr) {
      return NextResponse.json({ error: planErr.message }, { status: 500 })
    }

    // 10. Update student's current phase in DB if changed
    if (student.prep_phase !== countdown.phase) {
      await supabase
          .from('students')
          .update({ prep_phase: countdown.phase, updated_at: new Date().toISOString() })
          .eq('id', student_id)

      await supabase
          .from('adaptation_logs')
          .insert({
            student_id,
            log_date: today,
            change_type: 'phase_transition',
            reason: `Entered ${countdown.phaseLabel} phase with ${countdown.daysRemaining} days remaining — plan templates adjusted`,
            triggered_by: 'countdown_engine'
          })
    }

    // 11. Write dynamic alerts (safely handle case where table doesn't exist)
    if (parsed.dynamic_alerts && parsed.dynamic_alerts.length > 0) {
      try {
        const alertsPayload = parsed.dynamic_alerts.map((a: { alert_type: string; message: string; severity: string }) => ({
          student_id,
          alert_date: today,
          alert_type: a.alert_type,
          message: a.message,
          severity: a.severity,
          dismissed: false
        }))

        await supabase.from('dynamic_alerts').insert(alertsPayload)
      } catch (err) {
        console.warn('Skipping separate dynamic_alerts table insertion (alerts already saved to daily_plans).', err)
      }
    }

    return NextResponse.json(plan)
  } catch (err) {
    console.error('generate-plan error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
