import { NextRequest } from 'next/server';
import { POST as generatePlanPOST } from '../src/app/api/generate-plan/route';
import { POST as mockDebriefPOST } from '../src/app/api/mock-debrief/route';
import { POST as weeklyReportPOST } from '../src/app/api/weekly-report/route';
import { POST as burnoutMessagePOST } from '../src/app/api/burnout-message/route';
import assert from 'node:assert';

// ----------------------------------------------------
// Mock Setup
// ----------------------------------------------------

const mockStudent = {
  id: 'student-123',
  name: 'Demo Scholar',
  exam_date: '2026-11-29',
  target_percentile: 99.5,
  available_hours_weekday: 3.0,
  available_hours_weekend: 6.0,
  peak_energy_window: 'night',
  study_style: 'structured',
  biggest_fear: 'Quantitative Aptitude formula recall stiffness',
  prep_phase: 'Acceleration',
  burnout_risk_score: 0.15,
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
};

const mockWeights = [
  { topic: 'Arithmetic', section: 'Quant', weight: 0.85, coverage_percent: 75, avoidance_flag: false, last_studied: '2026-05-31' },
  { topic: 'Algebra', section: 'Quant', weight: 0.65, coverage_percent: 45, avoidance_flag: false, last_studied: '2026-05-30' },
  { topic: 'Geometry', section: 'Quant', weight: 0.5, coverage_percent: 30, avoidance_flag: true, last_studied: '2026-05-29' }
];

const mockLogs = [
  { topic: 'Arithmetic', section: 'Quant', session_type: 'Practice', difficulty_rating: 3, focus_rating: 4, completed: true, log_date: '2026-06-01' },
  { topic: 'Algebra', section: 'Quant', session_type: 'Practice', difficulty_rating: 2, focus_rating: 5, completed: true, log_date: '2026-05-30' }
];

const mockMockResult = {
  id: 'mock-456',
  student_id: 'student-123',
  mock_date: '2026-06-01',
  source: 'SimCAT',
  overall_percentile: 91.5,
  varc_score: 36,
  varc_percentile: 94.0,
  varc_accuracy: 0.80,
  varc_time_minutes: 40,
  dilr_score: 24,
  dilr_percentile: 88.0,
  dilr_accuracy: 0.70,
  dilr_time_minutes: 40,
  quant_score: 28,
  quant_percentile: 90.0,
  quant_accuracy: 0.75,
  quant_time_minutes: 40,
  debrief: null
};

const mockBurnoutScore = {
  id: 'bs-789',
  student_id: 'student-123',
  computed_at: new Date().toISOString(),
  risk_score: 0.15,
  abandonment_rate_7d: 0.0,
  streak_breaks_7d: 0,
  difficulty_trend: 0.0,
  duration_trend: 0.0,
  session_time_drift: 0.0,
  intervention_triggered: 'none'
};

// Chainable mock builder
class MockQueryBuilder {
  private table: string;
  private isSingleFlag = false;
  constructor(table: string) {
    this.table = table;
  }
  select(fields?: string) { return this; }
  eq(col: string, val: any) { return this; }
  neq(col: string, val: any) { return this; }
  gte(col: string, val: any) { return this; }
  lte(col: string, val: any) { return this; }
  in(col: string, vals: any[]) { return this; }
  not(col: string, op: string, val: any) { return this; }
  gt(col: string, val: any) { return this; }
  order(col: string, opt?: any) { return this; }
  limit(n: number) { return this; }
  maybeSingle() { this.isSingleFlag = true; return this; }
  single() { this.isSingleFlag = true; return this; }
  upsert(payload: any, options?: any) { return this; }
  update(payload: any) { return this; }
  insert(payload: any) { return this; }

  then(onfulfilled: any) {
    let data: any = [];
    if (this.table === 'students') {
      data = mockStudent;
    } else if (this.table === 'topic_weights') {
      data = mockWeights;
    } else if (this.table === 'session_logs') {
      data = mockLogs;
    } else if (this.table === 'mock_results') {
      data = this.isSingleFlag ? mockMockResult : [mockMockResult];
    } else if (this.table === 'burnout_scores') {
      data = this.isSingleFlag ? mockBurnoutScore : [mockBurnoutScore];
    } else if (this.table === 'daily_plans') {
      data = this.isSingleFlag ? {
        student_id: 'student-123',
        plan_date: new Date().toISOString().split('T')[0],
        prep_phase: 'Acceleration',
        days_remaining: 180,
        sessions: [],
        rationale: 'Seeded strategy',
        dynamic_alerts: []
      } : [{ sessions: [] }];
    } else if (this.table === 'weekly_reports') {
      data = this.isSingleFlag ? {
        student_id: 'student-123',
        week_start: '2026-06-01',
        week_end: '2026-06-07',
        sessions_planned: 0,
        sessions_completed: 0,
        topics_covered: [],
        weak_topics: [],
        adaptation_changes: [],
        mock_count: 0,
        narrative: {
          headline: 'Steady progress',
          what_worked: 'Consistent study peak zone alignment',
          what_to_watch: 'Mindful rest pacing',
          one_change: 'Complete sectional math practice',
          adaptation_summary: 'Weights adapted to close math gaps',
          encouragement: 'Keep up the solid routine'
        }
      } : [];
    }
    return Promise.resolve({ data, error: null }).then(onfulfilled);
  }
}

// Global mockup database handler
const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null })
  },
  from: (table: string) => {
    return new MockQueryBuilder(table);
  }
};

(global as any).mockSupabaseClient = mockSupabase;

// ----------------------------------------------------
// Terminal Formatting
// ----------------------------------------------------

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function printHeader(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${title.toUpperCase()} ===${colors.reset}`);
}

// ----------------------------------------------------
// Run Tests
// ----------------------------------------------------

async function runTests() {
  console.log(`\n${colors.bright}${colors.magenta}🚀 STARTING NEXT.JS API ROUTE INTEGRATION TEST SUITE${colors.reset}`);
  
  // Set mock API keys for testing fallback logic branch coverage
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;

  // Let's clear keys temporarily to force the Heuristic Fallback branch execution so tests run offline!
  // This verifies 100% stable schema return validation even when external APIs are disconnected.
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  try {
    // ==========================================
    // 1. GENERATE PLAN ROUTE
    // ==========================================
    printHeader("1. API Route: Generate Daily Plan");
    const planReq = new NextRequest('http://localhost:3000/api/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ student_id: 'student-123', force_regenerate: true })
    });
    const planRes = await generatePlanPOST(planReq);
    assert.strictEqual(planRes.status, 200, "Generate plan API should return 200 OK");
    const planData = await planRes.json();
    console.log("Plan Output structure:", Object.keys(planData));
    assert.strictEqual(planData.student_id, 'student-123');
    assert.ok(Array.isArray(planData.sessions), "sessions should be an array");
    assert.ok(planData.rationale, "rationale should be set");
    console.log(`  ${colors.green}✓ PASS:${colors.reset} /api/generate-plan executed successfully.`);

    // ==========================================
    // 2. MOCK DEBRIEF ROUTE
    // ==========================================
    printHeader("2. API Route: Mock Test Debrief");
    const debriefReq = new NextRequest('http://localhost:3000/api/mock-debrief', {
      method: 'POST',
      body: JSON.stringify({ student_id: 'student-123', mock_id: 'mock-456' })
    });
    const debriefRes = await mockDebriefPOST(debriefReq);
    assert.strictEqual(debriefRes.status, 200, "Mock debrief API should return 200 OK");
    const debriefData = await debriefRes.json();
    console.log("Debrief Output structure:", Object.keys(debriefData.debrief));
    assert.ok(debriefData.debrief.headline, "headline should be set");
    assert.ok(Array.isArray(debriefData.debrief.three_things_to_fix), "three_things_to_fix should be an array");
    assert.ok(Array.isArray(debriefData.debrief.two_things_that_worked), "two_things_that_worked should be an array");
    assert.ok(debriefData.debrief.plan_adjustment, "plan_adjustment should be set");
    console.log(`  ${colors.green}✓ PASS:${colors.reset} /api/mock-debrief executed successfully.`);

    // ==========================================
    // 3. WEEKLY REPORT ROUTE
    // ==========================================
    printHeader("3. API Route: Weekly Report Narrative");
    const weeklyReq = new NextRequest('http://localhost:3000/api/weekly-report', {
      method: 'POST',
      body: JSON.stringify({ student_id: 'student-123' })
    });
    const weeklyRes = await weeklyReportPOST(weeklyReq);
    assert.strictEqual(weeklyRes.status, 200, "Weekly report API should return 200 OK");
    const weeklyData = await weeklyRes.json();
    console.log("Weekly Report Output structure:", Object.keys(weeklyData));
    assert.strictEqual(weeklyData.sessions_planned, 0); // Mock plans returned empty list
    assert.ok(weeklyData.narrative.headline, "narrative headline should be set");
    assert.ok(weeklyData.narrative.what_worked, "narrative what_worked should be set");
    console.log(`  ${colors.green}✓ PASS:${colors.reset} /api/weekly-report executed successfully.`);

    // ==========================================
    // 4. BURNOUT MESSAGE ROUTE
    // ==========================================
    printHeader("4. API Route: Burnout Care Message");
    const burnoutReq = new NextRequest('http://localhost:3000/api/burnout-message', {
      method: 'POST',
      body: JSON.stringify({ student_id: 'student-123' })
    });
    const burnoutRes = await burnoutMessagePOST(burnoutReq);
    assert.strictEqual(burnoutRes.status, 200, "Burnout message API should return 200 OK");
    const burnoutData = await burnoutRes.json();
    console.log("Burnout Message Output structure:", Object.keys(burnoutData));
    assert.ok(burnoutData.message, "message should be set");
    assert.ok(burnoutData.message.length > 20, "message should contain recovery copy");
    console.log(`  ${colors.green}✓ PASS:${colors.reset} /api/burnout-message executed successfully.`);

    console.log(`\n${colors.bright}${colors.green}====================================================`);
    console.log(`🎉 ALL 4 LOCAL NEXT.JS API MODULE ENDPOINTS EXECUTED AND PASSED SUCCESSFULLY!`);
    console.log(`====================================================${colors.reset}\n`);

  } catch (err) {
    console.error(`\n${colors.bright}${colors.red}✗ INTEGRATION TESTS FAILURE:${colors.reset}`);
    console.error(err);
    process.exit(1);
  } finally {
    // Restore keys
    if (prevGeminiKey) process.env.GEMINI_API_KEY = prevGeminiKey;
    if (prevAnthropicKey) process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  }
}

runTests();
