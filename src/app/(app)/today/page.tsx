"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { PlannedSession } from "@/types";
import { Sparkles, Play, Clock, AlertCircle, CheckCircle2, RefreshCw, X, HelpCircle, Brain, ChevronUp, ChevronDown, Timer, Pause, RotateCcw, SkipForward, Sliders, Zap } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase/client";

export default function TodayPlanPage() {
  const router = useRouter();
  
  // Zustand selectors
  const student = useStudentStore((state) => state.student);
  const dailyPlans = useStudentStore((state) => state.dailyPlans);
  const sessionLogs = useStudentStore((state) => state.sessionLogs);
  const replanToday = useStudentStore((state) => state.replanToday);
  const logSession = useStudentStore((state) => state.logSession);
  const topicWeights = useStudentStore((state) => state.topicWeights);
  const adjustTopicWeight = useStudentStore((state) => state.adjustTopicWeight);
  const weeklyReports = useStudentStore((state) => state.weeklyReports);

  // Local component states
  const [activeSession, setActiveSession] = useState<PlannedSession | null>(null);
  const [showLogger, setShowLogger] = useState(false);
  const [expandedSessionIdx, setExpandedSessionIdx] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [avoidanceApplied, setAvoidanceApplied] = useState(false);
  const [commitmentChecked, setCommitmentChecked] = useState(false);

  // Focus Timer Local State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerDuration, setTimerDuration] = useState(25); // planned minutes
  const [timerTab, setTimerTab] = useState<"timer" | "manual">("timer");

  // Logger Form State
  const [logForm, setLogForm] = useState({
    completed: true as boolean,
    actualDuration: 45,
    difficulty: 3,
    focus: 4,
    notes: "",
  });

  // Pomodoro/Focus Timer Ticking logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      
      // Web Audio Beep Chime
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.35);
      } catch (e) {
        console.warn("Audio chime failed", e);
      }

      setToastMessage("Focus Session Complete! Ready to log.");
      setLogForm((prev) => ({ ...prev, actualDuration: timerDuration }));
      setTimerTab("manual");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds, timerDuration]);

  const generatePlan = async (studentId: string) => {
    setGeneratingPlan(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.functions.invoke("generate-plan", {
        body: { student_id: studentId },
      });
      if (error) throw error;
      await useStudentStore.getState().loadFromSupabase();
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to generate plan. Please try again.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  useEffect(() => {
    const checkStudentAndOnboarding = async () => {
      // Check if student profile is active
      const activeStudent = useStudentStore.getState().student;

      if (!activeStudent) {
        router.push("/onboarding");
        return;
      }

      if (!activeStudent.onboarding_complete) {
        router.push("/onboarding");
        return;
      }

      // Verify if today's study blueprint is already generated
      const plans = useStudentStore.getState().dailyPlans;
      const todayStr = new Date().toISOString().split("T")[0];
      const hasTodayPlan = plans.some(p => p.plan_date === todayStr);

      if (!hasTodayPlan) {
        setGeneratingPlan(true);
        try {
          await useStudentStore.getState().replanToday();
        } catch (err) {
          console.error("Local plan generation failed:", err);
        } finally {
          setGeneratingPlan(false);
        }
      }

      setPageLoading(false);
    };

    checkStudentAndOnboarding();
  }, [student, router]);

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <RefreshCw className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase">Loading your plan...</span>
      </div>
    );
  }

  if (generatingPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <RefreshCw className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase font-bold">Building your plan for today...</span>
        <span className="text-xs text-text-secondary/70 font-sans text-center max-w-[280px]">Gemini is reading your profile and topic weights...</span>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <AlertCircle className="text-danger" size={32} />
        <span className="font-sans text-sm text-text-secondary">Please complete your onboarding profile to view plans.</span>
        <button
          onClick={() => router.push("/onboarding")}
          className="bg-accent text-[#0A0A0A] text-xs font-mono font-bold tracking-widest py-2 px-4 rounded"
        >
          GO TO ONBOARDING
        </button>
      </div>
    );
  }

  const activePlan = dailyPlans[0];

  if (!activePlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 antialiased bg-bg-base text-text-primary text-center p-6 border border-dashed border-border rounded-lg max-w-[800px] mx-auto mt-12">
        <Sparkles className="text-accent animate-pulse" size={32} />
        <h3 className="font-display font-medium text-lg text-text-primary">No plan generated for today yet</h3>
        <p className="text-xs text-text-secondary max-w-[320px] font-sans">
          Click below to let Gemini analyze your profile and build your personalized daily schedule.
        </p>
        {errorMsg && (
          <div className="p-3 bg-danger-light border border-danger/20 text-danger-text rounded text-xs font-mono">
            {errorMsg}
          </div>
        )}
        <button
          onClick={() => student && generatePlan(student.id)}
          className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black uppercase tracking-widest py-3 px-6 rounded-md shadow-sm transition-all cursor-pointer"
        >
          Generate today&apos;s plan
        </button>
      </div>
    );
  }

  // Dynamically calculate days remaining based on actual system date and exam_date
  const examDate = new Date(student.exam_date + "T00:00:00");
  const systemToday = new Date();
  examDate.setHours(0, 0, 0, 0);
  systemToday.setHours(0, 0, 0, 0);
  const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - systemToday.getTime()) / (1000 * 60 * 60 * 24)));

  const handleOpenLogger = (session: PlannedSession) => {
    setActiveSession(session);
    setLogForm({
      completed: true,
      actualDuration: session.duration_minutes,
      difficulty: 3,
      focus: 4,
      notes: "",
    });
    setTimerDuration(session.duration_minutes);
    setTimerSeconds(session.duration_minutes * 60);
    setIsTimerRunning(false);
    setTimerTab("timer");
    setCommitmentChecked(false);
    setShowLogger(true);
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    logSession({
      plan_id: activePlan?.id || undefined,
      log_date: new Date().toISOString().split("T")[0],
      topic: activeSession.topic,
      section: activeSession.section,
      session_type: activeSession.session_type,
      planned_duration_minutes: activeSession.duration_minutes,
      actual_duration_minutes: logForm.actualDuration,
      difficulty_rating: logForm.difficulty,
      focus_rating: logForm.focus,
      completed: logForm.completed,
      notes: logForm.notes,
    });

    setShowLogger(false);
    setIsTimerRunning(false);
    
    if (logForm.completed === true) {
      confetti({
        particleCount: 120,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#E8FF47", "#4ADE80", "#F5F5F5"],
      });
      setToastMessage("Session synchronized. Adaptation models scaled.");
    } else {
      setToastMessage("Session logged. Study weights adapted.");
    }

    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  return (
    <div className="space-y-8 max-w-[800px] w-full animate-fade-in antialiased text-text-primary selection:bg-accent-light selection:text-accent-text">
      
      {/* Toast Alert popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-bg-elevated border border-success/30 text-success text-xs font-mono py-3.5 px-6 rounded-md shadow-warmLg flex items-center gap-3 animate-slide-in">
          <CheckCircle2 size={16} className="text-success" />
          <span>{toastMessage.toUpperCase()}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-[10px] font-mono tracking-widest text-text-secondary uppercase font-bold">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </span>
            <span className="bg-accent-light text-accent-text border border-accent/20 text-[9px] font-mono font-black px-2 py-0.5 rounded-badge uppercase">
              {student.prep_phase} PHASE
            </span>
          </div>
          <h1 className="font-display font-medium text-3xl tracking-tight text-text-primary">
            Today&apos;s Execution
          </h1>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-extrabold text-accent">
            {daysRemaining}
          </span>
          <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest font-black">
            DAYS TO CAT
          </span>
        </div>
      </div>

      {/* Weekly One-Change Sync Banner */}
      {weeklyReports && weeklyReports.length > 0 && weeklyReports[0].narrative?.one_change && (
        <div className="bg-[#4ADE80]/5 border border-[#4ADE80]/20 rounded-lg p-4 flex items-start gap-3 shadow-sm text-xs font-sans animate-fade-in">
          <Brain size={16} className="text-accent stroke-[2] mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest font-bold block">This Week&apos;s Focal Sync</span>
            <p className="text-text-primary leading-relaxed">{weeklyReports[0].narrative.one_change}</p>
          </div>
        </div>
      )}

      {/* Dynamic Alerts Strip */}
      {activePlan && activePlan.dynamic_alerts && activePlan.dynamic_alerts.length > 0 && (
        <div className="space-y-2.5">
          {activePlan.dynamic_alerts.map((alert, idx) => {
            const isCritical = alert.severity === "critical";
            const isWarning = alert.severity === "warning";
            return (
              <div
                key={idx}
                className={`p-4 rounded-md border text-xs font-mono flex items-center gap-3 animate-fade-in ${
                  isCritical
                    ? "bg-danger-light border-danger/25 text-danger"
                    : isWarning
                    ? "bg-warning-light border-warning/25 text-warning font-semibold"
                    : "bg-accent-light border-accent/25 text-accent-text"
                }`}
              >
                <AlertCircle size={15} />
                <span>{alert.message.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Daily schedule card */}
      <div className="bg-bg-elevated border border-border rounded-lg p-6 md:p-8 space-y-6 shadow-warm relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <div className="space-y-1">
            <h2 className="font-display font-semibold text-lg text-text-primary">Daily Study Blocks</h2>
            <p className="text-xs text-text-secondary font-sans leading-relaxed">
              Calibrated dynamically according to your weakness weight constraints.
            </p>
          </div>

          <button
            onClick={() => {
              replanToday();
              setToastMessage("AI recalibration complete.");
              setTimeout(() => setToastMessage(""), 3000);
            }}
            className="flex items-center gap-1.5 border border-border-strong hover:border-accent hover:bg-accent-light text-[10px] font-mono font-bold tracking-widest text-text-secondary hover:text-accent-text py-2.5 px-4 rounded-md transition-all cursor-pointer uppercase"
          >
            <RefreshCw size={12} />
            <span>REPLAN TODAY</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="space-y-4">
          {(() => {
            const avoidedTopics = topicWeights.filter((tw) => tw.weight >= 0.8 || tw.avoidance_flag);
            if (avoidedTopics.length > 0 && !avoidanceApplied) {
              const matchedSession = activePlan?.sessions.find(s => s.topic === avoidedTopics[0].topic && s.duration_minutes > 15);
              if (matchedSession) {
                return (
                  <div className="bg-[#FEF3E6]/10 border border-warning/30 rounded-lg p-5 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] font-black text-warning bg-warning/10 border border-warning/25 px-2 py-0.5 rounded-badge tracking-widest uppercase flex items-center gap-1">
                        <Zap size={9} className="stroke-[2.5]" />
                        Study Avoidance Watchpoint
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed font-sans">
                      You have skipped or avoided <span className="text-text-primary font-bold">{avoidedTopics[0].topic}</span> recently. Let&apos;s make starting easier by swapping this block for a low-pressure <span className="text-text-primary font-bold">15-minute concept review warmup</span>.
                    </p>
                    <button
                      onClick={() => {
                        const updatedSessions = activePlan.sessions.map((s) => {
                          if (s.topic === avoidedTopics[0].topic) {
                            return {
                              ...s,
                              duration_minutes: 15,
                              session_type: "Practice" as const,
                              rationale: "Scaled down dynamically to break study avoidance friction."
                            };
                          }
                          return s;
                        });
                        activePlan.sessions = updatedSessions;
                        setAvoidanceApplied(true);
                        setToastMessage("Warmup applied! Planned block scaled to 15m.");
                        setTimeout(() => setToastMessage(""), 4000);
                      }}
                      className="bg-warning text-[#0A0A0A] hover:bg-warning/90 text-[10px] font-mono font-black tracking-widest py-2.5 px-4 rounded-md uppercase transition-all cursor-pointer block w-fit"
                    >
                      Apply 15-Min Warmup
                    </button>
                  </div>
                );
              }
            }
            return null;
          })()}

          {activePlan?.sessions && activePlan.sessions.length > 0 ? (
            activePlan.sessions.map((session, idx) => {
              const isLogged = sessionLogs.some(
                (l) => l.topic === session.topic && l.log_date === new Date().toISOString().split("T")[0]
              );
              
              let sectionBadge = "bg-accent-light text-accent-text border border-accent/20";
              if (session.section === "DILR") {
                sectionBadge = "bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/30";
              } else if (session.section === "Quant") {
                sectionBadge = "bg-[#10B981]/10 text-[#A7F3D0] border border-[#10B981]/30";
              } else if (session.section === "VARC") {
                sectionBadge = "bg-[#3B82F6]/10 text-[#93C5FD] border border-[#3B82F6]/30";
              }

              return (
                <div
                  key={idx}
                  className={`border border-border/80 bg-bg-surface rounded-lg p-5 transition-calm relative ${
                    isLogged ? "opacity-45 border-success/30" : "hover:border-border-strong"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-badge ${sectionBadge}`}>
                          {session.section}
                        </span>
                        <span className="text-[10px] font-mono text-text-secondary uppercase font-semibold">
                          {session.session_type}
                        </span>
                      </div>
                      <h3 className="font-display font-semibold text-base text-text-primary tracking-wide pt-0.5">
                        {session.topic}
                      </h3>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-text-primary font-bold flex items-center gap-1.5">
                        <Clock size={14} className="text-text-secondary" />
                        {session.duration_minutes} MINS
                      </span>

                      {isLogged ? (
                        <div className="flex items-center gap-1.5 text-success font-mono text-[10px] font-black uppercase tracking-wider">
                          <CheckCircle2 size={16} />
                          <span>LOGGED</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenLogger(session)}
                          className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-[10px] font-mono font-black py-2.5 px-5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer uppercase tracking-widest shadow-sm hover:shadow"
                        >
                          <Play size={10} className="fill-[#0A0A0A] text-[#0A0A0A]" />
                          <span>LOG WORK</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable rationale drawer */}
                  <div className="mt-4 pt-3 border-t border-border/30">
                    <button
                      onClick={() => setExpandedSessionIdx(expandedSessionIdx === idx ? null : idx)}
                      className="text-[9px] font-mono tracking-wider text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer uppercase transition-colors font-bold"
                    >
                      <HelpCircle size={12} />
                      <span>{expandedSessionIdx === idx ? "HIDE ADAPTIVE ANALYSIS" : "VIEW ADAPTIVE ANALYSIS"}</span>
                    </button>

                    {expandedSessionIdx === idx && (
                      <p className="mt-2 text-xs text-text-secondary leading-relaxed bg-bg-base border border-border rounded-md p-3 font-sans animate-fade-in shadow-inner">
                        &quot;{session.rationale}&quot;
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center p-8 border border-dashed border-border/60 rounded-md font-mono text-xs text-text-secondary uppercase">
              No sessions active. Replanning available.
            </div>
          )}
        </div>

        {/* Global Blueprint Rationale */}
        {activePlan && (
          <div className="bg-bg-base border border-border rounded-md p-4 text-xs">
            <span className="font-mono text-[9px] text-accent uppercase tracking-widest font-black block mb-1">
              AI STUDY TIP
            </span>
            <p className="text-text-secondary leading-relaxed font-sans">{activePlan.rationale}</p>
          </div>
        )}
      </div>

      {/* ====================================================================
          DYNAMIC PRIORITISATION BOARD
          ==================================================================== */}
      <div className="bg-bg-elevated border border-border rounded-lg p-6 md:p-8 space-y-6 shadow-warm">
        <div className="flex justify-between items-center mb-2">
          <div className="space-y-1">
            <h2 className="font-display font-semibold text-lg text-text-primary flex items-center gap-2">
              <Sliders size={18} className="text-accent" />
              Subject Priority Board
            </h2>
            <p className="text-xs text-text-secondary font-sans leading-relaxed">
              A live view of topics needing more attention based on your preparation progress.
            </p>
          </div>
        </div>

        <div className="space-y-3.5">
          {[...topicWeights].sort((a, b) => b.weight - a.weight).map((weightObj, idx) => {
            const urgencyVal = weightObj.weight;
            let urgencyLabel = "STEADY PACE";
            let urgencyColor = "text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30";
            let reasonStr = "Normal study sequence for syllabus completion.";

            if (urgencyVal >= 0.8) {
              urgencyLabel = "NEEDS ATTENTION";
              urgencyColor = "text-danger bg-danger-light border-danger/35";
              reasonStr = weightObj.avoidance_flag 
                ? "You seem to be skipping this topic recently: study this first."
                : "You have not studied this topic in a while: schedule a session.";
            } else if (urgencyVal >= 0.6) {
              urgencyLabel = "HIGH PRIORITY";
              urgencyColor = "text-warning bg-warning-light border-warning/35";
              reasonStr = "Your focus on this section is below your target plan.";
            } else if (urgencyVal < 0.35) {
              urgencyLabel = "WELL PREPARED";
              urgencyColor = "text-success bg-success-light border-success/35";
              reasonStr = "You are doing great in this topic: keep it revised.";
            }

            let secBadge = "bg-[#3B82F6]/10 text-[#93C5FD] border border-[#3B82F6]/30";
            if (weightObj.section === "DILR") {
              secBadge = "bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/30";
            } else if (weightObj.section === "Quant") {
              secBadge = "bg-[#10B981]/10 text-[#A7F3D0] border border-[#10B981]/30";
            }

            return (
              <div key={weightObj.id || idx} className="bg-bg-surface border border-border/60 rounded-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-calm hover:border-border-strong">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-badge ${secBadge}`}>
                      {weightObj.section}
                    </span>
                    <h4 className="font-display font-bold text-sm text-text-primary tracking-wide">
                      {weightObj.topic}
                    </h4>
                    <span className={`text-[8px] font-mono font-black tracking-widest px-2 py-0.5 rounded-badge uppercase ${urgencyColor}`}>
                      {urgencyLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed font-sans italic">{reasonStr}</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t border-border/30 pt-3 md:pt-0 md:border-0">
                  <div className="space-y-1 md:text-right">
                    <span className="text-[9px] font-mono text-text-secondary uppercase tracking-widest block font-bold">
                      ATTENTION WEIGHT
                    </span>
                    <span className="font-mono text-xs font-black text-accent-text bg-accent-light px-2 py-0.5 rounded-md border border-accent/25">
                      {urgencyVal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      title="Calibrate Priority Upward"
                      onClick={() => adjustTopicWeight(weightObj.topic, weightObj.weight + 0.1)}
                      className="p-1.5 border border-border hover:border-accent bg-bg-surface hover:bg-accent-light text-text-secondary hover:text-accent rounded-md cursor-pointer transition-all"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      title="Calibrate Priority Downward"
                      onClick={() => adjustTopicWeight(weightObj.topic, weightObj.weight - 0.1)}
                      className="p-1.5 border border-border hover:border-accent bg-bg-surface hover:bg-accent-light text-text-secondary hover:text-accent rounded-md cursor-pointer transition-all"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          MODAL DIALOG: STUDY SESSION LOGGER & INTERACTIVE TIMER
          ==================================================================== */}
      {showLogger && activeSession && (
        <div className="fixed inset-0 bg-text-primary/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] bg-bg-elevated border border-accent/20 rounded-lg p-5 sm:p-8 shadow-warmLg relative animate-fade-in max-h-[95vh] overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-accent" />

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5">
                <Brain className="text-accent stroke-[2]" size={20} />
                <h3 className="font-display font-bold text-base text-text-primary tracking-wide uppercase">
                  SESSION CONTROL CENTER
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowLogger(false);
                  setIsTimerRunning(false);
                }}
                className="text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selector Tab Controls */}
            <div className="flex border-b border-border mb-6">
              <button
                type="button"
                onClick={() => setTimerTab("timer")}
                className={`flex-1 py-2.5 text-xs font-mono font-black uppercase tracking-wider text-center border-b-2 cursor-pointer transition-all ${
                  timerTab === "timer"
                    ? "border-accent text-accent"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Timer size={13} />
                  FOCUS TIMER
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTimerTab("manual")}
                className={`flex-1 py-2.5 text-xs font-mono font-black uppercase tracking-wider text-center border-b-2 cursor-pointer transition-all ${
                  timerTab === "manual"
                    ? "border-accent text-accent"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Sliders size={13} />
                  MANUAL LOG
                </span>
              </button>
            </div>

            {/* Micro-Habit Focus Commitment Hook */}
            <div className={`p-4 rounded-md border text-xs font-sans transition-all duration-300 mb-6 ${
              commitmentChecked 
                ? "bg-accent/10 border-accent/30 text-text-primary animate-pulse-subtle" 
                : "bg-bg-surface border-border text-text-secondary"
            }`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="micro-habit-commitment"
                  checked={commitmentChecked}
                  onChange={(e) => setCommitmentChecked(e.target.checked)}
                  className="mt-0.5 accent-accent h-4 w-4 rounded cursor-pointer"
                />
                <label htmlFor="micro-habit-commitment" className="cursor-pointer select-none leading-relaxed">
                  <span className="font-mono text-[9px] font-black uppercase tracking-widest block mb-0.5 text-text-primary">
                    ⚡️ Micro-Habit Focus Commitment
                  </span>
                  I will put my phone in another room or turn on Do Not Disturb for this entire session.
                </label>
              </div>
            </div>

            {/* TAB 1: Pomodoro / StopWatch Circular Focus Timer */}
            {timerTab === "timer" && (
              <div className="flex flex-col items-center justify-center py-6 space-y-8 animate-fade-in">
                <div className="text-center">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary font-bold block mb-1">
                    FOCUSING ON
                  </span>
                  <h4 className="font-display font-extrabold text-lg text-text-primary tracking-wide">
                    {activeSession.topic}
                  </h4>
                </div>

                {/* Circular Countdown Tracker */}
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 120 120">
                    {/* Background track */}
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="transparent"
                      className="stroke-border/40"
                      strokeWidth="6"
                    />
                    {/* Pulsing Active circular progress */}
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="transparent"
                      className={`${isTimerRunning ? "stroke-accent" : "stroke-accent/60"} transition-all duration-300`}
                      strokeWidth="6"
                      strokeDasharray="314.16"
                      strokeDashoffset={314.16 * (1 - ((timerDuration * 60 - timerSeconds) / (timerDuration * 60 || 1)))}
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Digital Clock Display */}
                  <div className="text-center z-10 space-y-1">
                    <span className={`font-display font-extrabold text-4xl text-text-primary tracking-tighter ${isTimerRunning ? "animate-pulse" : ""}`}>
                      {Math.floor(timerSeconds / 60).toString().padStart(2, "0")}:
                      {(timerSeconds % 60).toString().padStart(2, "0")}
                    </span>
                    <span className="text-[9px] font-mono tracking-widest text-text-secondary uppercase block font-black">
                      {isTimerRunning ? "RUNNING" : "PAUSED"}
                    </span>
                  </div>
                </div>

                {/* Clock Controls */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    title="Reset Timer"
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerSeconds(timerDuration * 60);
                    }}
                    className="p-3 border border-border bg-bg-surface hover:bg-bg-elevated hover:border-border-strong text-text-secondary rounded-md cursor-pointer transition-all shadow-sm"
                  >
                    <RotateCcw size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className="h-14 w-28 bg-accent hover:bg-accent/90 text-[#0A0A0A] font-mono font-black text-xs uppercase tracking-widest rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md hover:shadow-lg"
                  >
                    {isTimerRunning ? (
                      <>
                        <Pause size={14} className="fill-[#0A0A0A]" />
                        <span>PAUSE</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} className="fill-[#0A0A0A]" />
                        <span>FOCUS</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    title="Fast Forward to Complete"
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerSeconds(0);
                      // Web Audio beep and complete
                      try {
                        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const oscillator = audioCtx.createOscillator();
                        oscillator.frequency.value = 880;
                        oscillator.connect(audioCtx.destination);
                        oscillator.start();
                        oscillator.stop(audioCtx.currentTime + 0.15);
                      } catch {}
                      setLogForm((prev) => ({ ...prev, actualDuration: timerDuration }));
                      setTimerTab("manual");
                      setToastMessage("Focus block finished. Summarise your progress below.");
                    }}
                    className="p-3 border border-border bg-bg-surface hover:bg-bg-elevated hover:border-border-strong text-text-secondary rounded-md cursor-pointer transition-all shadow-sm"
                  >
                    <SkipForward size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Manual Study Session Logger */}
            {timerTab === "manual" && (
              <form onSubmit={handleLogSubmit} className="space-y-5 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                    Logged Topic
                  </label>
                  <div className="w-full bg-bg-surface border border-border text-text-primary text-sm font-semibold rounded-md py-2.5 px-3 select-none">
                    {activeSession.topic}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                      Execution State
                    </label>
                    <select
                      value={logForm.completed ? "yes" : "no"}
                      onChange={(e) => setLogForm({ ...logForm, completed: e.target.value === "yes" })}
                      className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent"
                    >
                      <option value="yes">Completed successfully</option>
                      <option value="no">Abandoned mid-way</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                      Actual Minutes Studied
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={logForm.actualDuration}
                      onChange={(e) =>
                        setLogForm({ ...logForm, actualDuration: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2 px-3 focus:outline-none focus:border-accent font-mono text-center font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                    Cognitive Difficulty (1-5)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLogForm({ ...logForm, difficulty: lvl })}
                        className={`flex-grow border py-2.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                          logForm.difficulty === lvl
                            ? "border-accent bg-accent-light text-accent-text"
                            : "border-border bg-bg-surface text-text-secondary"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                    Focus Quality (1-5)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLogForm({ ...logForm, focus: lvl })}
                        className={`flex-grow border py-2.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                          logForm.focus === lvl
                            ? "border-accent bg-accent-light text-accent-text"
                            : "border-border bg-bg-surface text-text-secondary"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                    Execution Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Smashed RC sets cleanly today but struggled with Geometry rules."
                    value={logForm.notes}
                    onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                    className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black py-3.5 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-widest mt-6 shadow-sm hover:shadow"
                >
                  <span>Synchronize Execution Log</span>
                  <CheckCircle2 size={14} className="stroke-[2.5]" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
