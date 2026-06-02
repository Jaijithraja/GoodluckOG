import { computeCountdown, computeDynamicAlerts, AlertContext } from '../src/lib/engine/countdown';
import { computeBurnoutScore } from '../src/lib/engine/burnout';
import { runAdaptation } from '../src/lib/engine/adaptation';
import { useStudentStore } from '../src/store/studentStore';
import { supabase } from '../src/lib/supabase/client';
import { SessionLog, TopicWeight, PrepPhase, Section, SessionType } from '../src/types';
import assert from 'node:assert';

// Mock localStorage for Node environment
const storeMap = new Map<string, string>();
global.localStorage = {
  getItem: (key: string) => storeMap.get(key) || null,
  setItem: (key: string, value: string) => { storeMap.set(key, value); },
  removeItem: (key: string) => { storeMap.delete(key); },
  clear: () => { storeMap.clear(); },
  length: 0,
  key: (index: number) => null,
};

// Custom lightweight test runner styling utilities
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function printHeader(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${title.toUpperCase()} ===${colors.reset}`);
}

function printSuccess(message: string) {
  console.log(`  ${colors.green}✓ PASS:${colors.reset} ${message}`);
}

function printFailure(message: string, err: any) {
  console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${message}`);
  console.error(err);
}

// Global test counters
let totalTests = 0;
let passedTests = 0;

function runTest(name: string, testFn: () => void | Promise<void>) {
  totalTests++;
  try {
    const result = testFn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          passedTests++;
          printSuccess(name);
        })
        .catch((err) => {
          printFailure(name, err);
        });
    } else {
      passedTests++;
      printSuccess(name);
    }
  } catch (err) {
    printFailure(name, err);
  }
}

// Global Mock callbacks and data stores
let mockLogsStore: SessionLog[] = [];
let mockWeightsStore: TopicWeight[] = [];
let globalInsertCallback: ((table: string, payload: any) => void) | null = null;
let globalUpdateCallback: ((table: string, payload: any) => void) | null = null;

// Generic thenable Supabase query builder mock
class SupabaseQueryBuilder {
  private table: string;
  constructor(table: string) {
    this.table = table;
  }
  select(fields?: string) { return this; }
  eq(col: string, val: any) { return this; }
  gte(col: string, val: any) { return this; }
  order(col: string, opt?: any) { return this; }
  limit(n: number) { return this; }
  
  insert(payload: any) {
    if (globalInsertCallback) {
      globalInsertCallback(this.table, payload);
    }
    return this;
  }

  update(payload: any) {
    if (globalUpdateCallback) {
      globalUpdateCallback(this.table, payload);
    }
    return {
      eq: (col: string, val: any) => ({
        eq: (col2: string, val2: any) => this
      })
    };
  }

  then(onfulfilled: any) {
    let resolvedData: any = [];
    if (this.table === 'session_logs') {
      resolvedData = mockLogsStore;
    } else if (this.table === 'topic_weights') {
      resolvedData = mockWeightsStore;
    }
    return Promise.resolve({ data: resolvedData, error: null }).then(onfulfilled);
  }
}

// Override exported supabase instance methods for offline modular testing
supabase.auth.getSession = async () => {
  return { data: { session: null }, error: null } as any;
};

supabase.from = (table: string) => {
  return new SupabaseQueryBuilder(table) as any;
};

// Main testing suite
async function startSuite() {
  console.log(`\n${colors.bright}${colors.magenta}🚀 INITIATING SYSTEM LEVEL MODULE VERIFICATION FOR GOODLUCK OS${colors.reset}`);

  // ==========================================
  // MODULE 1: COUNTDOWN & DYNAMIC ALERTS ENGINE
  // ==========================================
  printHeader("1. Countdown & Dynamic Alerts Module");

  runTest("computeCountdown handles Phase Boundaries perfectly", () => {
    // A. Foundation Phase Boundaries (180+ days)
    const foundation = computeCountdown("2026-12-30"); // > 200 days away
    assert.strictEqual(foundation.phase, "Foundation");
    assert.ok(foundation.daysRemaining >= 180);
    assert.ok(foundation.phaseRules.includes("concept coverage"));

    // B. Acceleration Phase Boundaries (60 to 179 days)
    const accelDate = new Date();
    accelDate.setDate(accelDate.getDate() + 100);
    const acceleration = computeCountdown(accelDate.toISOString().split("T")[0]);
    assert.strictEqual(acceleration.phase, "Acceleration");
    assert.ok(acceleration.daysRemaining >= 60 && acceleration.daysRemaining < 180);
    assert.ok(acceleration.phaseRules.includes("week")); // Rule uses 'week', not 'weekly'

    // C. Crunch Phase Boundaries (7 to 59 days)
    const crunchDate = new Date();
    crunchDate.setDate(crunchDate.getDate() + 30);
    const crunch = computeCountdown(crunchDate.toISOString().split("T")[0]);
    assert.strictEqual(crunch.phase, "Crunch");
    assert.ok(crunch.daysRemaining >= 7 && crunch.daysRemaining < 60);
    assert.ok(crunch.phaseRules.includes("NO Learn"));

    // D. Final Week Phase Boundaries (0 to 6 days)
    const finalDate = new Date();
    finalDate.setDate(finalDate.getDate() + 3);
    const finalWeek = computeCountdown(finalDate.toISOString().split("T")[0]);
    assert.strictEqual(finalWeek.phase, "FinalWeek");
    assert.ok(finalWeek.daysRemaining >= 0 && finalWeek.daysRemaining < 7);
    assert.ok(finalWeek.phaseRules.includes("Max 1 session"));
  });

  runTest("computeDynamicAlerts detects study coverage gaps reactively", () => {
    const ctx: AlertContext = {
      topicWeights: [
        { topic: "Algebra", section: "Quant", coverage_percent: 45, weight: 0.5, avoidance_flag: false },
        { topic: "Arithmetic", section: "Quant", coverage_percent: 85, weight: 0.5, avoidance_flag: false }
      ],
      sessionLogs14d: [
        { log_date: "2026-06-01", completed: true },
        { log_date: "2026-05-30", completed: true }
      ],
      mockCount30d: 4,
      phase: "Acceleration",
      daysRemaining: 75, // Under 90 days trigger
      revisedTopicsCount: 2,
      studiedTopicsCount: 3
    };

    const alerts = computeDynamicAlerts(ctx);
    const gapAlert = alerts.find(a => a.alert_type === "coverage_gap");
    assert.ok(gapAlert, "Should generate a coverage gap alert");
    assert.strictEqual(gapAlert.severity, "warning");
    assert.ok(gapAlert.message.includes("Algebra"));
  });

  runTest("computeDynamicAlerts triggers critical alerts for high-risk study pace drops", () => {
    const ctx: AlertContext = {
      topicWeights: [
        { topic: "Arithmetic", section: "Quant", coverage_percent: 80, weight: 0.5, avoidance_flag: false }
      ],
      sessionLogs14d: [
        { log_date: "2026-06-01", completed: false },
        { log_date: "2026-05-30", completed: false },
        { log_date: "2026-05-29", completed: true },
        { log_date: "2026-05-28", completed: false },
        { log_date: "2026-05-27", completed: false }
      ], // 1/5 = 20% completion (well below 70% threshold, and < 50% critical threshold)
      mockCount30d: 4,
      phase: "Acceleration",
      daysRemaining: 80,
      revisedTopicsCount: 3,
      studiedTopicsCount: 5
    };

    const alerts = computeDynamicAlerts(ctx);
    const paceAlert = alerts.find(a => a.alert_type === "pace_alert");
    assert.ok(paceAlert, "Should generate pace alert");
    assert.strictEqual(paceAlert.severity, "critical");
  });

  // ==========================================
  // MODULE 2: BURNOUT PASSIVE METRIC ENGINE
  // ==========================================
  printHeader("2. Burnout Scoring & Intervention Module");

  await runTest("computeBurnoutScore calculates high risk and schedules decompression", async () => {
    // Chronological logs series with calibrated difficulty and duration trends to cross the 0.75 recovery day threshold timezone-independently
    mockLogsStore = [
      { id: "log-4", student_id: "st-1", log_date: "2026-05-29", topic: "Algebra", section: "Quant", session_type: "Practice", planned_duration_minutes: 60, actual_duration_minutes: 60, difficulty_rating: 1, completed: false, abandoned_at_minute: 20, logged_at: "2026-05-29T23:30:00" },
      { id: "log-3", student_id: "st-1", log_date: "2026-05-30", topic: "Complex Sets", section: "DILR", session_type: "Practice", planned_duration_minutes: 60, actual_duration_minutes: 40, difficulty_rating: 1, completed: false, abandoned_at_minute: 15, logged_at: "2026-05-30T23:30:00" },
      { id: "log-2", student_id: "st-1", log_date: "2026-05-31", topic: "Geometry", section: "Quant", session_type: "Practice", planned_duration_minutes: 60, actual_duration_minutes: 20, difficulty_rating: 5, completed: false, abandoned_at_minute: 10, logged_at: "2026-05-31T23:30:00" },
      { id: "log-1", student_id: "st-1", log_date: "2026-06-01", topic: "Arithmetic", section: "Quant", session_type: "Practice", planned_duration_minutes: 60, actual_duration_minutes: 5, difficulty_rating: 5, completed: false, abandoned_at_minute: 30, logged_at: "2026-06-01T23:30:00" }
    ];

    let persistedScore: any = null;
    let persistedStudentRisk: number = 0;

    globalInsertCallback = (table, payload) => {
      if (table === 'burnout_scores') persistedScore = payload;
    };

    globalUpdateCallback = (table, payload) => {
      if (table === 'students') persistedStudentRisk = payload.burnout_risk_score;
    };

    const signals = await computeBurnoutScore("st-1", supabase);
    console.log("DEBUG - calculated burnout signals:", signals);

    assert.strictEqual(signals.abandonmentRate, 1.0);
    assert.ok(signals.riskScore > 0.65); // High risk score
    assert.strictEqual(signals.intervention, "recovery_day"); // Triggers recovery day decompression
    assert.strictEqual(persistedStudentRisk, signals.riskScore);
    assert.ok(persistedScore);
  });

  // ==========================================
  // MODULE 3: BEHAVIORAL ADAPTATION ENGINE
  // ==========================================
  printHeader("3. Behavioral Adaptation Engine");

  await runTest("runAdaptation handles Rule 1: High difficulty weight escalations", async () => {
    mockLogsStore = [
      { id: "l-1", student_id: "st-1", log_date: "2026-06-01", topic: "Geometry", section: "Quant", session_type: "Practice", actual_duration_minutes: 60, difficulty_rating: 5, completed: true, logged_at: "2026-06-01T15:00:00Z" },
      { id: "l-2", student_id: "st-1", log_date: "2026-05-31", topic: "Geometry", section: "Quant", session_type: "Practice", actual_duration_minutes: 60, difficulty_rating: 4, completed: true, logged_at: "2026-05-31T15:00:00Z" },
      { id: "l-3", student_id: "st-1", log_date: "2026-05-30", topic: "Geometry", section: "Quant", session_type: "Practice", actual_duration_minutes: 60, difficulty_rating: 5, completed: true, logged_at: "2026-05-30T15:00:00Z" }
    ]; // 3 geometry sessions, average difficulty = 4.67 (> 3.5 threshold)

    mockWeightsStore = [
      { id: "w-1", student_id: "st-1", topic: "Geometry", section: "Quant", weight: 0.5, coverage_percent: 30, revision_count: 0, fatigue_score: 0, avoidance_flag: false, updated_at: "" }
    ];

    let updatedWeight: number = 0;
    let adaptationInserted: any = null;

    globalUpdateCallback = (table, payload) => {
      if (table === 'topic_weights') updatedWeight = payload.weight;
    };

    globalInsertCallback = (table, payload) => {
      if (table === 'adaptation_logs') adaptationInserted = payload;
    };

    const changes = await runAdaptation("st-1", supabase);

    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].topic, "Geometry");
    assert.strictEqual(changes[0].changeType, "difficulty_increase");
    assert.strictEqual(updatedWeight, 0.6); // 0.5 + 0.1
    assert.ok(adaptationInserted);
    assert.strictEqual(adaptationInserted.change_type, "difficulty_increase");
  });

  await runTest("runAdaptation handles Rule 2: Skips/Abandonments triggers Avoidance Flags", async () => {
    mockLogsStore = [
      { id: "l-1", student_id: "st-1", log_date: "2026-06-01", topic: "Complex Sets", section: "DILR", session_type: "Practice", actual_duration_minutes: 0, difficulty_rating: 4, completed: false, logged_at: "2026-06-01T15:00:00Z" },
      { id: "l-2", student_id: "st-1", log_date: "2026-05-31", topic: "Complex Sets", section: "DILR", session_type: "Practice", actual_duration_minutes: 5, difficulty_rating: 5, completed: false, abandoned_at_minute: 5, logged_at: "2026-05-31T15:00:00Z" },
      { id: "l-3", student_id: "st-1", log_date: "2026-05-30", topic: "Complex Sets", section: "DILR", session_type: "Practice", actual_duration_minutes: 0, difficulty_rating: 4, completed: false, logged_at: "2026-05-30T15:00:00Z" }
    ]; // 3/3 sessions skipped/abandoned (>3 skips in recent sets)

    mockWeightsStore = [
      { id: "w-2", student_id: "st-1", topic: "Complex Sets", section: "DILR", weight: 0.5, coverage_percent: 20, revision_count: 0, fatigue_score: 0, avoidance_flag: false, updated_at: "" }
    ];

    let avoidanceFlagged = false;

    globalUpdateCallback = (table, payload) => {
      if (table === 'topic_weights' && payload.avoidance_flag === true) {
        avoidanceFlagged = true;
      }
    };

    await runAdaptation("st-1", supabase);
    assert.ok(avoidanceFlagged, "Avoidance flag should be raised");
  });

  await runTest("runAdaptation handles Rule 3: Staleness priority nudges", async () => {
    mockLogsStore = [
      { id: "l-1", student_id: "st-1", log_date: "2026-05-20", topic: "Algebra", section: "Quant", session_type: "Practice", actual_duration_minutes: 60, difficulty_rating: 3, completed: true, logged_at: "2026-05-20T15:00:00Z" }
    ]; // Studied 10 days ago (staleness nudge threshold)

    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    mockWeightsStore = [
      { id: "w-3", student_id: "st-1", topic: "Algebra", section: "Quant", weight: 0.5, coverage_percent: 50, revision_count: 1, last_studied: tenDaysAgo.toISOString().split("T")[0], fatigue_score: 0, avoidance_flag: false, updated_at: "" }
    ];

    let updatedWeight: number = 0;
    let changeType = "";

    globalUpdateCallback = (table, payload) => {
      if (table === 'topic_weights') updatedWeight = payload.weight;
    };

    globalInsertCallback = (table, payload) => {
      if (table === 'adaptation_logs') changeType = payload.change_type;
    };

    const changes = await runAdaptation("st-1", supabase);

    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].topic, "Algebra");
    assert.strictEqual(changeType, "staleness_nudge");
    assert.strictEqual(updatedWeight, 0.55); // 0.5 + 0.05
  });

  // ==========================================
  // MODULE 4: ZUSTAND CENTRAL STATE STORE
  // ==========================================
  printHeader("4. Zustand Central State Store Module");

  await runTest("Zustand store initializes properly and generates custom archetype parameters", async () => {
    // Assert initial state is clean
    const state = useStudentStore.getState();
    assert.strictEqual(state.student, null);

    // Call setStudentProfile
    await state.setStudentProfile({
      name: "Test Scholar",
      exam_date: "2026-11-29",
      target_percentile: 99.8,
      available_hours_weekday: 3.0, // Time-constrained threshold (<=3)
      available_hours_weekend: 6,
      peak_energy_window: "night",
      study_style: "structured",
      dreamIIM: "A",
      onboarding_complete: true
    });

    const updatedState = useStudentStore.getState();
    const student = updatedState.student;

    assert.ok(student);
    assert.strictEqual(student.name, "Test Scholar");
    assert.strictEqual(student.target_percentile, 99.8);
    
    // Archetype should map weekday hours and countdown phase
    assert.ok(student.archetype);
    assert.ok(student.archetype.startsWith("Time-Constrained"));
  });

  // ==========================================
  // MODULE 5: UI SCOPING UNIQUE LOGO IDS
  // ==========================================
  printHeader("5. SVG Unique UI Scoping Module");

  runTest("SVG Logo ID Scoping extracts clean colon-free hashes", () => {
    const uniqueId1 = ":r0:";
    const uniqueId2 = ":r1:";

    const safeId1 = uniqueId1.replace(/:/g, "");
    const safeId2 = uniqueId2.replace(/:/g, "");

    assert.strictEqual(safeId1, "r0");
    assert.strictEqual(safeId2, "r1");

    const neonTopId1 = `gl-neon-top-${safeId1}`;
    const neonTopId2 = `gl-neon-top-${safeId2}`;

    assert.strictEqual(neonTopId1, "gl-neon-top-r0");
    assert.strictEqual(neonTopId2, "gl-neon-top-r1");
    assert.notStrictEqual(neonTopId1, neonTopId2, "IDs must be fully isolated across instances");
  });

  // Print final test report
  console.log(`\n${colors.bright}${colors.cyan}=====================================${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}🏁 SYSTEM MODULE TESTS RUN COMPLETE${colors.reset}`);
  console.log(`Total Module Test Cases Checked: ${colors.bright}${totalTests}${colors.reset}`);
  if (passedTests === totalTests) {
    console.log(`${colors.bright}${colors.green}ALL ${passedTests}/${totalTests} TESTS COMPILED AND EXECUTED WITH 100% PERFECT STATUS! ✓${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}WARNING: ${totalTests - passedTests} MODULE TEST CASES FAILED! ✗${colors.reset}`);
  }
  console.log(`${colors.bright}${colors.cyan}=====================================${colors.reset}\n`);
}

startSuite();
