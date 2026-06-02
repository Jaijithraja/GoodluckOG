"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { Target, Clock, Activity, BookOpen, Heart, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { PrepPhase, Section } from "@/types";
import GoodluckLogo from "@/components/GoodluckLogo";
import { supabase } from "@/lib/supabase/client";

const SECTIONS = {
  VARC: ["Reading Comprehension", "Verbal Ability (Para Jumbles, Odd One, Summary)"],
  DILR: ["Easy Sets", "Complex Sets"],
  Quant: ["Arithmetic", "Algebra", "Geometry", "PnC & Probability", "Number Theory"],
} as const;

export default function OnboardingPage() {
  const router = useRouter();
  const setStudentProfile = useStudentStore((state) => state.setStudentProfile);
  const clearDemoData = useStudentStore((state) => state.clearDemoData);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    dreamIIM: "A",
    targetPercentile: 99.0,
    examDate: "2026-11-29",
    weekdayHours: 3,
    weekendHours: 6,
    peakEnergy: "morning" as "morning" | "afternoon" | "night",
    monthsIntoPrep: "fresh",
    hasMockScore: false,
    lastMockScore: "",
    topics: {} as Record<string, "weak" | "average" | "strong">,
    studyStyle: "structured" as "structured" | "flexible",
    biggestFear: "Losing motivation mid-prep",
  });

  const nextStep = () => setStep((s) => Math.min(s + 1, 6));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleTopicRating = (topic: string, rating: "weak" | "average" | "strong") => {
    setFormData((prev) => ({
      ...prev,
      topics: { ...prev.topics, [topic]: rating },
    }));
  };

  const computePhase = (examDateStr: string): PrepPhase => {
    const examDate = new Date(examDateStr);
    const today = new Date();
    examDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    if (daysRemaining < 7) return "FinalWeek";
    if (daysRemaining < 60) return "Crunch";
    if (daysRemaining < 180) return "Acceleration";
    return "Foundation";
  };

  const RATING_TO_WEIGHT = {
    weak: 0.8,
    average: 0.5,
    strong: 0.3,
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      // Clean up any demo state before starting real onboarding
      await clearDemoData();

      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;

      if (!user) {
        // Guest user onboarding pipeline - Save to local Zustand store
        await useStudentStore.getState().setStudentProfile({
          name: formData.name || "Aspirant",
          exam_date: formData.examDate,
          target_percentile: Number(formData.targetPercentile),
          available_hours_weekday: Number(formData.weekdayHours),
          available_hours_weekend: Number(formData.weekendHours),
          peak_energy_window: formData.peakEnergy as any,
          study_style: formData.studyStyle as any,
          biggest_fear: formData.biggestFear || "",
          onboarding_complete: true,
          dreamIIM: formData.dreamIIM || "A",
        });

        // Set the active student's isDemo to false because they just completed actual onboarding!
        const localStoreState = useStudentStore.getState();
        if (localStoreState.student) {
          localStoreState.student.isDemo = false;
          
          // If mock score was entered, seed a custom mock result in the local store
          if (formData.hasMockScore && formData.lastMockScore) {
            const scoreVal = parseFloat(formData.lastMockScore);
            await localStoreState.logMockResult({
              mock_date: new Date().toISOString().split("T")[0],
              source: "Other",
              overall_percentile: scoreVal,
              varc_percentile: Math.min(99.9, Math.max(50, scoreVal + 1)),
              dilr_percentile: Math.min(99.9, Math.max(50, scoreVal - 2)),
              quant_percentile: Math.min(99.9, Math.max(50, scoreVal + 1)),
              varc_score: Math.round(scoreVal * 0.3),
              dilr_score: Math.round(scoreVal * 0.25),
              quant_score: Math.round(scoreVal * 0.2),
              varc_time_minutes: 40,
              dilr_time_minutes: 40,
              quant_time_minutes: 40,
              total_attempts: 75,
              total_accuracy: 78.5,
            });
          }

          // Force local storage backup save
          localStorage.setItem("goodluck_student_state_v2", JSON.stringify({
            student: localStoreState.student,
            topicWeights: localStoreState.topicWeights,
            dailyPlans: localStoreState.dailyPlans,
            sessionLogs: localStoreState.sessionLogs,
            mockResults: localStoreState.mockResults,
            adaptationLogs: localStoreState.adaptationLogs,
            burnoutScores: localStoreState.burnoutScores,
            weeklyReports: localStoreState.weeklyReports,
            podMembers: localStoreState.podMembers,
            podJoined: localStoreState.podJoined,
            podCheckin: localStoreState.podCheckin,
          }));
        }

        router.push("/today");
        setLoading(false);
        return;
      }

      // 1. Insert students record
      const { data: student, error: sErr } = await supabase
        .from("students")
        .insert({
          user_id: user.id,
          name: formData.name || "Aspirant",
          exam_date: formData.examDate,
          target_percentile: formData.targetPercentile,
          available_hours_weekday: formData.weekdayHours,
          available_hours_weekend: formData.weekendHours,
          peak_energy_window: formData.peakEnergy,
          study_style: formData.studyStyle,
          biggest_fear: formData.biggestFear,
          prep_phase: computePhase(formData.examDate),
          onboarding_complete: false, // set true after plan generates
          dreamIIM: formData.dreamIIM,
        })
        .select()
        .single();

      if (sErr) {
        console.error("Student insert error:", sErr);
        setError("Failed to save your profile. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Insert all 9 topic_weights using rating from Step 4
      const CAT_TOPICS = Object.entries(SECTIONS).flatMap(([section, topics]) =>
        topics.map((topic) => ({
          student_id: student.id,
          topic,
          section: section as Section,
          weight: RATING_TO_WEIGHT[formData.topics[topic] || "average"],
          coverage_percent: 0,
          revision_count: 0,
          avoidance_flag: false,
        }))
      );

      const { error: twErr } = await supabase.from("topic_weights").insert(CAT_TOPICS);
      if (twErr) {
        console.error("Topic weights insert error:", twErr);
      }

      // 3. If mock scores entered in Step 3: insert mock_results
      if (formData.hasMockScore && formData.lastMockScore) {
        const scoreVal = parseFloat(formData.lastMockScore);
        const { error: mrErr } = await supabase.from("mock_results").insert({
          student_id: student.id,
          mock_date: new Date().toISOString().split("T")[0],
          source: "Other",
          overall_percentile: scoreVal,
          varc_percentile: Math.min(99.9, Math.max(50, scoreVal + 1)),
          dilr_percentile: Math.min(99.9, Math.max(50, scoreVal - 2)),
          quant_percentile: Math.min(99.9, Math.max(50, scoreVal + 1)),
          varc_score: Math.round(scoreVal * 0.3),
          dilr_score: Math.round(scoreVal * 0.25),
          quant_score: Math.round(scoreVal * 0.2),
          varc_time_minutes: 40,
          dilr_time_minutes: 40,
          quant_time_minutes: 40,
          total_attempts: 75,
          total_accuracy: 78.5,
        });
        if (mrErr) {
          console.error("Mock result insert error:", mrErr);
        }
      }

      // 4. Call generate-plan Supabase edge function
      try {
        const { data: plan, error: pErr } = await supabase.functions.invoke("generate-plan", {
          body: { student_id: student.id },
        });
        if (pErr) {
          console.error("Plan generation failed:", pErr);
        }
      } catch (err) {
        console.error("Edge function invocation failed:", err);
      }

      // 5. Mark onboarding complete
      await supabase.from("students").update({ onboarding_complete: true }).eq("id", student.id);

      // Force a reload of student store state to ensure it is synchronized
      await useStudentStore.getState().loadFromLocalStorage();

      // 6. Redirect to today
      router.push("/today");
    } catch (err) {
      console.error("Onboarding submit failed:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 5;
  const progressPercent = ((step - 1) / totalSteps) * 100;

  return (
    <main className="min-h-screen bg-bg-base flex items-center justify-center p-6 relative overflow-hidden select-none antialiased">
      {/* Background Calm Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1F2937_1px,transparent_1px),linear-gradient(to_bottom,#1F2937_1px,transparent_1px)] bg-[size:40px_40px] opacity-25 pointer-events-none" />

      {/* Fullscreen Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-[#0A0A0A]/95 z-[9999] flex flex-col justify-center items-center px-8 transition-opacity duration-500 ease-out select-none">
          <div className="max-w-[400px] w-full space-y-6 text-center animate-fade-in">
            <div className="flex justify-center">
              <RotateCcw className="animate-spin text-accent" size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-medium text-lg text-text-primary tracking-wide">
                Building your plan...
              </h2>
              <p className="text-xs font-mono text-text-secondary uppercase tracking-widest leading-relaxed">
                Gemini is reading your profile and calibrating topic weights...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="w-full max-w-[700px] bg-bg-elevated border border-border rounded-lg p-8 md:p-12 shadow-warm relative overflow-hidden animate-fade-in">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-accent" />

        {error && (
          <div className="mb-6 p-4 bg-danger-light border border-danger/20 text-danger-text rounded-md text-xs font-mono flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {step < 6 && (
          <>
            {/* Header Indicators */}
            <div className="flex justify-between items-center mb-6">
              <GoodluckLogo size={24} showTagline={false} />
              <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest font-black">
                STEP {step} OF {totalSteps}
              </span>
            </div>

            {/* Flat Progress Indicator */}
            <div className="h-[2px] bg-bg-sunken rounded-badge mb-10 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}

        {/* STEP 1: MISSION */}
        {step === 1 && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex items-center gap-3">
              <Target className="text-accent stroke-[2]" size={28} />
              <h2 className="font-display font-bold text-xl text-text-primary tracking-wide">
                Set Your Exam Target
              </h2>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              We build your weekly study schedule based on your target percentile. Goodluck helps you stay consistent day by day.
            </p>

            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                  Your Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jaijith Raja"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent font-sans transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                    Dream IIM Target
                  </label>
                  <select
                    value={formData.dreamIIM}
                    onChange={(e) => setFormData({ ...formData, dreamIIM: e.target.value })}
                    className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value="A">IIM Ahmedabad (A)</option>
                    <option value="B">IIM Bangalore (B)</option>
                    <option value="C">IIM Calcutta (C)</option>
                    <option value="Any">Any Top IIM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                    CAT Exam Target
                  </label>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent font-mono transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold">
                    Target Percentile
                  </label>
                  <span className="font-mono text-xs font-black text-accent">
                    {formData.targetPercentile.toFixed(1)}%ile
                  </span>
                </div>
                <input
                  type="range"
                  min="90"
                  max="100"
                  step="0.1"
                  value={formData.targetPercentile}
                  onChange={(e) =>
                    setFormData({ ...formData, targetPercentile: parseFloat(e.target.value) })
                  }
                  className="w-full accent-accent bg-bg-sunken h-1 rounded-md"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TIME */}
        {step === 2 && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex items-center gap-3">
              <Clock className="text-accent stroke-[2]" size={28} />
              <h2 className="font-display font-bold text-xl text-text-primary tracking-wide">
                Your Available Study Hours
              </h2>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Overscheduling leads to burnout and broken routines. Let&apos;s set realistic hours that you can actually stick to.
            </p>

            <div className="space-y-6 pt-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold">
                    Weekday Availability
                  </label>
                  <span className="font-mono text-xs text-text-primary font-bold">
                    {formData.weekdayHours} hours / day
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={formData.weekdayHours}
                  onChange={(e) =>
                    setFormData({ ...formData, weekdayHours: parseFloat(e.target.value) })
                  }
                  className="w-full accent-accent bg-bg-sunken h-1 rounded-md"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold">
                    Weekend Availability
                  </label>
                  <span className="font-mono text-xs text-text-primary font-bold">
                    {formData.weekendHours} hours / day
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="0.5"
                  value={formData.weekendHours}
                  onChange={(e) =>
                    setFormData({ ...formData, weekendHours: parseFloat(e.target.value) })
                  }
                  className="w-full accent-accent bg-bg-sunken h-1 rounded-md"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-3 font-bold">
                  When do you focus best?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "morning", label: "Morning", desc: "5am - 12pm" },
                    { id: "afternoon", label: "Afternoon", desc: "12pm - 6pm" },
                    { id: "night", label: "Night", desc: "6pm - 12am" },
                  ].map((window) => (
                    <button
                      key={window.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, peakEnergy: window.id as any })}
                      className={`border p-4 rounded-md text-left transition-all cursor-pointer ${
                        formData.peakEnergy === window.id
                          ? "border-accent bg-accent-light text-accent-text"
                          : "border-border hover:border-border-strong bg-bg-surface text-text-secondary"
                      }`}
                    >
                      <div className="font-display font-bold text-sm mb-1">{window.label}</div>
                      <div className="font-mono text-[9px] opacity-80">{window.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: STANDING */}
        {step === 3 && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex items-center gap-3">
              <Activity className="text-accent stroke-[2]" size={28} />
              <h2 className="font-display font-bold text-xl text-text-primary tracking-wide">
                Your Prep Progress
              </h2>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Where are you currently in your preparation? We&apos;ll tailor your plan to match your stage.
            </p>

            <div className="space-y-5 pt-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-3 font-bold">
                  Months into Preparation
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "fresh", label: "Fresh Start" },
                    { id: "1-3", label: "1-3 Months" },
                    { id: "3-6", label: "3-6 Months" },
                    { id: "6+", label: "6+ Months" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, monthsIntoPrep: item.id })}
                      className={`border py-3 rounded-md text-center text-xs font-mono transition-all cursor-pointer ${
                        formData.monthsIntoPrep === item.id
                          ? "border-accent bg-accent-light text-accent-text font-bold"
                          : "border-border bg-bg-surface text-text-secondary"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-5 border-t border-border space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="hasMockScore"
                    checked={formData.hasMockScore}
                    onChange={(e) =>
                      setFormData({ ...formData, hasMockScore: e.target.checked })
                    }
                    className="accent-accent w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="hasMockScore" className="text-xs font-mono text-text-primary cursor-pointer select-none font-bold uppercase">
                    Add a recent mock test score to customize your plan
                  </label>
                </div>

                {formData.hasMockScore && (
                  <div className="p-4 bg-bg-surface border border-border rounded-md animate-fade-in">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                      Overall Percentile
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 96.5"
                      value={formData.lastMockScore}
                      onChange={(e) =>
                        setFormData({ ...formData, lastMockScore: e.target.value })
                      }
                      className="bg-bg-elevated border border-border text-text-primary text-sm rounded-md py-2 px-3 focus:outline-none focus:border-accent font-mono w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: ASSESSMENT */}
        {step === 4 && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex items-center gap-3">
              <BookOpen className="text-accent stroke-[2]" size={28} />
              <h2 className="font-display font-bold text-xl text-text-primary tracking-wide">
                Identify Weak Areas
              </h2>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Let us know which areas you find challenging so we can dedicate more time to them in your study plan.
            </p>

            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 pt-4 border border-border rounded-md p-4 bg-bg-surface">
              {Object.entries(SECTIONS).map(([section, topics]) => (
                <div key={section} className="space-y-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-wider text-accent border-b border-border pb-1 font-bold">
                    {section}
                  </h3>
                  <div className="space-y-2">
                    {topics.map((topic) => {
                      const rating = formData.topics[topic] || "average";
                      return (
                        <div
                          key={topic}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-bg-elevated rounded-md border border-border/40"
                        >
                          <span className="text-xs text-text-primary font-sans font-medium">{topic}</span>
                          <div className="flex gap-1 justify-start sm:justify-end w-full sm:w-auto shrink-0">
                            {(["weak", "average", "strong"] as const).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => handleTopicRating(topic, r)}
                                className={`text-[8px] sm:text-[9px] font-mono px-2 py-1 sm:px-2.5 sm:py-1 rounded-md transition-all uppercase font-bold cursor-pointer ${
                                  rating === r
                                    ? r === "weak"
                                      ? "bg-danger text-white"
                                      : r === "average"
                                      ? "bg-accent text-[#0A0A0A]"
                                      : "bg-success text-white"
                                    : "bg-bg-surface text-text-secondary border border-border"
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: STYLE */}
        {step === 5 && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex items-center gap-3">
              <Heart className="text-accent stroke-[2]" size={28} />
              <h2 className="font-display font-bold text-xl text-text-primary tracking-wide">
                Your Plan Flexibility
              </h2>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Choose how structured you want your daily routine to be.
            </p>

            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-3 font-bold">
                  Daily Schedule Style
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: "structured", label: "Structured Schedule", desc: "Clear hourly blocks for each subject." },
                    { id: "flexible", label: "Adaptive Fluid", desc: "Flexible focus slots that adapt to your day." },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, studyStyle: style.id as any })}
                      className={`border p-4 rounded-md text-left transition-all cursor-pointer ${
                        formData.studyStyle === style.id
                          ? "border-accent bg-accent-light text-accent-text"
                          : "border-border bg-bg-surface text-text-secondary"
                      }`}
                    >
                      <div className="font-display font-bold text-sm mb-1">{style.label}</div>
                      <div className="text-[11px] text-text-secondary leading-relaxed font-sans">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                  What is your biggest preparation challenge?
                </label>
                <select
                  value={formData.biggestFear}
                  onChange={(e) => setFormData({ ...formData, biggestFear: e.target.value })}
                  className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="Running out of time / syllabus coverage">Running out of syllabus time</option>
                  <option value="Losing motivation mid-prep">Losing motivation / burning out mid-way</option>
                  <option value="Weak in one section entirely">Choking on a single weak section</option>
                  <option value="Choking under timed actual exam clock">Timed test-taking anxiety</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: ARCHETYPE SPLASH */}
        {step === 6 && (
          <div className="space-y-8 text-center py-6 animate-slide-in">
            <div className="flex justify-center">
              <div className="bg-success-light border border-success/20 p-4 rounded-full shadow-warm animate-pulse">
                <CheckCircle2 size={48} className="text-success stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="font-display font-medium text-2xl text-text-primary uppercase tracking-wide">
                Your Study Plan is Ready
              </h1>
              <p className="font-mono text-xs text-accent tracking-widest uppercase font-extrabold">
                {(() => {
                  const weakCount = Object.values(formData.topics).filter((r) => r === "weak").length;
                  if (weakCount > 4) return "FLEXIBLE-STRATEGIST";
                  if (formData.weekdayHours <= 2.5) return "EFFICIENT-STUDENT";
                  return "CONSISTENT-ACHIEVER";
                })()}
              </p>
            </div>

            <p className="text-sm text-text-secondary max-w-[450px] mx-auto leading-relaxed font-sans">
              Goodluck has created your personalized consistency plan. We&apos;ll update your weekly schedule automatically to keep you on track.
            </p>

            <div className="pt-4">
              <button
                onClick={handleSubmit}
                className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black uppercase tracking-widest py-3.5 px-8 rounded-md inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm hover:shadow"
              >
                <span>GO TO DASHBOARD</span>
                <ArrowRight size={14} className="stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Navigation controls */}
        {step < 6 && (
          <div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className="text-xs font-mono font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> BACK
            </button>

            {step === totalSteps ? (
              <button
                onClick={nextStep}
                className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-extrabold tracking-widest px-6 py-3 rounded-md flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <span>CREATE MY PLAN</span>
                <Sparkles size={14} className="stroke-[2]" />
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-extrabold tracking-widest px-6 py-3 rounded-md flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              >
                <span>NEXT</span>
                <ArrowRight size={14} className="stroke-[2]" />
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
