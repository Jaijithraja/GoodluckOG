"use client";

import { useEffect, useState } from "react";
import { useStudentStore } from "@/store/studentStore";
import { WeeklyNarrative } from "@/types";
import { Sparkles, Calendar, BookOpen, AlertCircle, FileText, CheckCircle2, ChevronRight, Activity, Clock, Sliders } from "lucide-react";

export default function WeeklyPage() {
  const student = useStudentStore((state) => state.student);
  const weeklyReports = useStudentStore((state) => state.weeklyReports);
  const generateWeeklyReport = useStudentStore((state) => state.generateWeeklyReport);
  const topicWeights = useStudentStore((state) => state.topicWeights);

  const [activeTab, setActiveTab] = useState<"coaching" | "weekly_plan">("weekly_plan");

  useEffect(() => {
    // Generate an initial weekly report if there are none, to populate UI beautifully
    if (student && weeklyReports.length === 0) {
      generateWeeklyReport();
    }
  }, [student, weeklyReports, generateWeeklyReport]);

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <Activity className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase">Compiling weekly coach profiles...</span>
      </div>
    );
  }

  const latestReport = weeklyReports[0];

  // --------------------------------------------------------------------------
  // Dynamic 7-Day Scheduler Logic
  // --------------------------------------------------------------------------
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const calendarDays = [];
  const startDay = new Date();
  
  const prioritizedTopics = [...topicWeights].sort((a, b) => b.weight - a.weight);
  
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(startDay);
    nextDay.setDate(startDay.getDate() + i);
    const dayName = weekdays[nextDay.getDay()];
    const dateStr = nextDay.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const isWeekend = [0, 6].includes(nextDay.getDay());
    
    const hours = isWeekend 
      ? Number(student.available_hours_weekend || 4) 
      : Number(student.available_hours_weekday || 2);
      
    const sessionCount = hours >= 3 ? 2 : 1;
    const assignedSessions = [];
    
    for (let s = 0; s < sessionCount; s++) {
      const topicIdx = (i * 2 + s) % (prioritizedTopics.length || 1);
      const topicObj = prioritizedTopics[topicIdx] || { topic: "Reading Comprehension", section: "VARC", weight: 0.5 };
      
      let sType = "Practice";
      if (student.prep_phase === "Foundation") {
        sType = s === 0 ? "Learn" : "Practice";
      } else if (student.prep_phase === "Acceleration") {
        sType = s === 0 ? "Practice" : "Revise";
      } else if (student.prep_phase === "Crunch") {
        sType = s === 0 ? "Revise" : "Practice";
      } else {
        sType = s === 0 ? "Revise" : "Recovery";
      }
      
      assignedSessions.push({
        topic: topicObj.topic,
        section: topicObj.section,
        session_type: sType,
        duration: Math.round((hours * 60) / sessionCount),
        priority: topicObj.weight
      });
    }
    
    calendarDays.push({
      dayName,
      dateStr,
      isWeekend,
      hours,
      sessions: assignedSessions
    });
  }

  return (
    <div className="space-y-8 max-w-[800px] w-full animate-fade-in antialiased text-text-primary selection:bg-accent-light selection:text-accent-text">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-text-secondary uppercase block mb-2 font-bold font-sans">
            ADAPTIVE COCKPIT SCHEDULING
          </span>
          <h1 className="font-display font-medium text-3xl tracking-tight text-text-primary">
            Weekly Coaching
          </h1>
        </div>

        {activeTab === "coaching" && (
          <button
            onClick={() => generateWeeklyReport()}
            className="border border-accent/40 hover:bg-accent-light text-accent text-xs font-mono font-bold py-2.5 px-6 rounded-md transition-all cursor-pointer uppercase tracking-wider shadow-sm"
          >
            GENERATE THIS WEEK&apos;S REPORT
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("weekly_plan")}
          className={`flex-1 py-3 text-xs font-mono font-black uppercase tracking-wider text-center border-b-2 cursor-pointer transition-all ${
            activeTab === "weekly_plan"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Calendar size={13} />
            7-DAY STUDY BLUEPRINT
          </span>
        </button>
        <button
          onClick={() => setActiveTab("coaching")}
          className={`flex-1 py-3 text-xs font-mono font-black uppercase tracking-wider text-center border-b-2 cursor-pointer transition-all ${
            activeTab === "coaching"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <FileText size={13} />
            AI DIAGNOSTIC REPORTS
          </span>
        </button>
      </div>

      {/* TAB 1: Upcoming Dynamic Study Blueprint */}
      {activeTab === "weekly_plan" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-bg-elevated border border-border p-5 rounded-lg shadow-sm">
            <span className="font-mono text-[9px] text-accent uppercase tracking-widest font-black block mb-1">
              SCHEDULING ALGORITHM STATUS
            </span>
            <p className="text-xs text-text-secondary leading-relaxed">
              Plan auto-calibrates. Increasing master topic weights on your **Prioritisation Board** instantly shifts more slots to that subject.
            </p>
          </div>

          <div className="space-y-4">
            {calendarDays.map((day, idx) => (
              <div
                key={idx}
                className={`border border-border/80 bg-bg-surface rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-calm hover:border-border-strong relative overflow-hidden`}
              >
                {day.isWeekend && (
                  <div className="absolute top-0 right-0 bg-accent-light border-l border-b border-accent/25 text-accent-text text-[8px] font-mono font-black px-2.5 py-1 rounded-bl-md uppercase">
                    WEEKEND CYCLE
                  </div>
                )}

                {/* Left: Date Display */}
                <div className="space-y-0.5 min-w-[120px]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-black">
                    {day.dayName.toUpperCase()}
                  </span>
                  <h4 className="font-display font-black text-base text-text-primary tracking-wide">
                    {day.dateStr}
                  </h4>
                  <span className="text-[9px] font-mono text-accent uppercase font-semibold">
                    {day.hours} HOURS STUDY GRID
                  </span>
                </div>

                {/* Center: Sessions Blocks */}
                <div className="flex-1 space-y-3 w-full md:w-auto">
                  {day.sessions.map((sess, sIdx) => {
                    let badge = "bg-accent-light text-accent-text border border-accent/20";
                    if (sess.section === "DILR") {
                      badge = "bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/30";
                    } else if (sess.section === "Quant") {
                      badge = "bg-[#10B981]/10 text-[#A7F3D0] border border-[#10B981]/30";
                    }
                    return (
                      <div
                        key={sIdx}
                        className="bg-bg-elevated border border-border/50 rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-badge ${badge}`}>
                              {sess.section}
                            </span>
                            <span className="text-[9px] font-mono text-text-secondary uppercase font-semibold">
                              {sess.session_type} BLOCK
                            </span>
                          </div>
                          <h5 className="font-display font-semibold text-sm text-text-primary tracking-wide">
                            {sess.topic}
                          </h5>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <span className="font-mono text-xs text-text-primary font-bold flex items-center gap-1">
                            <Clock size={12} className="text-text-secondary" />
                            {sess.duration} MINS
                          </span>
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

      {/* TAB 2: AI Diagnostic Reports */}
      {activeTab === "coaching" && (
        <div className="space-y-6 animate-fade-in">
          {latestReport ? (
            <div className="space-y-6">
              {/* Headline Banner */}
              <div className="bg-bg-elevated border border-accent/25 p-6 rounded-lg shadow-warm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-accent" />
                <span className="font-mono text-[9px] text-accent uppercase tracking-widest block mb-2 font-black">
                  Executive Diagnosis
                </span>
                <h2 className="font-display font-medium text-lg text-text-primary leading-relaxed">
                  &quot;{latestReport.narrative?.headline || "No baseline computed yet."}&quot;
                </h2>
              </div>

              {/* Full Narrative Card */}
              <div className="bg-bg-elevated border border-border rounded-lg p-6 md:p-8 space-y-6 shadow-warm">
                <div className="flex items-center gap-2.5 border-b border-border pb-4">
                  <FileText className="text-accent stroke-[2]" size={20} />
                  <h3 className="font-display font-bold text-base text-text-primary uppercase tracking-wide">
                    Coaching Narrative
                  </h3>
                </div>

                <div className="space-y-5 font-sans text-sm text-text-secondary leading-relaxed">
                  <div>
                    <span className="font-mono text-[10px] uppercase font-black text-text-primary block mb-1">Genuine Wins</span>
                    <p>{latestReport.narrative?.what_worked}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] uppercase font-black text-text-primary block mb-1">Attention Required</span>
                    <p>{latestReport.narrative?.what_to_watch}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] uppercase font-black text-text-primary block mb-1">Strategic Shift Plan</span>
                    <p>{latestReport.narrative?.one_change}</p>
                  </div>

                  <div className="p-4 bg-bg-surface rounded-md border border-border/60">
                    <span className="font-mono text-[10px] uppercase font-black text-accent block mb-1">Study Priority Adaptation</span>
                    <p className="text-xs">{latestReport.narrative?.adaptation_summary}</p>
                  </div>

                  <div className="italic text-xs border-l-2 border-accent pl-3 text-text-secondary font-display mt-4">
                    &quot;{latestReport.narrative?.encouragement}&quot;
                  </div>
                </div>

                <div className="h-[1px] bg-border my-6" />

                {/* Sub-breakdowns of adjustments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-bg-surface border border-border/80 rounded-lg p-4 space-y-2">
                    <span className="font-mono text-[9px] text-success uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                      <CheckCircle2 size={12} /> Key Target Topics
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {latestReport.topics_covered.map((t, idx) => (
                        <span
                          key={idx}
                          className="bg-bg-elevated border border-border text-text-secondary text-[9px] font-mono px-2 py-0.5 rounded-badge uppercase font-bold"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-bg-surface border border-border/80 rounded-lg p-4 space-y-2">
                    <span className="font-mono text-[9px] text-warning uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                      <AlertCircle size={12} /> Avoidance Warnings
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {latestReport.weak_topics.map((t, idx) => (
                        <span
                          key={idx}
                          className="bg-warning-light border border-warning/20 text-warning text-[9px] font-mono px-2 py-0.5 rounded-badge uppercase font-bold"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-12 bg-bg-elevated border border-dashed border-border rounded-lg font-mono text-xs text-text-secondary uppercase shadow-sm">
              No weekly reports logged. Tap the generator to analyze study metrics.
            </div>
          )}

          {/* Archive of past weeks */}
          {weeklyReports.length > 1 && (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-base text-text-primary tracking-wide uppercase">
                Weekly Report Archive
              </h3>

              <div className="space-y-3">
                {weeklyReports.slice(1).map((report) => (
                  <div
                    key={report.id}
                    className="bg-bg-elevated border border-border hover:border-border-strong rounded-lg p-5 flex justify-between items-center transition-all cursor-pointer shadow-sm hover:shadow"
                  >
                    <div>
                      <h4 className="font-display font-bold text-sm text-text-primary">
                        Week ending {report.week_end}
                      </h4>
                      <p className="text-[9px] text-text-secondary font-mono uppercase mt-1">
                        Completed: {report.sessions_completed} sessions &bull; Topics covered: {report.topics_covered.length}
                      </p>
                    </div>

                    <ChevronRight size={16} className="text-text-secondary" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aesthetic Spacer */}
      <div className="h-6" />

    </div>
  );
}
