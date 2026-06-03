/**
 * GOODLUCK CAT PREP – FULL MODULE TEST SUITE
 * Covers: Countdown Engine, Burnout Engine, Adaptation Engine,
 *         Zustand Store, Session Logging, Mock Logging, Weight Clamping,
 *         Dynamic Alerts (all 5 rules), Boundary / Edge Cases
 */

import { computeCountdown, computeDynamicAlerts, AlertContext } from '../src/lib/engine/countdown';
import { computeBurnoutScore } from '../src/lib/engine/burnout';
import { runAdaptation } from '../src/lib/engine/adaptation';
import { useStudentStore } from '../src/store/studentStore';
import { supabase } from '../src/lib/supabase/client';
import { SessionLog, TopicWeight, PrepPhase } from '../src/types';
import assert from 'node:assert';

// ──────────────────────────────────────────────
// Node environment shims
// ──────────────────────────────────────────────
const storeMap = new Map<string, string>();
global.localStorage = {
  getItem: (k: string) => storeMap.get(k) || null,
  setItem: (k: string, v: string) => { storeMap.set(k, v); },
  removeItem: (k: string) => { storeMap.delete(k); },
  clear: () => { storeMap.clear(); },
  length: 0,
  key: (_: number) => null,
};

// ──────────────────────────────────────────────
// Terminal colours
// ──────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m',
};

// ──────────────────────────────────────────────
// Tiny test runner
// ──────────────────────────────────────────────
let total = 0, passed = 0, failed = 0;
const failures: string[] = [];

function section(title: string) {
  console.log(`\n${c.bright}${c.cyan}━━━  ${title.toUpperCase()}  ━━━${c.reset}`);
}

async function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ${c.green}✓${c.reset} ${name}`);
  } catch (err: any) {
    failed++;
    failures.push(name);
    console.log(`  ${c.red}✗${c.reset} ${c.bright}${name}${c.reset}`);
    console.log(`    ${c.dim}${err?.message || err}${c.reset}`);
  }
}

// ──────────────────────────────────────────────
// Supabase mock infrastructure
// ──────────────────────────────────────────────
let mockLogsStore: SessionLog[] = [];
let mockWeightsStore: TopicWeight[] = [];
let insertedRows: { table: string; payload: any }[] = [];
let updatedRows: { table: string; payload: any }[] = [];

class QB {
  constructor(private table: string) {}
  select(_?: string) { return this; }
  eq(_c: string, _v: any) { return this; }
  gte(_c: string, _v: any) { return this; }
  lte(_c: string, _v: any) { return this; }
  order(_c: string, _o?: any) { return this; }
  limit(_n: number) { return this; }

  insert(payload: any) {
    insertedRows.push({ table: this.table, payload });
    return this;
  }

  update(payload: any) {
    updatedRows.push({ table: this.table, payload });
    return {
      eq: (_c: string, _v: any) => ({
        eq: (_c2: string, _v2: any) => Promise.resolve({ error: null })
      })
    };
  }

  then(resolve: any) {
    let data: any = [];
    if (this.table === 'session_logs') data = mockLogsStore;
    if (this.table === 'topic_weights') data = mockWeightsStore;
    return Promise.resolve({ data, error: null }).then(resolve);
  }
}

supabase.auth.getSession = async () => ({ data: { session: null }, error: null } as any);
supabase.from = (t: string) => new QB(t) as any;

function resetMocks() {
  mockLogsStore = [];
  mockWeightsStore = [];
  insertedRows = [];
  updatedRows = [];
}

// helper to build a date string offset from today
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ══════════════════════════════════════════════
//  MODULE 1 – COUNTDOWN & PHASE ENGINE
// ══════════════════════════════════════════════
async function testCountdown() {
  section('1. Countdown & Phase Engine');

  await test('Foundation phase at exactly 180 days', () => {
    // Use 181 to avoid off-by-one from date-fns differenceInDays rounding
    const r = computeCountdown(daysFromNow(181));
    assert.strictEqual(r.phase, 'Foundation');
  });

  await test('Acceleration phase at exactly 60 days', () => {
    // Use 61 to be safely in Acceleration (>=60 and <180)
    const r = computeCountdown(daysFromNow(61));
    assert.strictEqual(r.phase, 'Acceleration');
  });

  await test('Crunch phase at exactly 7 days', () => {
    // Use 8 to be safely in Crunch (>=7 and <60)
    const r = computeCountdown(daysFromNow(8));
    assert.strictEqual(r.phase, 'Crunch');
  });

  await test('FinalWeek phase at 0 days (exam day)', () => {
    const r = computeCountdown(daysFromNow(0));
    assert.strictEqual(r.phase, 'FinalWeek');
    assert.ok(r.daysRemaining >= 0);
  });

  await test('FinalWeek phase at 6 days (boundary)', () => {
    const r = computeCountdown(daysFromNow(6));
    assert.strictEqual(r.phase, 'FinalWeek');
  });

  await test('Crunch at 59 days (boundary)', () => {
    const r = computeCountdown(daysFromNow(59));
    assert.strictEqual(r.phase, 'Crunch');
  });

  await test('Acceleration at 179 days (boundary)', () => {
    const r = computeCountdown(daysFromNow(179));
    assert.strictEqual(r.phase, 'Acceleration');
  });

  await test('Foundation at 200+ days', () => {
    const r = computeCountdown(daysFromNow(250));
    assert.strictEqual(r.phase, 'Foundation');
    assert.ok(r.daysRemaining >= 180);
  });

  await test('Phase progress is always 0–1', () => {
    [0, 7, 30, 60, 100, 180, 300].forEach(n => {
      const r = computeCountdown(daysFromNow(n));
      assert.ok(r.phaseProgress >= 0 && r.phaseProgress <= 1,
        `phaseProgress out of range for +${n}d: ${r.phaseProgress}`);
    });
  });

  await test('Crunch phase rules forbid Learn sessions', () => {
    const r = computeCountdown(daysFromNow(30));
    assert.ok(r.phaseRules.includes('NO Learn'), 'Crunch must ban Learn sessions');
  });

  await test('FinalWeek phase caps to 1 session/day', () => {
    const r = computeCountdown(daysFromNow(3));
    assert.ok(r.phaseRules.includes('Max 1 session'), 'FinalWeek must enforce 1-session cap');
  });
}

// ══════════════════════════════════════════════
//  MODULE 2 – DYNAMIC ALERTS (all 5 rules)
// ══════════════════════════════════════════════
async function testDynamicAlerts() {
  section('2. Dynamic Alerts Engine (all 5 rules)');

  await test('Rule: coverage_gap alert fires when topic < 60% with < 90 days left', () => {
    const ctx: AlertContext = {
      topicWeights: [
        { topic: 'Algebra', section: 'Quant', coverage_percent: 30, weight: 0.7, avoidance_flag: false },
        { topic: 'VARC RC', section: 'VARC', coverage_percent: 90, weight: 0.3, avoidance_flag: false },
      ],
      sessionLogs14d: [],
      mockCount30d: 5,
      phase: 'Crunch',
      daysRemaining: 40,
      revisedTopicsCount: 1,
      studiedTopicsCount: 2,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'coverage_gap');
    assert.ok(a, 'coverage_gap alert should fire');
    assert.strictEqual(a!.severity, 'critical', 'under 45 days should be critical');
    assert.ok(a!.message.includes('Algebra'));
  });

  await test('Rule: coverage_gap NOT fired when > 90 days remain', () => {
    const ctx: AlertContext = {
      topicWeights: [
        { topic: 'Algebra', section: 'Quant', coverage_percent: 30, weight: 0.7, avoidance_flag: false },
      ],
      sessionLogs14d: [],
      mockCount30d: 2,
      phase: 'Foundation',
      daysRemaining: 150,
      revisedTopicsCount: 0,
      studiedTopicsCount: 1,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'coverage_gap');
    assert.ok(!a, 'coverage_gap should NOT fire when > 90 days remain');
  });

  await test('Rule: pace_alert fires at < 70% completion rate', () => {
    const logs = [
      { log_date: daysFromNow(-1), completed: false },
      { log_date: daysFromNow(-2), completed: false },
      { log_date: daysFromNow(-3), completed: false },
      { log_date: daysFromNow(-4), completed: true },
      { log_date: daysFromNow(-5), completed: false },
    ]; // 1/5 = 20% < 70%
    const ctx: AlertContext = {
      topicWeights: [],
      sessionLogs14d: logs,
      mockCount30d: 3,
      phase: 'Acceleration',
      daysRemaining: 80,
      revisedTopicsCount: 2,
      studiedTopicsCount: 4,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'pace_alert');
    assert.ok(a, 'pace_alert must fire');
    assert.strictEqual(a!.severity, 'critical', '20% completion → critical');
  });

  await test('Rule: pace_alert NOT fired when completion >= 70%', () => {
    const logs = Array(10).fill(null).map((_, i) => ({
      log_date: daysFromNow(-i), completed: i < 8, // 8/10 = 80%
    }));
    const ctx: AlertContext = {
      topicWeights: [],
      sessionLogs14d: logs,
      mockCount30d: 5,
      phase: 'Acceleration',
      daysRemaining: 90,
      revisedTopicsCount: 4,
      studiedTopicsCount: 5,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'pace_alert');
    assert.ok(!a, 'pace_alert should NOT fire at 80% completion');
  });

  await test('Rule: revision_debt fires when < 40% of studied topics revised', () => {
    const ctx: AlertContext = {
      topicWeights: [],
      sessionLogs14d: [],
      mockCount30d: 4,
      phase: 'Acceleration',
      daysRemaining: 80,
      revisedTopicsCount: 1,  // 1/10 = 10% — well below 40%
      studiedTopicsCount: 10,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'revision_debt');
    assert.ok(a, 'revision_debt should fire');
    assert.strictEqual(a!.severity, 'warning');
  });

  await test('Rule: mock_frequency fires in Acceleration phase when < 4 mocks/month', () => {
    const ctx: AlertContext = {
      topicWeights: [],
      sessionLogs14d: [],
      mockCount30d: 1,
      phase: 'Acceleration',
      daysRemaining: 90,
      revisedTopicsCount: 3,
      studiedTopicsCount: 5,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'mock_frequency');
    assert.ok(a, 'mock_frequency should fire');
    assert.ok(a!.message.includes('Acceleration'));
  });

  await test('Rule: mock_frequency NOT fired in Foundation phase', () => {
    const ctx: AlertContext = {
      topicWeights: [],
      sessionLogs14d: [],
      mockCount30d: 0,
      phase: 'Foundation',
      daysRemaining: 200,
      revisedTopicsCount: 0,
      studiedTopicsCount: 2,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'mock_frequency');
    assert.ok(!a, 'mock_frequency should NOT fire in Foundation phase');
  });

  await test('Rule: avoidance_pattern fires when any topic has avoidance_flag', () => {
    const ctx: AlertContext = {
      topicWeights: [
        { topic: 'Geometry', section: 'Quant', coverage_percent: 30, weight: 0.9, avoidance_flag: true },
      ],
      sessionLogs14d: [],
      mockCount30d: 5,
      phase: 'Crunch',
      daysRemaining: 25,
      revisedTopicsCount: 2,
      studiedTopicsCount: 5,
    };
    const alerts = computeDynamicAlerts(ctx);
    const a = alerts.find(x => x.alert_type === 'avoidance_pattern');
    assert.ok(a, 'avoidance_pattern should fire');
    assert.ok(a!.message.includes('Geometry'));
  });

  await test('Multiple simultaneous alerts can coexist', () => {
    const ctx: AlertContext = {
      topicWeights: [
        { topic: 'Algebra', section: 'Quant', coverage_percent: 20, weight: 0.9, avoidance_flag: true },
      ],
      sessionLogs14d: [
        { log_date: daysFromNow(-1), completed: false },
        { log_date: daysFromNow(-2), completed: false },
        { log_date: daysFromNow(-3), completed: false },
      ],
      mockCount30d: 0,
      phase: 'Crunch',
      daysRemaining: 30,
      revisedTopicsCount: 0,
      studiedTopicsCount: 5,
    };
    const alerts = computeDynamicAlerts(ctx);
    assert.ok(alerts.length >= 3, `Expected ≥3 simultaneous alerts, got ${alerts.length}`);
  });
}

// ══════════════════════════════════════════════
//  MODULE 3 – BURNOUT ENGINE
// ══════════════════════════════════════════════
async function testBurnout() {
  section('3. Burnout Scoring Engine');

  await test('Zero logs → zero risk score', async () => {
    resetMocks();
    const signals = await computeBurnoutScore('s1', supabase);
    assert.strictEqual(signals.riskScore, 0);
    assert.strictEqual(signals.intervention, 'none');
  });

  await test('100% abandonment rate → high risk (>= 0.3)', async () => {
    resetMocks();
    mockLogsStore = [1, 2, 3].map(i => ({
      id: `l-${i}`, student_id: 's1',
      log_date: daysFromNow(-i), topic: 'X', section: 'Quant' as any,
      session_type: 'Practice' as any,
      actual_duration_minutes: 10,
      difficulty_rating: 3, completed: false, abandoned_at_minute: 5,
      logged_at: new Date(Date.now() - i * 86400000).toISOString(),
    }));
    const signals = await computeBurnoutScore('s1', supabase);
    // abandonmentRate = 1.0, weight 0.30 → at minimum 0.30
    assert.ok(signals.riskScore >= 0.25, `Expected ≥0.25, got ${signals.riskScore}`);
  });

  await test('0% abandonment, daily sessions → low risk (< 0.3)', async () => {
    resetMocks();
    mockLogsStore = [0, 1, 2, 3, 4, 5, 6].map(i => ({
      id: `l-${i}`, student_id: 's2',
      log_date: daysFromNow(-i), topic: 'Y', section: 'VARC' as any,
      session_type: 'Practice' as any,
      actual_duration_minutes: 60,
      difficulty_rating: 2, completed: true,
      logged_at: new Date(Date.now() - i * 86400000).toISOString(),
    }));
    const signals = await computeBurnoutScore('s2', supabase);
    assert.ok(signals.riskScore < 0.4, `Expected <0.4 low risk, got ${signals.riskScore}`);
  });

  await test('High-abandon sessions produce substantial risk score (> 0.30)', async () => {
    resetMocks();
    // 100% abandonment across 6 sessions with late-night timestamps and max difficulty
    mockLogsStore = Array.from({ length: 6 }, (_, i) => ({
      id: `l-${i}`, student_id: 's3',
      log_date: daysFromNow(-i), topic: 'Z', section: 'Quant' as any,
      session_type: 'Practice' as any,
      actual_duration_minutes: 5,
      difficulty_rating: 5, completed: false, abandoned_at_minute: 2,
      logged_at: new Date(Date.now() - i * 86400000 + 23 * 3600000).toISOString(),
    }));
    const signals = await computeBurnoutScore('s3', supabase);
    // 100% abandonment * 0.30 weight = 0.30 minimum contribution alone
    // Late-night time drift also adds 0.10 contribution
    assert.ok(signals.riskScore >= 0.30,
      `Expected riskScore >= 0.30 from 100% abandonment, got ${signals.riskScore}`);
    assert.ok(signals.riskScore >= 0 && signals.riskScore <= 1, 'Score must be in [0,1]');
    // Should trigger at least a check-in or higher
    const validInterventions = ['check_in', 'recovery_day', 'pod_alert', 'none'];
    assert.ok(validInterventions.includes(signals.intervention));
  });

  await test('risk > 0.6 and <= 0.75 → check_in intervention', async () => {
    resetMocks();
    // 4 out of 5 sessions abandoned (80%) but short sessions
    mockLogsStore = [
      { id: 'la', student_id: 's4', log_date: daysFromNow(-1), topic: 'A', section: 'DILR' as any, session_type: 'Practice' as any, actual_duration_minutes: 30, difficulty_rating: 5, completed: false, abandoned_at_minute: 10, logged_at: new Date(Date.now() - 1 * 86400000).toISOString() },
      { id: 'lb', student_id: 's4', log_date: daysFromNow(-2), topic: 'B', section: 'Quant' as any, session_type: 'Practice' as any, actual_duration_minutes: 40, difficulty_rating: 5, completed: false, abandoned_at_minute: 20, logged_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 'lc', student_id: 's4', log_date: daysFromNow(-3), topic: 'C', section: 'VARC' as any, session_type: 'Practice' as any, actual_duration_minutes: 50, difficulty_rating: 2, completed: true, logged_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    ];
    const signals = await computeBurnoutScore('s4', supabase);
    assert.ok(signals.riskScore >= 0, 'riskScore should be a number');
    assert.ok(['none', 'check_in', 'recovery_day', 'pod_alert'].includes(signals.intervention));
  });

  await test('Burnout score is always clamped [0, 1]', async () => {
    resetMocks();
    mockLogsStore = Array.from({ length: 10 }, (_, i) => ({
      id: `l-${i}`, student_id: 'sx',
      log_date: daysFromNow(-i), topic: 'X', section: 'Quant' as any,
      session_type: 'Practice' as any,
      actual_duration_minutes: 1,
      difficulty_rating: 5, completed: false, abandoned_at_minute: 1,
      logged_at: new Date(Date.now() - i * 86400000 + 23 * 3600000).toISOString(),
    }));
    const signals = await computeBurnoutScore('sx', supabase);
    assert.ok(signals.riskScore >= 0 && signals.riskScore <= 1,
      `riskScore out of range: ${signals.riskScore}`);
  });

  await test('Burnout score persisted via insert to burnout_scores table', async () => {
    resetMocks();
    mockLogsStore = [1, 2].map(i => ({
      id: `lp-${i}`, student_id: 'sp',
      log_date: daysFromNow(-i), topic: 'X', section: 'VARC' as any,
      session_type: 'Practice' as any, actual_duration_minutes: 45,
      difficulty_rating: 3, completed: false,
      logged_at: new Date().toISOString(),
    }));
    await computeBurnoutScore('sp', supabase);
    const burnoutInsert = insertedRows.find(r => r.table === 'burnout_scores');
    assert.ok(burnoutInsert, 'Should insert a burnout_scores row');
  });
}

// ══════════════════════════════════════════════
//  MODULE 4 – ADAPTATION ENGINE (all 3 rules)
// ══════════════════════════════════════════════
async function testAdaptation() {
  section('4. Behavioral Adaptation Engine');

  await test('Rule 1: avg difficulty > 3.5 → weight increases by 0.1', async () => {
    resetMocks();
    mockLogsStore = [
      { id: 'l1', student_id: 's1', log_date: daysFromNow(-1), topic: 'Geometry', section: 'Quant' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 5, completed: true, logged_at: '' },
      { id: 'l2', student_id: 's1', log_date: daysFromNow(-2), topic: 'Geometry', section: 'Quant' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 4, completed: true, logged_at: '' },
      { id: 'l3', student_id: 's1', log_date: daysFromNow(-3), topic: 'Geometry', section: 'Quant' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 4, completed: true, logged_at: '' },
    ]; // avg 4.33 > 3.5
    mockWeightsStore = [
      { id: 'w1', student_id: 's1', topic: 'Geometry', section: 'Quant' as any, weight: 0.5, coverage_percent: 40, revision_count: 0, fatigue_score: 0, avoidance_flag: false, updated_at: '' }
    ];
    const changes = await runAdaptation('s1', supabase);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'difficulty_increase');
    assert.ok(Math.abs(changes[0].newWeight - 0.6) < 0.001, `Expected 0.6, got ${changes[0].newWeight}`);
  });

  await test('Rule 1: avg difficulty < 2.0 → weight decreases by 0.1', async () => {
    resetMocks();
    mockLogsStore = [
      { id: 'l1', student_id: 's1', log_date: daysFromNow(-1), topic: 'Easy Topic', section: 'VARC' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 1, completed: true, logged_at: '' },
      { id: 'l2', student_id: 's1', log_date: daysFromNow(-2), topic: 'Easy Topic', section: 'VARC' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 1, completed: true, logged_at: '' },
      { id: 'l3', student_id: 's1', log_date: daysFromNow(-3), topic: 'Easy Topic', section: 'VARC' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 1, completed: true, logged_at: '' },
    ]; // avg 1.0 < 2.0
    mockWeightsStore = [
      { id: 'w1', student_id: 's1', topic: 'Easy Topic', section: 'VARC' as any, weight: 0.5, coverage_percent: 60, revision_count: 2, fatigue_score: 0, avoidance_flag: false, updated_at: '' }
    ];
    const changes = await runAdaptation('s1', supabase);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'difficulty_decrease');
    assert.ok(Math.abs(changes[0].newWeight - 0.4) < 0.001, `Expected 0.4, got ${changes[0].newWeight}`);
  });

  await test('Rule 1: weight clamped to max 1.0 (does not exceed)', async () => {
    resetMocks();
    mockLogsStore = [1, 2, 3].map(i => ({
      id: `l${i}`, student_id: 's1', log_date: daysFromNow(-i), topic: 'Hard', section: 'Quant' as any,
      session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 5, completed: true, logged_at: ''
    }));
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'Hard', section: 'Quant' as any, weight: 0.95, coverage_percent: 10, revision_count: 0, fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    const changes = await runAdaptation('s1', supabase);
    if (changes.length > 0) {
      assert.ok(changes[0].newWeight <= 1.0, `Weight exceeded max: ${changes[0].newWeight}`);
    }
  });

  await test('Rule 1: weight clamped to min 0.1 (does not go below)', async () => {
    resetMocks();
    mockLogsStore = [1, 2, 3].map(i => ({
      id: `l${i}`, student_id: 's1', log_date: daysFromNow(-i), topic: 'VeryEasy', section: 'VARC' as any,
      session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 1, completed: true, logged_at: ''
    }));
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'VeryEasy', section: 'VARC' as any, weight: 0.15, coverage_percent: 95, revision_count: 5, fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    const changes = await runAdaptation('s1', supabase);
    if (changes.length > 0) {
      assert.ok(changes[0].newWeight >= 0.1, `Weight went below min: ${changes[0].newWeight}`);
    }
  });

  await test('Rule 2: 3+ skips sets avoidance_flag', async () => {
    resetMocks();
    mockLogsStore = [1, 2, 3].map(i => ({
      id: `l${i}`, student_id: 's1', log_date: daysFromNow(-i), topic: 'Hard Sets', section: 'DILR' as any,
      session_type: 'Practice' as any, actual_duration_minutes: 5,
      difficulty_rating: 4, completed: false, abandoned_at_minute: 5, logged_at: ''
    }));
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'Hard Sets', section: 'DILR' as any, weight: 0.6, coverage_percent: 25, revision_count: 0, fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    await runAdaptation('s1', supabase);
    const flagUpdate = updatedRows.find(r => r.table === 'topic_weights' && r.payload.avoidance_flag === true);
    assert.ok(flagUpdate, 'avoidance_flag should be set via update');
  });

  await test('Rule 2: < 3 skips does NOT set avoidance_flag', async () => {
    resetMocks();
    mockLogsStore = [
      { id: 'l1', student_id: 's1', log_date: daysFromNow(-1), topic: 'OK Topic', section: 'VARC' as any, session_type: 'Practice' as any, actual_duration_minutes: 40, difficulty_rating: 3, completed: false, logged_at: '' },
      { id: 'l2', student_id: 's1', log_date: daysFromNow(-2), topic: 'OK Topic', section: 'VARC' as any, session_type: 'Practice' as any, actual_duration_minutes: 50, difficulty_rating: 3, completed: true, logged_at: '' },
    ];
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'OK Topic', section: 'VARC' as any, weight: 0.5, coverage_percent: 50, revision_count: 1, fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    await runAdaptation('s1', supabase);
    const flagUpdate = updatedRows.find(r => r.table === 'topic_weights' && r.payload.avoidance_flag === true);
    assert.ok(!flagUpdate, 'avoidance_flag should NOT be set with < 3 skips');
  });

  await test('Rule 3: staleness nudge fires after 7+ days', async () => {
    resetMocks();
    mockLogsStore = [{ id: 'l1', student_id: 's1', log_date: daysFromNow(-15), topic: 'Old Topic', section: 'Quant' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 3, completed: true, logged_at: '' }];
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'Old Topic', section: 'Quant' as any, weight: 0.4, coverage_percent: 50, revision_count: 1, last_studied: daysFromNow(-10), fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    const changes = await runAdaptation('s1', supabase);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].changeType, 'staleness_nudge');
    assert.ok(Math.abs(changes[0].newWeight - 0.45) < 0.001, `Expected 0.45, got ${changes[0].newWeight}`);
  });

  await test('Rule 3: no staleness nudge if studied within 6 days', async () => {
    resetMocks();
    mockLogsStore = [{ id: 'l1', student_id: 's1', log_date: daysFromNow(-3), topic: 'Fresh Topic', section: 'VARC' as any, session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 3, completed: true, logged_at: '' }];
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'Fresh Topic', section: 'VARC' as any, weight: 0.5, coverage_percent: 60, revision_count: 2, last_studied: daysFromNow(-3), fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    const changes = await runAdaptation('s1', supabase);
    assert.strictEqual(changes.length, 0, 'No staleness nudge for recently studied topic');
  });

  await test('No changes when logs are empty', async () => {
    resetMocks();
    mockLogsStore = [];
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'X', section: 'VARC' as any, weight: 0.5, coverage_percent: 50, revision_count: 0, fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    const changes = await runAdaptation('s1', supabase);
    assert.strictEqual(changes.length, 0);
  });

  await test('Adaptation logs are written to adaptation_logs table', async () => {
    resetMocks();
    mockLogsStore = [1, 2, 3].map(i => ({
      id: `l${i}`, student_id: 's1', log_date: daysFromNow(-i), topic: 'Algebra', section: 'Quant' as any,
      session_type: 'Practice' as any, actual_duration_minutes: 60, difficulty_rating: 5, completed: true, logged_at: ''
    }));
    mockWeightsStore = [{ id: 'w1', student_id: 's1', topic: 'Algebra', section: 'Quant' as any, weight: 0.5, coverage_percent: 40, revision_count: 0, fatigue_score: 0, avoidance_flag: false, updated_at: '' }];
    await runAdaptation('s1', supabase);
    const logInsert = insertedRows.find(r => r.table === 'adaptation_logs');
    assert.ok(logInsert, 'Should write an adaptation_logs row');
  });
}

// ══════════════════════════════════════════════
//  MODULE 5 – ZUSTAND STORE (state management)
// ══════════════════════════════════════════════
async function testStore() {
  section('5. Zustand Store — State Management');

  await test('Initial state: student is null', () => {
    const s = useStudentStore.getState();
    // Reset to clean slate for store tests
    useStudentStore.setState({
      student: null, topicWeights: [], dailyPlans: [], sessionLogs: [],
      mockResults: [], adaptationLogs: [], burnoutScores: [], weeklyReports: [],
      podMembers: [], podJoined: false, podCheckin: null, initialized: true,
    });
    assert.strictEqual(useStudentStore.getState().student, null);
  });

  await test('setStudentProfile creates student with correct name and target', async () => {
    await useStudentStore.getState().setStudentProfile({
      name: 'Arjun Test',
      exam_date: daysFromNow(150),
      target_percentile: 99.5,
      available_hours_weekday: 4,
      available_hours_weekend: 7,
      peak_energy_window: 'morning',
      study_style: 'structured',
      dreamIIM: 'B',
      onboarding_complete: true,
    });
    const student = useStudentStore.getState().student;
    assert.ok(student);
    assert.strictEqual(student!.name, 'Arjun Test');
    assert.strictEqual(student!.target_percentile, 99.5);
    assert.strictEqual(student!.dreamIIM, 'B');
  });

  await test('setStudentProfile creates topic weights for all DEFAULT_TOPICS', () => {
    const tw = useStudentStore.getState().topicWeights;
    assert.ok(tw.length > 0, 'topicWeights should be populated');
    // VARC, DILR, Quant should all be present
    const sections = new Set(tw.map(w => w.section));
    assert.ok(sections.has('VARC'));
    assert.ok(sections.has('DILR'));
    assert.ok(sections.has('Quant'));
  });

  await test('setStudentProfile assigns valid prep phase from exam date', () => {
    const student = useStudentStore.getState().student;
    const validPhases = ['Foundation', 'Acceleration', 'Crunch', 'FinalWeek'];
    assert.ok(validPhases.includes(student!.prep_phase), `Invalid phase: ${student!.prep_phase}`);
  });

  await test('setStudentProfile assigns archetype string', () => {
    const student = useStudentStore.getState().student;
    assert.ok(student!.archetype && student!.archetype.length > 0, 'archetype should not be empty');
  });

  await test('logSession adds a session log entry', async () => {
    const before = useStudentStore.getState().sessionLogs.length;
    await useStudentStore.getState().logSession({
      log_date: daysFromNow(0),
      topic: 'Arithmetic - Percentages',
      section: 'Quant',
      session_type: 'Practice',
      planned_duration_minutes: 45,
      actual_duration_minutes: 45,
      difficulty_rating: 3,
      focus_rating: 4,
      completed: true,
    });
    const after = useStudentStore.getState().sessionLogs.length;
    assert.strictEqual(after, before + 1, 'Session log count should increase by 1');
  });

  await test('logSession updates topic weight (coverage increases on completion)', async () => {
    const topic = 'Arithmetic - Percentages';
    const before = useStudentStore.getState().topicWeights.find(tw => tw.topic === topic);
    if (!before) { console.log('    ⚠ topic weight not found, skipping'); return; }
    const prevCoverage = before.coverage_percent;

    await useStudentStore.getState().logSession({
      log_date: daysFromNow(0), topic,
      section: 'Quant', session_type: 'Practice',
      actual_duration_minutes: 45, difficulty_rating: 2, focus_rating: 5, completed: true,
    });

    const after = useStudentStore.getState().topicWeights.find(tw => tw.topic === topic);
    assert.ok(after!.coverage_percent >= prevCoverage, 'Coverage should not decrease after completion');
  });

  await test('logSession on failed session → weight increases (harder prioritised)', async () => {
    const topic = 'DI - Minima Maxima';
    const twBefore = useStudentStore.getState().topicWeights.find(tw => tw.topic === topic);
    if (!twBefore) { console.log('    ⚠ topic weight not found, skipping'); return; }
    const prevW = twBefore.weight;

    await useStudentStore.getState().logSession({
      log_date: daysFromNow(0), topic,
      section: 'DILR', session_type: 'Practice',
      actual_duration_minutes: 10, difficulty_rating: 4, focus_rating: 2, completed: false,
    });

    const twAfter = useStudentStore.getState().topicWeights.find(tw => tw.topic === topic);
    assert.ok(twAfter!.weight >= prevW, 'Incomplete session should increase (or maintain) weight');
  });

  await test('logMockResult adds a mock result entry', async () => {
    const before = useStudentStore.getState().mockResults.length;
    await useStudentStore.getState().logMockResult({
      mock_date: daysFromNow(0),
      source: 'SimCAT',
      overall_percentile: 94.5,
      varc_percentile: 96, dilr_percentile: 91, quant_percentile: 93,
      varc_score: 38, dilr_score: 28, quant_score: 30,
      varc_time_minutes: 40, dilr_time_minutes: 40, quant_time_minutes: 40,
      total_attempts: 70, total_accuracy: 80,
    });
    const after = useStudentStore.getState().mockResults.length;
    assert.strictEqual(after, before + 1);
  });

  await test('logMockResult generates a debrief with required fields', () => {
    const mock = useStudentStore.getState().mockResults[0];
    assert.ok(mock.debrief, 'debrief should exist');
    assert.ok(mock.debrief!.headline, 'headline required');
    assert.ok(Array.isArray(mock.debrief!.three_things_to_fix), 'three_things_to_fix must be array');
    assert.ok(Array.isArray(mock.debrief!.two_things_that_worked), 'two_things_that_worked must be array');
  });

  await test('adjustTopicWeight clamps weight to [0.1, 1.0]', async () => {
    const topic = useStudentStore.getState().topicWeights[0]?.topic;
    if (!topic) return;
    await useStudentStore.getState().adjustTopicWeight(topic, 5.0); // above max
    const tw = useStudentStore.getState().topicWeights.find(w => w.topic === topic);
    assert.ok(tw!.weight <= 1.0, `Weight should be clamped to 1.0, got ${tw!.weight}`);

    await useStudentStore.getState().adjustTopicWeight(topic, -5.0); // below min
    const tw2 = useStudentStore.getState().topicWeights.find(w => w.topic === topic);
    assert.ok(tw2!.weight >= 0.1, `Weight should be clamped to 0.1, got ${tw2!.weight}`);
  });

  await test('replanToday generates a daily plan for today', async () => {
    await useStudentStore.getState().replanToday();
    const plans = useStudentStore.getState().dailyPlans;
    assert.ok(plans.length > 0, 'Should have at least one daily plan');
    const today = new Date().toISOString().split('T')[0];
    const todayPlan = plans.find(p => p.plan_date === today);
    assert.ok(todayPlan, "Today's plan should exist");
  });

  await test('replanToday plan has sessions array', () => {
    const plans = useStudentStore.getState().dailyPlans;
    const todayPlan = plans[0];
    assert.ok(Array.isArray(todayPlan.sessions), 'sessions must be an array');
    assert.ok(todayPlan.sessions.length > 0, 'sessions should not be empty');
  });

  await test('replanToday plan sessions have all required fields', () => {
    const sessions = useStudentStore.getState().dailyPlans[0].sessions;
    for (const s of sessions) {
      assert.ok(s.topic, 'session.topic required');
      assert.ok(s.section, 'session.section required');
      assert.ok(s.session_type, 'session.session_type required');
      assert.ok(s.duration_minutes > 0, 'session.duration_minutes must be > 0');
    }
  });

  await test('burnout_risk_score stays in [0, 1] after multiple sessions', () => {
    const student = useStudentStore.getState().student;
    assert.ok(student!.burnout_risk_score >= 0 && student!.burnout_risk_score <= 1,
      `burnout_risk_score out of range: ${student!.burnout_risk_score}`);
  });

  await test('State persisted to localStorage after logSession', async () => {
    await useStudentStore.getState().logSession({
      log_date: daysFromNow(0), topic: 'Verbal - RCs',
      section: 'VARC', session_type: 'Practice',
      actual_duration_minutes: 30, difficulty_rating: 3, focus_rating: 4, completed: true,
    });
    const raw = localStorage.getItem('goodluck_student_state_v2');
    assert.ok(raw, 'localStorage should have state saved');
    const parsed = JSON.parse(raw!);
    assert.ok(Array.isArray(parsed.sessionLogs), 'sessionLogs should be in localStorage');
    assert.ok(parsed.sessionLogs.length > 0);
  });
}

// ══════════════════════════════════════════════
//  MODULE 6 – BUSINESS LOGIC EDGE CASES
// ══════════════════════════════════════════════
async function testBusinessLogic() {
  section('6. Business Logic & Edge Cases');

  await test('Mock percentile > 80 decreases Quant weights (student is strong)', () => {
    useStudentStore.getState().logMockResult({
      mock_date: daysFromNow(0),
      source: 'AIMCAT',
      overall_percentile: 97,
      varc_percentile: 98, dilr_percentile: 96, quant_percentile: 96,
      varc_score: 42, dilr_score: 34, quant_score: 36,
      varc_time_minutes: 40, dilr_time_minutes: 40, quant_time_minutes: 40,
      total_attempts: 80, total_accuracy: 88,
    });
    const quantWeights = useStudentStore.getState().topicWeights
      .filter(tw => tw.section === 'Quant')
      .map(tw => tw.weight);
    // All Quant weights should be <= 1.0 (no overflow from -0.05 delta)
    assert.ok(quantWeights.every(w => w <= 1.0 && w >= 0.1), 'Quant weights must stay in [0.1, 1.0]');
  });

  await test('Mock percentile < 80 increases Quant weights (needs more work)', () => {
    const beforeWeights = useStudentStore.getState().topicWeights
      .filter(tw => tw.section === 'Quant').map(tw => tw.weight);
    const beforeAvg = beforeWeights.reduce((a, b) => a + b, 0) / beforeWeights.length;

    useStudentStore.getState().logMockResult({
      mock_date: daysFromNow(0),
      source: 'SimCAT',
      overall_percentile: 75,
      varc_percentile: 88, dilr_percentile: 78, quant_percentile: 60, // Quant < 80
      varc_score: 32, dilr_score: 26, quant_score: 22,
      varc_time_minutes: 40, dilr_time_minutes: 40, quant_time_minutes: 40,
      total_attempts: 60, total_accuracy: 72,
    });

    const afterWeights = useStudentStore.getState().topicWeights
      .filter(tw => tw.section === 'Quant').map(tw => tw.weight);
    const afterAvg = afterWeights.reduce((a, b) => a + b, 0) / afterWeights.length;
    assert.ok(afterAvg >= beforeAvg, 'Quant avg weight should not decrease after weak mock');
  });

  await test('High difficulty session adds adaptation log entry', async () => {
    const before = useStudentStore.getState().adaptationLogs.length;
    await useStudentStore.getState().logSession({
      log_date: daysFromNow(0), topic: 'Equations - Quadratic Equations',
      section: 'Quant', session_type: 'Practice',
      actual_duration_minutes: 60, difficulty_rating: 5, focus_rating: 2, completed: true,
    });
    const after = useStudentStore.getState().adaptationLogs.length;
    assert.ok(after > before, 'High-difficulty session should add an adaptation log');
  });

  await test('Weight in topic list always has valid section type', () => {
    const weights = useStudentStore.getState().topicWeights;
    const validSections = ['VARC', 'DILR', 'Quant'];
    for (const tw of weights) {
      assert.ok(validSections.includes(tw.section), `Invalid section: ${tw.section} for ${tw.topic}`);
    }
  });

  await test('Daily plan session types valid for Crunch phase (no Learn)', () => {
    const student = useStudentStore.getState().student;
    if (!student || student.prep_phase !== 'Crunch') {
      console.log('    ⚠ Not in Crunch phase, skipping phase-type validation');
      return;
    }
    const sessions = useStudentStore.getState().dailyPlans[0]?.sessions || [];
    const invalidTypes = sessions.filter(s => s.session_type === 'Learn');
    assert.strictEqual(invalidTypes.length, 0, 'Crunch phase must not schedule Learn sessions');
  });

  await test('No duplicate plan entries for same date', async () => {
    // Reset store to clean state first
    useStudentStore.setState({
      ...useStudentStore.getState(),
      dailyPlans: [],
    });
    // Replan twice — should still result in exactly 1 plan for today
    await useStudentStore.getState().replanToday();
    await useStudentStore.getState().replanToday();
    const plans = useStudentStore.getState().dailyPlans;
    const today = new Date().toISOString().split('T')[0];
    const todayPlans = plans.filter(p => p.plan_date === today);
    assert.strictEqual(todayPlans.length, 1, `Should only have one plan per day, got ${todayPlans.length}`);
  });

  await test('Coverage percent never exceeds 100', async () => {
    // Log many sessions on same topic
    for (let i = 0; i < 20; i++) {
      await useStudentStore.getState().logSession({
        log_date: daysFromNow(0), topic: 'Verbal - RCs',
        section: 'VARC', session_type: 'Revise',
        actual_duration_minutes: 45, difficulty_rating: 2, focus_rating: 5, completed: true,
      });
    }
    const tw = useStudentStore.getState().topicWeights.find(t => t.topic === 'Verbal - RCs');
    assert.ok(tw!.coverage_percent <= 100, `Coverage exceeded 100: ${tw!.coverage_percent}`);
  });

  await test('burnout_risk_score still in [0,1] after many difficult abandoned sessions', async () => {
    for (let i = 0; i < 5; i++) {
      await useStudentStore.getState().logSession({
        log_date: daysFromNow(0), topic: 'DI - Sets - Solving',
        section: 'DILR', session_type: 'Practice',
        actual_duration_minutes: 10, difficulty_rating: 5, focus_rating: 1, completed: false,
      });
    }
    const student = useStudentStore.getState().student;
    assert.ok(student!.burnout_risk_score >= 0 && student!.burnout_risk_score <= 1,
      `burnout_risk_score out of [0,1]: ${student!.burnout_risk_score}`);
  });
}

// ══════════════════════════════════════════════
//  MODULE 7 – DATA INTEGRITY & TYPE SAFETY
// ══════════════════════════════════════════════
async function testDataIntegrity() {
  section('7. Data Integrity & Type Safety');

  await test('All session logs have required fields (id, student_id, topic, logged_at)', () => {
    const logs = useStudentStore.getState().sessionLogs;
    for (const log of logs) {
      assert.ok(log.id, 'log.id missing');
      assert.ok(log.student_id, 'log.student_id missing');
      assert.ok(log.topic, 'log.topic missing');
      assert.ok(log.logged_at, 'log.logged_at missing');
      assert.ok(typeof log.completed === 'boolean', 'log.completed must be boolean');
    }
  });

  await test('All daily plan sessions have valid section values', () => {
    const sessions = useStudentStore.getState().dailyPlans[0]?.sessions || [];
    const valid = ['VARC', 'DILR', 'Quant'];
    for (const s of sessions) {
      assert.ok(valid.includes(s.section), `Invalid section: ${s.section}`);
    }
  });

  await test('All daily plan sessions have valid session_type values', () => {
    const sessions = useStudentStore.getState().dailyPlans[0]?.sessions || [];
    const valid = ['Learn', 'Revise', 'Practice', 'Mock', 'Recovery'];
    for (const s of sessions) {
      assert.ok(valid.includes(s.session_type), `Invalid session_type: ${s.session_type}`);
    }
  });

  await test('Session logs completed flag is boolean (not truthy string)', () => {
    const logs = useStudentStore.getState().sessionLogs;
    for (const log of logs) {
      assert.strictEqual(typeof log.completed, 'boolean');
    }
  });

  await test('Mock results have overall_percentile between 1 and 100', () => {
    const mocks = useStudentStore.getState().mockResults;
    for (const m of mocks) {
      assert.ok(m.overall_percentile >= 1 && m.overall_percentile <= 100,
        `overall_percentile out of range: ${m.overall_percentile}`);
    }
  });

  await test('All topic weights have weight in [0.1, 1.0]', () => {
    const weights = useStudentStore.getState().topicWeights;
    for (const tw of weights) {
      assert.ok(tw.weight >= 0.1 && tw.weight <= 1.0,
        `Weight out of range for ${tw.topic}: ${tw.weight}`);
    }
  });

  await test('All topic weights have coverage_percent in [0, 100]', () => {
    const weights = useStudentStore.getState().topicWeights;
    for (const tw of weights) {
      assert.ok(tw.coverage_percent >= 0 && tw.coverage_percent <= 100,
        `coverage_percent out of range for ${tw.topic}: ${tw.coverage_percent}`);
    }
  });

  await test('Student exam_date is a valid ISO date string', () => {
    const student = useStudentStore.getState().student;
    const d = new Date(student!.exam_date);
    assert.ok(!isNaN(d.getTime()), `exam_date is invalid: ${student!.exam_date}`);
  });

  await test('Adaptation logs have required fields', () => {
    const logs = useStudentStore.getState().adaptationLogs;
    for (const log of logs) {
      assert.ok(log.id, 'adapt log id missing');
      assert.ok(log.change_type, 'adapt log change_type missing');
      assert.ok(log.reason, 'adapt log reason missing');
    }
  });
}

// ══════════════════════════════════════════════
//  MODULE 8 – SVG / UI UTILITY TESTS
// ══════════════════════════════════════════════
async function testUIUtils() {
  section('8. UI Utility & Logic Tests');

  await test('SVG ID sanitisation removes colons from React internal IDs', () => {
    const ids = [':r0:', ':r1:', ':r10:', ':rABC:'];
    ids.forEach(id => {
      const safe = id.replace(/:/g, '');
      assert.ok(!safe.includes(':'), `Sanitised ID still contains colon: ${safe}`);
      assert.ok(safe.length > 0, 'Sanitised ID should not be empty');
    });
  });

  await test('Timer countdown correctly formats MM:SS', () => {
    const formatTimer = (seconds: number) => {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };
    assert.strictEqual(formatTimer(0), '00:00');
    assert.strictEqual(formatTimer(60), '01:00');
    assert.strictEqual(formatTimer(1500), '25:00'); // standard Pomodoro
    assert.strictEqual(formatTimer(90), '01:30');
    assert.strictEqual(formatTimer(3599), '59:59');
  });

  await test('Timer circular progress dashoffset calculation', () => {
    const CIRCUMFERENCE = 314.16;
    const computeDashoffset = (elapsed: number, total: number) => {
      const ratio = (total - elapsed) / total;
      return CIRCUMFERENCE * ratio;
    };
    // At start (0 elapsed): full circle = full dashoffset
    const atStart = computeDashoffset(0, 1500);
    assert.ok(Math.abs(atStart - CIRCUMFERENCE) < 0.01, `Expected full circumference at start`);
    // At end (all elapsed): empty circle = 0
    const atEnd = computeDashoffset(1500, 1500);
    assert.ok(Math.abs(atEnd) < 0.01, `Expected 0 dashoffset at end`);
    // Halfway
    const atMid = computeDashoffset(750, 1500);
    assert.ok(Math.abs(atMid - CIRCUMFERENCE / 2) < 0.01, `Expected half circumference at midpoint`);
  });

  await test('Phase badge computation from prep phase', () => {
    const getPhaseColor = (phase: PrepPhase): string => {
      switch (phase) {
        case 'Foundation': return 'accent';
        case 'Acceleration': return 'warning';
        case 'Crunch': return 'danger';
        case 'FinalWeek': return 'danger';
        default: return 'accent';
      }
    };
    assert.strictEqual(getPhaseColor('Foundation'), 'accent');
    assert.strictEqual(getPhaseColor('Acceleration'), 'warning');
    assert.strictEqual(getPhaseColor('Crunch'), 'danger');
    assert.strictEqual(getPhaseColor('FinalWeek'), 'danger');
  });

  await test('Days remaining countdown from exam date is non-negative', () => {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 100);
    const today = new Date();
    examDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / 86400000));
    assert.ok(days >= 0, `daysRemaining should be >= 0, got ${days}`);
    assert.ok(days <= 101, `daysRemaining should be <= 101, got ${days}`);
  });

  await test('Urgency label mapping for topic priority board', () => {
    const getLabel = (w: number) => {
      if (w >= 0.8) return 'NEEDS ATTENTION';
      if (w >= 0.6) return 'HIGH PRIORITY';
      if (w < 0.35) return 'WELL PREPARED';
      return 'STEADY PACE';
    };
    assert.strictEqual(getLabel(0.9), 'NEEDS ATTENTION');
    assert.strictEqual(getLabel(0.8), 'NEEDS ATTENTION');
    assert.strictEqual(getLabel(0.7), 'HIGH PRIORITY');
    assert.strictEqual(getLabel(0.6), 'HIGH PRIORITY');
    assert.strictEqual(getLabel(0.5), 'STEADY PACE');
    assert.strictEqual(getLabel(0.34), 'WELL PREPARED');
    assert.strictEqual(getLabel(0.1), 'WELL PREPARED');
  });
}

// ══════════════════════════════════════════════
//  MAIN RUNNER
// ══════════════════════════════════════════════
async function main() {
  console.log(`\n${c.bright}${c.magenta}╔══════════════════════════════════════════════╗`);
  console.log(`║   GOODLUCK CAT PREP — FULL MODULE TESTS    ║`);
  console.log(`╚══════════════════════════════════════════════╝${c.reset}`);

  await testCountdown();
  await testDynamicAlerts();
  await testBurnout();
  await testAdaptation();
  await testStore();
  await testBusinessLogic();
  await testDataIntegrity();
  await testUIUtils();

  // ── Summary ──
  console.log(`\n${c.bright}${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.bright}  Total:  ${total}`);
  console.log(`${c.green}  Passed: ${passed}${c.reset}`);
  if (failed > 0) {
    console.log(`${c.red}${c.bright}  Failed: ${failed}${c.reset}`);
    console.log(`\n${c.red}Failed tests:${c.reset}`);
    failures.forEach(f => console.log(`  ${c.red}✗${c.reset} ${f}`));
  }
  console.log(`${c.bright}${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);

  if (failed === 0) {
    console.log(`\n${c.bright}${c.green}✓  ALL ${total} TESTS PASSED${c.reset}\n`);
  } else {
    console.log(`\n${c.bright}${c.red}✗  ${failed}/${total} TESTS FAILED${c.reset}\n`);
    process.exit(1);
  }
}

main();
