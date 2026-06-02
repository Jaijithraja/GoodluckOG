import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
import { 
  Student, 
  TopicWeight, 
  DailyPlan, 
  SessionLog, 
  MockResult, 
  AdaptationLog, 
  BurnoutScore, 
  WeeklyReport, 
  PlannedSession, 
  PrepPhase,
  Section,
  SessionType,
  MockDebrief,
  WeeklyNarrative
} from "@/types";

export interface PodMember {
  id: string;
  name: string;
  target_percentile: string;
  streak_days: number;
  last_7_days: ("completed" | "partial" | "missed" | "grey")[];
}

interface StudentState {
  student: Student | null;
  topicWeights: TopicWeight[];
  dailyPlans: DailyPlan[];
  sessionLogs: SessionLog[];
  mockResults: MockResult[];
  adaptationLogs: AdaptationLog[];
  burnoutScores: BurnoutScore[];
  weeklyReports: WeeklyReport[];
  podMembers: PodMember[];
  podJoined: boolean;
  podCheckin: { win: string; struggle: string; submitted: boolean } | null;

  // Core actions
  setStudentProfile: (profile: Omit<Student, "id" | "user_id" | "created_at" | "updated_at" | "burnout_risk_score" | "prep_phase" | "pod_id" | "pod_alert_opt_in">) => Promise<void>;
  logSession: (log: Omit<SessionLog, "id" | "student_id" | "logged_at">) => Promise<void>;
  logMockResult: (mock: Omit<MockResult, "id" | "student_id" | "logged_at" | "debrief"> & { debrief?: MockDebrief }) => Promise<void>;
  generateWeeklyReport: () => Promise<void>;
  replanToday: () => Promise<void>;
  manualRecovery: () => Promise<void>;
  setDaysRemaining: (days: number) => Promise<void>;
  optInPod: (optIn: boolean) => Promise<void>;
  submitPodCheckin: (win: string, struggle: string) => Promise<void>;
  adjustTopicWeight: (topic: string, newWeight: number) => Promise<void>;
  loadFromLocalStorage: () => Promise<void>;
  loadFromSupabase: () => Promise<void>;
}

const DEFAULT_TOPICS = [
  { topic: "Reading Comprehension", section: "VARC" },
  { topic: "Verbal Ability (Para Jumbles, Odd One, Summary)", section: "VARC" },
  { topic: "Easy Sets", section: "DILR" },
  { topic: "Complex Sets", section: "DILR" },
  { topic: "Arithmetic", section: "Quant" },
  { topic: "Algebra", section: "Quant" },
  { topic: "Geometry", section: "Quant" },
  { topic: "PnC & Probability", section: "Quant" },
  { topic: "Number Theory", section: "Quant" },
] as const;

export const useStudentStore = create<StudentState>((set, get) => ({
  student: null,
  topicWeights: [],
  dailyPlans: [],
  sessionLogs: [],
  mockResults: [],
  adaptationLogs: [],
  burnoutScores: [],
  weeklyReports: [],
  podMembers: [],
  podJoined: false,
  podCheckin: null,

  setStudentProfile: async (profile) => {
    // 1. Calculate general parameters
    const daysRemaining = Math.ceil(
      (new Date(profile.exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    ) || 180;

    let phase: PrepPhase = "Foundation";
    if (daysRemaining < 7) phase = "FinalWeek";
    else if (daysRemaining < 60) phase = "Crunch";
    else if (daysRemaining < 180) phase = "Acceleration";

    const computedArchetype = `${
      profile.available_hours_weekday <= 3 ? "Time-Constrained" : "High-Availability"
    }-${phase}`;

    const studentId = "student-123";

    const newStudent: Student = {
      ...profile,
      id: studentId,
      user_id: "user-123",
      archetype: computedArchetype,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      burnout_risk_score: 0.0,
      prep_phase: phase,
      pod_alert_opt_in: false,
    };

    // Calculate baseline topic weights
    const newWeights: TopicWeight[] = DEFAULT_TOPICS.map((t, idx) => ({
      id: `weight-${idx}`,
      student_id: studentId,
      topic: t.topic,
      section: t.section as Section,
      weight: 0.5,
      coverage_percent: 15,
      revision_count: 0,
      last_studied: undefined,
      fatigue_score: 0,
      avoidance_flag: false,
      updated_at: new Date().toISOString(),
    }));

    const initialAdaptation: AdaptationLog = {
      id: `adapt-start`,
      student_id: studentId,
      log_date: new Date().toISOString().split("T")[0],
      change_type: "Cold Start",
      topic_affected: "Core Alignment",
      reason: `Goodluck initialized weights for ${newStudent.name} targeted IIM ${newStudent.exam_date}. Alignment set to ${computedArchetype}.`,
      created_at: new Date().toISOString(),
      triggered_by: "countdown_engine",
    };

    // 2. Perform Supabase syncing if logged in
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user) {
      try {
        // Create/Update Student in database
        const { data: stdData, error: stdError } = await supabase
          .from("students")
          .upsert({
            user_id: user.id,
            name: profile.name,
            exam_date: profile.exam_date,
            target_percentile: profile.target_percentile,
            available_hours_weekday: profile.available_hours_weekday,
            available_hours_weekend: profile.available_hours_weekend,
            peak_energy_window: profile.peak_energy_window,
            study_style: profile.study_style,
            biggest_fear: profile.biggest_fear || "",
            archetype: computedArchetype,
            prep_phase: phase,
            burnout_risk_score: 0.0,
            onboarding_complete: true,
            pod_alert_opt_in: false,
            dreamIIM: profile.dreamIIM || "",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" })
          .select()
          .single();

        if (stdError) throw stdError;

        if (stdData) {
          newStudent.id = stdData.id;
          newStudent.user_id = stdData.user_id;

          // Prepare database weights mapping the actual student UUID
          const dbWeights = DEFAULT_TOPICS.map((t) => ({
            student_id: stdData.id,
            topic: t.topic,
            section: t.section,
            weight: 0.5,
            coverage_percent: 15,
            revision_count: 0,
            fatigue_score: 0,
            avoidance_flag: false,
            updated_at: new Date().toISOString(),
          }));

          const { data: weightsData, error: weightsError } = await supabase
            .from("topic_weights")
            .upsert(dbWeights, { onConflict: "student_id,topic" })
            .select();

          if (weightsError) throw weightsError;

          if (weightsData) {
            newWeights.length = 0;
            weightsData.forEach((w) => {
              newWeights.push({
                id: w.id,
                student_id: w.student_id,
                topic: w.topic,
                section: w.section as Section,
                weight: Number(w.weight),
                coverage_percent: Number(w.coverage_percent),
                revision_count: w.revision_count,
                last_studied: w.last_studied || undefined,
                fatigue_score: Number(w.fatigue_score),
                avoidance_flag: w.avoidance_flag,
                updated_at: w.updated_at,
              });
            });
          }

          // Insert Adaptation logs row
          const { error: adaptError } = await supabase
            .from("adaptation_logs")
            .insert({
              student_id: stdData.id,
              log_date: new Date().toISOString().split("T")[0],
              change_type: "Cold Start",
              topic_affected: "Core Alignment",
              reason: `Goodluck initialized weights for ${newStudent.name} targeted IIM ${newStudent.dreamIIM}. Alignment set to ${computedArchetype}.`,
              triggered_by: "countdown_engine",
              created_at: new Date().toISOString(),
            });

          if (adaptError) console.error("Adaptation log write error", adaptError);
        }
      } catch (err) {
        console.error("Failed to save student profile in Supabase", err);
      }
    }

    set({
      student: newStudent,
      topicWeights: newWeights,
      adaptationLogs: [initialAdaptation],
      podMembers: [
        {
          id: "pod-1",
          name: "Aarav Mehta",
          target_percentile: "99.5%",
          streak_days: 14,
          last_7_days: ["completed", "completed", "completed", "partial", "completed", "completed", "completed"],
        },
        {
          id: "pod-2",
          name: "Riya Sharma",
          target_percentile: "99.2%",
          streak_days: 9,
          last_7_days: ["completed", "completed", "missed", "completed", "completed", "completed", "completed"],
        },
        {
          id: "pod-3",
          name: "Siddharth Sen",
          target_percentile: "99.0%",
          streak_days: 4,
          last_7_days: ["partial", "missed", "completed", "completed", "missed", "completed", "completed"],
        },
      ],
    });

    // Auto-generate plan
    await get().replanToday();

    // Local Storage backup persistence
    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  logSession: async (logData) => {
    const student = get().student;
    if (!student) return;

    const newLog: SessionLog = {
      ...logData,
      id: `log-${Date.now()}`,
      student_id: student.id,
      logged_at: new Date().toISOString(),
    };

    const updatedLogs = [newLog, ...get().sessionLogs];

    // Trigger adaptation logic
    const adaptationLogs = [...get().adaptationLogs];
    const updatedWeights = get().topicWeights.map((tw) => {
      if (tw.topic === logData.topic) {
        let newWeight = tw.weight;
        let newCoverage = tw.coverage_percent;
        let revision = tw.revision_count;

        if (logData.completed) {
          newWeight = Math.max(0.1, tw.weight - 0.08);
          newCoverage = Math.min(100, tw.coverage_percent + 8);
          if (newCoverage > 60) revision += 1;
        } else {
          newWeight = Math.min(1.0, tw.weight + 0.12);
        }

        if (logData.difficulty_rating && logData.difficulty_rating >= 4) {
          newWeight = Math.min(1.0, newWeight + 0.06);
          adaptationLogs.unshift({
            id: `adapt-diff-${Date.now()}`,
            student_id: student.id,
            log_date: new Date().toISOString().split("T")[0],
            change_type: "Weight Calibration",
            topic_affected: tw.topic,
            reason: `Cognitive difficulty rating was high (${logData.difficulty_rating}/5). Adaptation engine scaled weight by +0.06 to protect stamina.`,
            created_at: new Date().toISOString(),
            triggered_by: "session_log",
          });
        }

        return {
          ...tw,
          weight: newWeight,
          coverage_percent: newCoverage,
          revision_count: revision,
          last_studied: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        };
      }
      return tw;
    });

    // Compute burnout score
    const last7d = updatedLogs.slice(0, 7);
    const abandonmentRate = last7d.filter((l) => !l.completed).length / (last7d.length || 1);
    const difficultyAvg = last7d.reduce((acc, l) => acc + (l.difficulty_rating || 0), 0) / (last7d.length || 1);
    const focusAvg = last7d.reduce((acc, l) => acc + (l.focus_rating || 0), 0) / (last7d.length || 1);

    let burnoutScore = 0.1;
    burnoutScore += abandonmentRate * 0.3;
    burnoutScore += (difficultyAvg / 5) * 0.3;
    burnoutScore += (1 - focusAvg / 5) * 0.3;
    burnoutScore = Math.min(1.0, Math.max(0.0, burnoutScore));

    let intervention: "none" | "check_in" | "recovery_day" | "pod_alert" = "none";
    if (burnoutScore >= 0.8) {
      intervention = "recovery_day";
      adaptationLogs.unshift({
        id: `adapt-burnout-${Date.now()}`,
        student_id: student.id,
        log_date: new Date().toISOString().split("T")[0],
        change_type: "Burnout Decompression",
        topic_affected: "Daily Pace",
        reason: `Rolling fatigue score crossed 0.8 thresholds. Decompression protocol inserted a Recovery block and scaled planning hours.`,
        created_at: new Date().toISOString(),
        triggered_by: "burnout_engine",
      });
    } else if (burnoutScore >= 0.6) {
      intervention = "check_in";
    }

    const newBurnoutRecord: BurnoutScore = {
      id: `burnout-${Date.now()}`,
      student_id: student.id,
      computed_at: new Date().toISOString(),
      risk_score: burnoutScore,
      abandonment_rate_7d: abandonmentRate,
      streak_breaks_7d: abandonmentRate > 0.4 ? 2 : 0,
      difficulty_trend: difficultyAvg,
      duration_trend: focusAvg,
      session_time_drift: 0,
      intervention_triggered: intervention,
    };

    const updatedStudent: Student = {
      ...student,
      burnout_risk_score: burnoutScore,
      updated_at: new Date().toISOString(),
    };

    // Sync elements to Supabase if logged in
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user && student.id !== "student-123") {
      try {
        // Save session log row
        await supabase.from("session_logs").insert({
          student_id: student.id,
          log_date: newLog.log_date,
          topic: newLog.topic,
          section: newLog.section,
          session_type: newLog.session_type,
          planned_duration_minutes: newLog.planned_duration_minutes,
          actual_duration_minutes: newLog.actual_duration_minutes,
          difficulty_rating: newLog.difficulty_rating,
          focus_rating: newLog.focus_rating,
          completed: newLog.completed,
          abandoned_at_minute: newLog.abandoned_at_minute,
          notes: newLog.notes || "",
        });

        // Update student burnout score in Supabase
        await supabase
          .from("students")
          .update({ burnout_risk_score: burnoutScore, updated_at: new Date().toISOString() })
          .eq("id", student.id);

        // Save weights updates in database
        for (const tw of updatedWeights) {
          if (tw.topic === logData.topic) {
            await supabase
              .from("topic_weights")
              .update({
                weight: tw.weight,
                coverage_percent: tw.coverage_percent,
                revision_count: tw.revision_count,
                last_studied: tw.last_studied,
                updated_at: new Date().toISOString(),
              })
              .eq("student_id", student.id)
              .eq("topic", tw.topic);
          }
        }

        // Save adaptation logs to Supabase
        const latestAdaptations = adaptationLogs.filter(a => !a.id.startsWith("adapt-"));
        for (const adapt of latestAdaptations) {
          await supabase.from("adaptation_logs").insert({
            student_id: student.id,
            log_date: adapt.log_date,
            change_type: adapt.change_type,
            topic_affected: adapt.topic_affected,
            reason: adapt.reason,
            triggered_by: adapt.triggered_by,
          });
        }

        // Save burnout score row
        await supabase.from("burnout_scores").insert({
          student_id: student.id,
          risk_score: burnoutScore,
          abandonment_rate_7d: abandonmentRate,
          streak_breaks_7d: newBurnoutRecord.streak_breaks_7d,
          difficulty_trend: difficultyAvg,
          duration_trend: focusAvg,
          session_time_drift: 0,
          intervention_triggered: intervention,
        });
      } catch (err) {
        console.error("Supabase sync session log error", err);
      }
    }

    set({
      sessionLogs: updatedLogs,
      topicWeights: updatedWeights,
      adaptationLogs,
      burnoutScores: [newBurnoutRecord, ...get().burnoutScores],
      student: updatedStudent,
    });

    await get().replanToday();

    // Save backup to Local Storage
    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  logMockResult: async (mockData) => {
    const student = get().student;
    if (!student) return;

    let debrief: MockDebrief = mockData.debrief || {
      headline: `Overall performance reached ${mockData.overall_percentile}%ile. Accuracy analysis indicates concept gaps in Quant.`,
      three_things_to_fix: [
        { issue: "Algebra time drift", action: "Limit Algebra problem solving to 2 minutes escaping rules during practice sessions." },
        { issue: "Geometry concept gaps", action: "Initiate fundamental revision sets on triangles and coordinate properties." },
        { issue: "Quant Arithmetic accuracy drop", action: "Engage in timed sub-drills on percentages and ratios under pressure." }
      ],
      two_things_that_worked: [
        "VARC Stamina: Solved primary Reading Comprehension passages accurately under timing grids.",
        "DILR Games selection: Correctly identified and parsed logical matrix puzzles successfully."
      ],
      plan_adjustment: "Quant topic weights scaled upward to double study frequencies this week.",
      choke_risk: mockData.overall_percentile < 90,
      choke_note: "Noticeable variance between diagnostic practice percentages and pressurized mock scores."
    };

    const newMock: MockResult = {
      ...mockData,
      id: `mock-${Date.now()}`,
      student_id: student.id,
      debrief,
      logged_at: new Date().toISOString(),
    };

    const updatedMocks = [newMock, ...get().mockResults];

    const updatedWeights = get().topicWeights.map((tw) => {
      let scorePercentile = 90;
      if (tw.section === "VARC") scorePercentile = mockData.varc_percentile || 90;
      if (tw.section === "DILR") scorePercentile = mockData.dilr_percentile || 90;
      if (tw.section === "Quant") scorePercentile = mockData.quant_percentile || 90;

      const delta = scorePercentile < 80 ? 0.15 : -0.05;
      return {
        ...tw,
        weight: Math.min(1.0, Math.max(0.1, tw.weight + delta)),
      };
    });

    const adaptationLogs = [...get().adaptationLogs];
    const newAdapt = {
      id: `adapt-mock-${Date.now()}`,
      student_id: student.id,
      log_date: new Date().toISOString().split("T")[0],
      change_type: "Mock Recalibration",
      topic_affected: "All Sections",
      reason: `Mock result parsed (${mockData.source}: ${mockData.overall_percentile}%ile). Recalibrated Quant weights due to sectional results.`,
      created_at: new Date().toISOString(),
      triggered_by: "mock_result",
    };
    adaptationLogs.unshift(newAdapt);

    // Sync database if logged in
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user && student.id !== "student-123") {
      try {
        // Save mock_results row
        const { data: dbMock, error: mockInsertErr } = await supabase.from("mock_results").insert({
          student_id: student.id,
          mock_date: newMock.mock_date,
          source: newMock.source,
          overall_percentile: newMock.overall_percentile,
          varc_score: newMock.varc_score,
          varc_percentile: newMock.varc_percentile,
          varc_accuracy: newMock.varc_accuracy,
          varc_time_minutes: newMock.varc_time_minutes,
          dilr_score: newMock.dilr_score,
          dilr_percentile: newMock.dilr_percentile,
          dilr_accuracy: newMock.dilr_accuracy,
          dilr_time_minutes: newMock.dilr_time_minutes,
          quant_score: newMock.quant_score,
          quant_percentile: newMock.quant_percentile,
          quant_accuracy: newMock.quant_accuracy,
          quant_time_minutes: newMock.quant_time_minutes,
          total_attempts: newMock.total_attempts,
          total_accuracy: newMock.total_accuracy,
          debrief,
        }).select().single();

        if (mockInsertErr) throw mockInsertErr;

        // Save weights updates in database
        for (const tw of updatedWeights) {
          await supabase
            .from("topic_weights")
            .update({ weight: tw.weight, updated_at: new Date().toISOString() })
            .eq("student_id", student.id)
            .eq("topic", tw.topic);
        }

        // Save mock adaptation logs to Supabase
        await supabase.from("adaptation_logs").insert({
          student_id: student.id,
          log_date: newAdapt.log_date,
          change_type: newAdapt.change_type,
          topic_affected: newAdapt.topic_affected,
          reason: newAdapt.reason,
          triggered_by: newAdapt.triggered_by,
        });

        // Trigger real Claude AI mock debrief from our API route
        if (dbMock) {
          const debriefRes = await fetch('/api/mock-debrief', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: student.id, mock_id: dbMock.id })
          });
          
          if (debriefRes.ok) {
            const resultData = await debriefRes.json();
            if (resultData && resultData.debrief) {
              debrief = resultData.debrief;
              newMock.debrief = debrief;
            }
          }
        }
      } catch (err) {
        console.warn("Supabase sync mock result error, executing simulated fallback.", err);
      }
    }

    set({
      mockResults: updatedMocks,
      topicWeights: updatedWeights,
      adaptationLogs,
    });

    await get().replanToday();

    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  generateWeeklyReport: async () => {
    const student = get().student;
    if (!student) return;

    const planned = 12;
    const completed = get().sessionLogs.filter((l) => l.completed).length || 8;
    const rate = Math.round((completed / planned) * 100);

    let narrative: WeeklyNarrative = {
      headline: `Rolling execution completed ${completed}/${planned} planned blocks (${rate}% velocity).`,
      what_worked: "VARC consistency remains exceptionally high, maintaining concept coverage across mock drills successfully.",
      what_to_watch: "Omission signals appeared on DILR Complex Matrix drills. Upcoming cycles will reposition these in peak slots.",
      one_change: "Limit late-night Quant study slots and preserve morning blocks to tackle weak areas.",
      adaptation_summary: "Quant weight adjustments scaled upward to double active recall exercises next week.",
      encouragement: "Execution is a numbers game. Forget individual misses and preserve daily consistency."
    };

    const newReport: WeeklyReport = {
      id: `report-${Date.now()}`,
      student_id: student.id,
      week_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      week_end: new Date().toISOString().split("T")[0],
      sessions_planned: planned,
      sessions_completed: completed,
      topics_covered: ["Reading Comprehension", "Easy Sets", "Arithmetic"],
      weak_topics: ["Complex Sets"],
      adaptation_changes: [],
      mock_count: get().mockResults.length || 1,
      narrative,
      generated_at: new Date().toISOString(),
    };

    // Sync database if logged in
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user && student.id !== "student-123") {
      try {
        const response = await fetch('/api/weekly-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: student.id })
        });

        if (response.ok) {
          const realReport = await response.json();
          if (realReport && realReport.narrative) {
            newReport.narrative = realReport.narrative;
            newReport.topics_covered = realReport.topics_covered || newReport.topics_covered;
            newReport.weak_topics = realReport.weak_topics || newReport.weak_topics;
          }
        } else {
          // Normal simulated save if API route is configured but key not yet added
          await supabase.from("weekly_reports").insert({
            student_id: student.id,
            week_start: newReport.week_start,
            week_end: newReport.week_end,
            sessions_planned: planned,
            sessions_completed: completed,
            topics_covered: newReport.topics_covered,
            weak_topics: newReport.weak_topics,
            adaptation_changes: [],
            mock_count: newReport.mock_count,
            narrative,
          });
        }
      } catch (err) {
        console.warn("Supabase weekly report API error, executing simulated fallback.", err);
      }
    }

    set({
      weeklyReports: [newReport, ...get().weeklyReports],
    });

    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  replanToday: async () => {
    const student = get().student;
    if (!student) return;

    const daysRemaining = Math.ceil(
      (new Date(student.exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    ) || 180;

    // Sync database if logged in using Next.js Real Claude AI API route
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user && student.id !== "student-123") {
      try {
        const response = await fetch('/api/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: student.id })
        });

        if (response.ok) {
          const remotePlan = await response.json();
          if (remotePlan && !remotePlan.error) {
            set({
              dailyPlans: [remotePlan, ...get().dailyPlans],
            });
            await get().loadFromSupabase();
            return;
          }
        }
      } catch (err) {
        console.warn("Real AI plan generation failed, executing simulated fallback.", err);
      }
    }

    const sortedWeights = [...get().topicWeights].sort((a, b) => b.weight - a.weight);
    const hours = student.available_hours_weekday;

    const sessions: PlannedSession[] = [];
    const alerts: DailyPlan["dynamic_alerts"] = [];

    if (student.burnout_risk_score >= 0.8) {
      sessions.push({
        topic: "Rest & Cognitive Decompression",
        section: "Quant",
        session_type: "Recovery",
        duration_minutes: 60,
        rationale: "Burnout protocol triggered. Focus limits dialed to zero to enforce recovery.",
        status: "pending",
      });
      alerts.push({
        alert_type: "burnout_intervention",
        message: "Burnout recovery protocol is active. All study plans are dialed back today.",
        severity: "critical",
        dismissed: false,
      });
    } else {
      const topTopic = sortedWeights[0];
      const secondTopic = sortedWeights[1];

      if (topTopic) {
        sessions.push({
          topic: topTopic.topic,
          section: topTopic.section,
          session_type: student.prep_phase === "Crunch" ? "Revise" : "Learn",
          duration_minutes: Math.round(hours * 60 * 0.6),
          rationale: `${topTopic.section}: ${topTopic.topic} is flagged with high attention attention weight (${topTopic.weight.toFixed(2)}).`,
          status: "pending",
        });
      }

      if (hours >= 2 && secondTopic) {
        sessions.push({
          topic: secondTopic.topic,
          section: secondTopic.section,
          session_type: student.prep_phase === "Crunch" ? "Practice" : "Revise",
          duration_minutes: Math.round(hours * 60 * 0.4),
          rationale: `Active revision block for ${secondTopic.topic} to prevent memory decay.`,
          status: "pending",
        });
      }

      if (sortedWeights.length > 0 && sortedWeights[0].weight > 0.75) {
        alerts.push({
          alert_type: "coverage_gap",
          message: `Coverage drop alert: Dynamic calibration prioritizes ${sortedWeights[0].topic} to prevent execution lag.`,
          severity: "warning",
          dismissed: false,
        });
      }

      const rawAvoidance = sortedWeights.find((w) => w.avoidance_flag);
      if (rawAvoidance) {
        alerts.push({
          alert_type: "avoidance_pattern",
          message: `Omission pattern detected on ${rawAvoidance.topic}. Rescheduled in peak hours.`,
          severity: "critical",
          dismissed: false,
        });
      }
    }

    const newPlan: DailyPlan = {
      id: `plan-${Date.now()}`,
      student_id: student.id,
      plan_date: new Date().toISOString().split("T")[0],
      prep_phase: student.prep_phase,
      days_remaining: daysRemaining,
      sessions,
      rationale: `Adaptive study blueprint. Focus schedules are balanced across peak energy slots to reinforce concepts.`,
      dynamic_alerts: alerts,
      generated_at: new Date().toISOString(),
    };

    if (user && student.id !== "student-123") {
      try {
        await supabase.from("daily_plans").insert({
          student_id: student.id,
          plan_date: newPlan.plan_date,
          prep_phase: newPlan.prep_phase,
          days_remaining: newPlan.days_remaining,
          sessions,
          rationale: newPlan.rationale,
          dynamic_alerts: alerts,
        });
      } catch (err) {
        console.error("Supabase plan insert error", err);
      }
    }

    set({
      dailyPlans: [newPlan, ...get().dailyPlans],
    });
  },

  manualRecovery: async () => {
    const student = get().student;
    if (!student) return;

    const adaptationLogs = [...get().adaptationLogs];
    const newAdapt = {
      id: `adapt-manual-${Date.now()}`,
      student_id: student.id,
      log_date: new Date().toISOString().split("T")[0],
      change_type: "Manual Intervention",
      topic_affected: "Recovery Plan",
      reason: `Student manually triggered fatigue protocol. Planned execution switched to rest blocks immediately.`,
      created_at: new Date().toISOString(),
      triggered_by: "manual",
    };
    adaptationLogs.unshift(newAdapt);

    const updatedStudent: Student = {
      ...student,
      burnout_risk_score: 0.85, // Enforce Recovery Day
      updated_at: new Date().toISOString(),
    };

    // Sync database if logged in
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user && student.id !== "student-123") {
      try {
        await supabase
          .from("students")
          .update({ burnout_risk_score: 0.85, updated_at: new Date().toISOString() })
          .eq("id", student.id);

        await supabase.from("adaptation_logs").insert({
          student_id: student.id,
          log_date: newAdapt.log_date,
          change_type: newAdapt.change_type,
          topic_affected: newAdapt.topic_affected,
          reason: newAdapt.reason,
          triggered_by: newAdapt.triggered_by,
        });
      } catch (err) {
        console.error("Supabase manual recovery error", err);
      }
    }

    set({
      student: updatedStudent,
      adaptationLogs,
    });

    await get().replanToday();

    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  setDaysRemaining: async (days) => {
    const student = get().student;
    if (!student) return;

    let phase: PrepPhase = "Foundation";
    if (days < 7) phase = "FinalWeek";
    else if (days < 60) phase = "Crunch";
    else if (days < 180) phase = "Acceleration";

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const updatedStudent: Student = {
      ...student,
      exam_date: targetDate.toISOString().split("T")[0],
      prep_phase: phase,
      updated_at: new Date().toISOString(),
    };

    // Sync database if logged in
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user && student.id !== "student-123") {
      try {
        await supabase
          .from("students")
          .update({
            exam_date: updatedStudent.exam_date,
            prep_phase: updatedStudent.prep_phase,
            updated_at: new Date().toISOString(),
          })
          .eq("id", student.id);
      } catch (err) {
        console.error("Supabase setDaysRemaining error", err);
      }
    }

    set({ student: updatedStudent });
    await get().replanToday();

    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  optInPod: async (optIn) => {
    const student = get().student;
    
    // Sync database if logged in
    if (student && student.id !== "student-123") {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;

      if (user) {
        try {
          await supabase
            .from("students")
            .update({ pod_alert_opt_in: optIn, updated_at: new Date().toISOString() })
            .eq("id", student.id);
        } catch (err) {
          console.error("Supabase pod optin error", err);
        }
      }
    }

    set({ podJoined: optIn });

    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  submitPodCheckin: async (win, struggle) => {
    set({
      podCheckin: { win, struggle, submitted: true },
    });

    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  adjustTopicWeight: async (topic, newWeight) => {
    const student = get().student;
    if (!student) return;

    const clampedWeight = Math.min(1.0, Math.max(0.1, newWeight));

    // 1. Update state
    const updatedWeights = get().topicWeights.map((w) => {
      if (w.topic === topic) {
        return {
          ...w,
          weight: clampedWeight,
          updated_at: new Date().toISOString(),
        };
      }
      return w;
    });

    const oldWeightObj = get().topicWeights.find((w) => w.topic === topic);
    const oldWeight = oldWeightObj ? oldWeightObj.weight : 0.5;

    const adaptationLogs = [...get().adaptationLogs];
    const newAdapt = {
      id: `adapt-manual-adjust-${Date.now()}`,
      student_id: student.id,
      log_date: new Date().toISOString().split("T")[0],
      change_type: "Manual Override",
      topic_affected: topic,
      reason: `Student manually adjusted study priority from ${oldWeight.toFixed(2)} to ${clampedWeight.toFixed(2)}.`,
      created_at: new Date().toISOString(),
      triggered_by: "manual",
    };
    adaptationLogs.unshift(newAdapt);

    // 2. Sync database if logged in
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user && student.id !== "student-123") {
      try {
        await supabase
          .from("topic_weights")
          .update({ weight: clampedWeight, updated_at: new Date().toISOString() })
          .eq("student_id", student.id)
          .eq("topic", topic);

        await supabase.from("adaptation_logs").insert({
          student_id: student.id,
          log_date: newAdapt.log_date,
          change_type: newAdapt.change_type,
          topic_affected: newAdapt.topic_affected,
          reason: newAdapt.reason,
          triggered_by: newAdapt.triggered_by,
        });
      } catch (err) {
        console.error("Supabase manual priority adjust error", err);
      }
    }

    set({
      topicWeights: updatedWeights,
      adaptationLogs,
    });

    await get().replanToday();

    localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
      student: get().student,
      topicWeights: get().topicWeights,
      dailyPlans: get().dailyPlans,
      sessionLogs: get().sessionLogs,
      mockResults: get().mockResults,
      adaptationLogs: get().adaptationLogs,
      burnoutScores: get().burnoutScores,
      weeklyReports: get().weeklyReports,
      podMembers: get().podMembers,
      podJoined: get().podJoined,
      podCheckin: get().podCheckin,
    }));
  },

  loadFromLocalStorage: async () => {
    // 1. First trigger a Supabase check to see if we should run DB-sync
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (user) {
      await get().loadFromSupabase();
      return;
    }

    // 2. Otherwise use local storage fallback
    const raw = localStorage.getItem("goodluck_student_state_v2");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        set({
          student: parsed.student || null,
          topicWeights: parsed.topicWeights || [],
          dailyPlans: parsed.dailyPlans || [],
          sessionLogs: parsed.sessionLogs || [],
          mockResults: parsed.mockResults || [],
          adaptationLogs: parsed.adaptationLogs || [],
          burnoutScores: parsed.burnoutScores || [],
          weeklyReports: parsed.weeklyReports || [],
          podMembers: parsed.podMembers || [],
          podJoined: parsed.podJoined || false,
          podCheckin: parsed.podCheckin || null,
        });
      } catch (err) {
        console.error("Failed to load local storage", err);
      }
    } else {
      // Seed rich default demo data to wow first-time visitors who click "See How It Works"
      const defaultStudent: Student = {
        id: "student-123",
        user_id: "user-123",
        name: "Demo Scholar",
        exam_date: "2026-11-29",
        target_percentile: 99.5,
        available_hours_weekday: 3.5,
        available_hours_weekend: 7,
        peak_energy_window: "night",
        study_style: "structured",
        biggest_fear: "Losing motivation mid-prep",
        archetype: "CONSISTENT-ACHIEVER",
        prep_phase: "Acceleration",
        burnout_risk_score: 0.15,
        onboarding_complete: true,
        pod_alert_opt_in: false,
        dreamIIM: "A",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const defaultWeights: TopicWeight[] = DEFAULT_TOPICS.map((t, idx) => ({
        id: `weight-${idx}`,
        student_id: "student-123",
        topic: t.topic,
        section: t.section as Section,
        weight: idx === 0 ? 0.85 : idx === 4 ? 0.78 : idx === 2 ? 0.65 : 0.5,
        coverage_percent: idx === 0 ? 75 : idx === 4 ? 60 : idx === 2 ? 45 : 30,
        revision_count: idx === 0 ? 3 : idx === 4 ? 2 : 0,
        last_studied: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        fatigue_score: 0.1,
        avoidance_flag: idx === 3 ? true : false,
        updated_at: new Date().toISOString(),
      }));

      // Seed 10 days of session logs for beautiful charts and heatmaps
      const defaultLogs: SessionLog[] = [];
      for (let i = 0; i < 15; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        
        let completed = true;
        let difficulty = 3;
        let focus = 4;
        let actual = 60;
        let notes = "Focused study session completed successfully.";
        
        if (i % 5 === 0) {
          completed = false;
          notes = "Study slot missed due to office overload.";
          actual = 0;
          difficulty = 0;
          focus = 0;
        } else if (i % 7 === 0) {
          completed = true;
          actual = 25;
          difficulty = 5;
          focus = 2;
          notes = "Felt high mental fatigue during this block.";
        }

        defaultLogs.push({
          id: `log-seed-${i}`,
          student_id: "student-123",
          log_date: dateStr,
          topic: i % 2 === 0 ? "Arithmetic" : "Reading Comprehension",
          section: i % 2 === 0 ? "Quant" : "VARC",
          session_type: "Learn",
          planned_duration_minutes: 60,
          actual_duration_minutes: actual,
          difficulty_rating: difficulty || undefined,
          focus_rating: focus || undefined,
          completed,
          notes,
          logged_at: new Date(d).toISOString(),
        });
      }

      // Seed mock results
      const defaultMocks: MockResult[] = [
        {
          id: "mock-seed-1",
          student_id: "student-123",
          mock_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          source: "SimCAT",
          overall_percentile: 98.4,
          varc_score: 42,
          varc_percentile: 99.1,
          varc_accuracy: 84.5,
          varc_time_minutes: 40,
          dilr_score: 30,
          dilr_percentile: 96.8,
          dilr_accuracy: 75.0,
          dilr_time_minutes: 40,
          quant_score: 36,
          quant_percentile: 97.5,
          quant_accuracy: 80.0,
          quant_time_minutes: 40,
          total_attempts: 65,
          total_accuracy: 79.8,
          debrief: {
            headline: "Overall percentile hit 98.4%ile. Excellent VARC pacing, but Quant speed limits algebra escape routes.",
            three_things_to_fix: [
              { issue: "Algebra time bleed", action: "Escaped algebra equations after 2 minutes of deadlock." },
              { issue: "DILR arrangement sets", action: "Dedicate morning blocks to circular ordering games." },
              { issue: "Quant Arithmetic simple slips", action: "Review basic concepts for percentage calculations." }
            ],
            two_things_that_worked: [
              "Reading Comprehension: 99th percentile speed and high retention.",
              "Mock Stamina: Maintained focus throughout the 120-minute test."
            ],
            plan_adjustment: "Quant weights dialed up. Schedule active revision drills on triangles.",
            choke_risk: false,
            choke_note: "No significant avoidance patterns; score variance is normal."
          },
          logged_at: new Date().toISOString(),
        }
      ];

      const defaultAdaptations: AdaptationLog[] = [
        {
          id: "adapt-seed-1",
          student_id: "student-123",
          log_date: new Date().toISOString().split("T")[0],
          change_type: "Avoidance Shift",
          topic_affected: "DILR Complex Sets",
          reason: "Omission patterns detected on DILR sets. Dynamic planner shifted these to peak evening focus hours.",
          triggered_by: "session_log",
          created_at: new Date().toISOString(),
        },
        {
          id: "adapt-seed-2",
          student_id: "student-123",
          log_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          change_type: "Weight Calibration",
          topic_affected: "Quant Algebra",
          reason: "Flipped practice accuracy results down. Calibration scaled Algebra focus blocks in this cycle.",
          triggered_by: "mock_result",
          created_at: new Date().toISOString(),
        }
      ];

      const defaultWeekly: WeeklyReport[] = [
        {
          id: "report-seed-1",
          student_id: "student-123",
          week_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          week_end: new Date().toISOString().split("T")[0],
          sessions_planned: 14,
          sessions_completed: 11,
          topics_covered: ["Reading Comprehension", "Arithmetic", "Algebra"],
          weak_topics: ["DILR Complex Sets"],
          adaptation_changes: [],
          mock_count: 1,
          narrative: {
            headline: "Vibrant pacing. Completed 11/14 blocks successfully.",
            what_worked: "Highly consistent morning Verbal reading routines.",
            what_to_watch: "Slight omission drift on DILR matrix sets under late night blocks.",
            one_change: "Shift complex sets to high-energy afternoon study blocks.",
            adaptation_summary: "Quant priority weights adjusted to address mock pacing speed gaps.",
            encouragement: "Fantastic work. You're building a strong, sustainable routine. Preserve this momentum!"
          },
          generated_at: new Date().toISOString(),
        }
      ];

      const defaultPodMembers: PodMember[] = [
        {
          id: "pod-1",
          name: "Aarav Mehta",
          target_percentile: "99.5%",
          streak_days: 14,
          last_7_days: ["completed", "completed", "completed", "partial", "completed", "completed", "completed"],
        },
        {
          id: "pod-2",
          name: "Riya Sharma",
          target_percentile: "99.2%",
          streak_days: 9,
          last_7_days: ["completed", "completed", "missed", "completed", "completed", "completed", "completed"],
        },
        {
          id: "pod-3",
          name: "Siddharth Sen",
          target_percentile: "99.0%",
          streak_days: 4,
          last_7_days: ["partial", "missed", "completed", "completed", "missed", "completed", "completed"],
        },
      ];

      set({
        student: defaultStudent,
        topicWeights: defaultWeights,
        sessionLogs: defaultLogs,
        mockResults: defaultMocks,
        adaptationLogs: defaultAdaptations,
        weeklyReports: defaultWeekly,
        podMembers: defaultPodMembers,
        podJoined: true,
      });

      // Trigger automatic plan creation based on seeded student state
      get().replanToday();
    }
  },

  loadFromSupabase: async () => {
    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;

    if (!user) return;

    try {
      // 1. Fetch Student profile row
      const { data: stdData, error: stdError } = await supabase
        .from("students")
        .select()
        .eq("user_id", user.id)
        .maybeSingle();

      if (stdError) throw stdError;

      if (!stdData) {
        // No student created yet, let's keep simulated state or let onboarding handle it
        return;
      }

      const formattedStudent: Student = {
        id: stdData.id,
        user_id: stdData.user_id,
        name: stdData.name,
        exam_date: stdData.exam_date,
        target_percentile: Number(stdData.target_percentile),
        available_hours_weekday: Number(stdData.available_hours_weekday),
        available_hours_weekend: Number(stdData.available_hours_weekend),
        peak_energy_window: stdData.peak_energy_window as any,
        study_style: stdData.study_style as any,
        biggest_fear: stdData.biggest_fear,
        archetype: stdData.archetype,
        prep_phase: stdData.prep_phase as PrepPhase,
        burnout_risk_score: Number(stdData.burnout_risk_score),
        onboarding_complete: stdData.onboarding_complete,
        pod_id: stdData.pod_id || undefined,
        pod_alert_opt_in: stdData.pod_alert_opt_in,
        dreamIIM: stdData.dreamIIM,
        created_at: stdData.created_at,
        updated_at: stdData.updated_at,
      };

      // 2. Fetch Topic Weights
      const { data: weightsData, error: weightsError } = await supabase
        .from("topic_weights")
        .select()
        .eq("student_id", stdData.id);

      if (weightsError) throw weightsError;

      const formattedWeights: TopicWeight[] = (weightsData || []).map((w) => ({
        id: w.id,
        student_id: w.student_id,
        topic: w.topic,
        section: w.section as Section,
        weight: Number(w.weight),
        coverage_percent: Number(w.coverage_percent),
        revision_count: w.revision_count,
        last_studied: w.last_studied || undefined,
        fatigue_score: Number(w.fatigue_score),
        avoidance_flag: w.avoidance_flag,
        updated_at: w.updated_at,
      }));

      // 3. Fetch Daily Plans
      const { data: plansData, error: plansError } = await supabase
        .from("daily_plans")
        .select()
        .eq("student_id", stdData.id)
        .order("generated_at", { ascending: false });

      if (plansError) throw plansError;

      const formattedPlans: DailyPlan[] = (plansData || []).map((p) => ({
        id: p.id,
        student_id: p.student_id,
        plan_date: p.plan_date,
        prep_phase: p.prep_phase as PrepPhase,
        days_remaining: p.days_remaining,
        sessions: p.sessions as PlannedSession[],
        rationale: p.rationale,
        dynamic_alerts: p.dynamic_alerts as any,
        generated_at: p.generated_at,
      }));

      // 4. Fetch Session logs
      const { data: logsData, error: logsError } = await supabase
        .from("session_logs")
        .select()
        .eq("student_id", stdData.id)
        .order("logged_at", { ascending: false });

      if (logsError) throw logsError;

      const formattedLogs: SessionLog[] = (logsData || []).map((l) => ({
        id: l.id,
        student_id: l.student_id,
        plan_id: l.plan_id || undefined,
        log_date: l.log_date,
        topic: l.topic,
        section: l.section as Section,
        session_type: l.session_type as SessionType,
        planned_duration_minutes: l.planned_duration_minutes || undefined,
        actual_duration_minutes: l.actual_duration_minutes,
        difficulty_rating: l.difficulty_rating || undefined,
        focus_rating: l.focus_rating || undefined,
        completed: l.completed,
        abandoned_at_minute: l.abandoned_at_minute || undefined,
        notes: l.notes || undefined,
        logged_at: l.logged_at,
      }));

      // 5. Fetch Mock results
      const { data: mocksData, error: mocksError } = await supabase
        .from("mock_results")
        .select()
        .eq("student_id", stdData.id)
        .order("logged_at", { ascending: false });

      if (mocksError) throw mocksError;

      const formattedMocks: MockResult[] = (mocksData || []).map((m) => ({
        id: m.id,
        student_id: m.student_id,
        mock_date: m.mock_date,
        source: m.source as any,
        overall_percentile: Number(m.overall_percentile),
        varc_score: m.varc_score || undefined,
        varc_percentile: m.varc_percentile || undefined,
        varc_accuracy: m.varc_accuracy || undefined,
        varc_time_minutes: m.varc_time_minutes || undefined,
        dilr_score: m.dilr_score || undefined,
        dilr_percentile: m.dilr_percentile || undefined,
        dilr_accuracy: m.dilr_accuracy || undefined,
        dilr_time_minutes: m.dilr_time_minutes || undefined,
        quant_score: m.quant_score || undefined,
        quant_percentile: m.quant_percentile || undefined,
        quant_accuracy: m.quant_accuracy || undefined,
        quant_time_minutes: m.quant_time_minutes || undefined,
        total_attempts: m.total_attempts || undefined,
        total_accuracy: m.total_accuracy || undefined,
        debrief: m.debrief as MockDebrief || undefined,
        logged_at: m.logged_at,
      }));

      // 6. Fetch Adaptation logs
      const { data: adaptData, error: adaptError } = await supabase
        .from("adaptation_logs")
        .select()
        .eq("student_id", stdData.id)
        .order("created_at", { ascending: false });

      if (adaptError) throw adaptError;

      const formattedAdaptations: AdaptationLog[] = (adaptData || []).map((a) => ({
        id: a.id,
        student_id: a.student_id,
        log_date: a.log_date,
        change_type: a.change_type,
        topic_affected: a.topic_affected || undefined,
        reason: a.reason,
        previous_value: a.previous_value || undefined,
        new_value: a.new_value || undefined,
        triggered_by: a.triggered_by,
        created_at: a.created_at,
      }));

      // 7. Fetch Burnout scores
      const { data: burnoutData, error: burnoutError } = await supabase
        .from("burnout_scores")
        .select()
        .eq("student_id", stdData.id)
        .order("computed_at", { ascending: false });

      if (burnoutError) throw burnoutError;

      const formattedBurnouts: BurnoutScore[] = (burnoutData || []).map((b) => ({
        id: b.id,
        student_id: b.student_id,
        computed_at: b.computed_at,
        risk_score: Number(b.risk_score),
        abandonment_rate_7d: Number(b.abandonment_rate_7d),
        streak_breaks_7d: b.streak_breaks_7d,
        difficulty_trend: Number(b.difficulty_trend),
        duration_trend: Number(b.duration_trend),
        session_time_drift: Number(b.session_time_drift),
        intervention_triggered: b.intervention_triggered as any,
      }));

      // 8. Fetch Weekly reports
      const { data: reportsData, error: reportsError } = await supabase
        .from("weekly_reports")
        .select()
        .eq("student_id", stdData.id)
        .order("generated_at", { ascending: false });

      if (reportsError) throw reportsError;

      const formattedReports: WeeklyReport[] = (reportsData || []).map((r) => ({
        id: r.id,
        student_id: r.student_id,
        week_start: r.week_start,
        week_end: r.week_end,
        sessions_planned: r.sessions_planned,
        sessions_completed: r.sessions_completed,
        topics_covered: r.topics_covered,
        weak_topics: r.weak_topics,
        adaptation_changes: r.adaptation_changes as any,
        mock_count: r.mock_count,
        narrative: r.narrative as WeeklyNarrative || undefined,
        generated_at: r.generated_at,
      }));

      set({
        student: formattedStudent,
        topicWeights: formattedWeights,
        dailyPlans: formattedPlans,
        sessionLogs: formattedLogs,
        mockResults: formattedMocks,
        adaptationLogs: formattedAdaptations,
        burnoutScores: formattedBurnouts,
        weeklyReports: formattedReports,
        podJoined: formattedStudent.pod_alert_opt_in,
        podMembers: [
          {
            id: "pod-1",
            name: "Aarav Mehta",
            target_percentile: "99.5%",
            streak_days: 14,
            last_7_days: ["completed", "completed", "completed", "partial", "completed", "completed", "completed"],
          },
          {
            id: "pod-2",
            name: "Riya Sharma",
            target_percentile: "99.2%",
            streak_days: 9,
            last_7_days: ["completed", "completed", "missed", "completed", "completed", "completed", "completed"],
          },
          {
            id: "pod-3",
            name: "Siddharth Sen",
            target_percentile: "99.0%",
            streak_days: 4,
            last_7_days: ["partial", "missed", "completed", "completed", "missed", "completed", "completed"],
          },
        ],
      });
    } catch (err) {
      console.error("Failed to load state from Supabase db", err);
    }
  },
}));
