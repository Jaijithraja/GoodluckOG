export function buildPlanPrompt(params: {
  name: string
  examDate: string
  daysRemaining: number
  phase: string
  targetPercentile: number
  availableHoursToday: number
  peakEnergyWindow: string
  biggestFear: string
  topicWeights: Array<{ topic: string; section: string; weight: number; coverage_percent: number; avoidance_flag: boolean; last_studied: string | null }>
  recentLogs: Array<{ topic: string; session_type: string; difficulty_rating: number; focus_rating: number; completed: boolean; log_date: string }>
  isWeekend: boolean
  phaseRules: string
}): string {
  return `You are Goodluck's planning engine. Generate a daily CAT preparation plan.

Student: ${params.name}
Exam: ${params.examDate} (${params.daysRemaining} days remaining)
Phase: ${params.phase}
Target: ${params.targetPercentile} percentile
Hours available today: ${params.availableHoursToday} (${params.isWeekend ? 'weekend' : 'weekday'})
Peak energy window: ${params.peakEnergyWindow}
Biggest fear: ${params.biggestFear}

Topic weights (higher = needs more attention, avoidance_flag = student is avoiding this):
${JSON.stringify(params.topicWeights, null, 2)}

Recent session history (last 14 sessions):
${JSON.stringify(params.recentLogs, null, 2)}

Phase rules:
${params.phaseRules}

Generate a JSON object with EXACTLY this structure:
{
  "sessions": [
    {
      "topic": "string — exact topic name matching topic_weights",
      "section": "VARC|DILR|Quant",
      "session_type": "Learn|Revise|Practice|Mock|Recovery",
      "duration_minutes": number,
      "rationale": "one specific sentence explaining why this topic today, referencing actual data"
    }
  ],
  "rationale": "2-3 sentences explaining today's overall plan strategy, specific to this student's situation",
  "dynamic_alerts": []
}

Hard rules:
- Total duration must not exceed ${params.availableHoursToday * 60} minutes
- Schedule avoidance_flag topics — don't skip them
- Crunch phase: ONLY Revise, Practice, Mock, Recovery — no Learn
- FinalWeek: ONLY Revise, Recovery — max 1 session total
- Maximum 4 sessions per day
- High weight topics go during ${params.peakEnergyWindow}
- Rationale must be specific — reference actual topics, scores, patterns. Never generic.
- Respond with ONLY the JSON. No markdown fences. No explanation.`
}

export function buildMockDebriefPrompt(params: {
  name: string
  targetPercentile: number
  phase: string
  daysRemaining: number
  currentMock: {
    source: string
    overall_percentile: number
    varc: { score: number; percentile: number; accuracy: number; time: number }
    dilr: { score: number; percentile: number; accuracy: number; time: number }
    quant: { score: number; percentile: number; accuracy: number; time: number }
  }
  previousMocks: Array<{ date: string; overall_percentile: number; varc_percentile: number; dilr_percentile: number; quant_percentile: number }>
  practiceAccuracy: { varc: number; dilr: number; quant: number }
}): string {
  return `You are Goodluck's mock analysis engine.

Student: ${params.name}, targeting ${params.targetPercentile} percentile
Phase: ${params.phase}, ${params.daysRemaining} days to exam

Latest mock (${params.currentMock.source}):
- Overall: ${params.currentMock.overall_percentile} percentile
- VARC: ${params.currentMock.varc.score} raw, ${params.currentMock.varc.percentile}%ile, ${(params.currentMock.varc.accuracy * 100).toFixed(0)}% accuracy, ${params.currentMock.varc.time} min
- DILR: ${params.currentMock.dilr.score} raw, ${params.currentMock.dilr.percentile}%ile, ${(params.currentMock.dilr.accuracy * 100).toFixed(0)}% accuracy, ${params.currentMock.dilr.time} min
- Quant: ${params.currentMock.quant.score} raw, ${params.currentMock.quant.percentile}%ile, ${(params.currentMock.quant.accuracy * 100).toFixed(0)}% accuracy, ${params.currentMock.quant.time} min

Mock trend (last ${params.previousMocks.length} mocks):
${params.previousMocks.map(m => `${m.date}: ${m.overall_percentile}%ile (V:${m.varc_percentile} D:${m.dilr_percentile} Q:${m.quant_percentile})`).join('\n')}

Daily practice accuracy (last 30 days):
VARC: ${(params.practiceAccuracy.varc * 100).toFixed(0)}%, DILR: ${(params.practiceAccuracy.dilr * 100).toFixed(0)}%, Quant: ${(params.practiceAccuracy.quant * 100).toFixed(0)}%

Respond with ONLY this JSON, no markdown:
{
  "headline": "one honest sentence summarizing what this mock means for the student",
  "three_things_to_fix": [
    { "issue": "specific problem identified from data", "action": "concrete, specific action — not 'practice more'" },
    { "issue": "...", "action": "..." },
    { "issue": "...", "action": "..." }
  ],
  "two_things_that_worked": [
    "specific strength from this mock data",
    "specific strength"
  ],
  "plan_adjustment": "one sentence on what specifically changes in next week's plan based on this mock",
  "choke_risk": boolean,
  "choke_note": "if true: honest observation about the gap between practice accuracy and mock accuracy"
}

Tone: direct and honest, like a coach who respects the student's intelligence. No false comfort. No panic.`
}

export function buildWeeklyReportPrompt(params: {
  name: string
  targetPercentile: number
  phase: string
  daysRemaining: number
  weekStats: {
    sessionsPlanned: number
    sessionsCompleted: number
    topicsCovered: string[]
    weakTopics: string[]
    mockCount: number
    avgDifficulty: number
    avgFocus: number
  }
  adaptationChanges: Array<{ topic: string; reason: string; changeType: string }>
  burnoutRiskScore: number
}): string {
  const completionRate = params.weekStats.sessionsPlanned > 0
    ? Math.round((params.weekStats.sessionsCompleted / params.weekStats.sessionsPlanned) * 100)
    : 0

  return `You are Goodluck's weekly coach.

Student: ${params.name}, targeting ${params.targetPercentile} percentile
Phase: ${params.phase}, ${params.daysRemaining} days to exam
Burnout risk: ${(params.burnoutRiskScore * 100).toFixed(0)}%

This week:
- Sessions: ${params.weekStats.sessionsCompleted} completed of ${params.weekStats.sessionsPlanned} planned (${completionRate}%)
- Topics studied: ${params.weekStats.topicsCovered.join(', ') || 'none'}
- Weak topics right now: ${params.weekStats.weakTopics.join(', ') || 'none identified'}
- Mocks taken: ${params.weekStats.mockCount}
- Avg difficulty rating: ${params.weekStats.avgDifficulty.toFixed(1)}/5
- Avg focus rating: ${params.weekStats.avgFocus.toFixed(1)}/5
- Plan adaptations this week: ${params.adaptationChanges.map(c => `${c.topic} (${c.reason})`).join('; ') || 'none'}

Respond ONLY with this JSON, no markdown:
{
  "headline": "one honest sentence about this week — specific to the numbers, not generic",
  "what_worked": "2-3 sentences on genuine wins, grounded in actual data",
  "what_to_watch": "one specific caution message based on avoiding topics or streak breaks",
  "one_change": "one action statement for the coming week",
  "adaptation_summary": "one sentence summarizing how study priorities have shifted based on this week's behavior",
  "encouragement": "one sentence of high-level, execution-focused advice"
}

Tone: supportive but objective, grounded in data, devoid of generic platitudes.`
}
