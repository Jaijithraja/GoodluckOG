"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { Sparkles, Calendar, Flame, Target, AlertTriangle, Play, CheckCircle2, RotateCcw, ShieldAlert, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const router = useRouter();
  
  // Zustand selectors
  const student = useStudentStore((state) => state.student);
  const topicWeights = useStudentStore((state) => state.topicWeights);
  const dailyPlans = useStudentStore((state) => state.dailyPlans);
  const sessionLogs = useStudentStore((state) => state.sessionLogs);
  const adaptationLogs = useStudentStore((state) => state.adaptationLogs);
  const manualRecovery = useStudentStore((state) => state.manualRecovery);
  const setDaysRemaining = useStudentStore((state) => state.setDaysRemaining);

  // Care Layer AI states
  const [burnoutMessage, setBurnoutMessage] = useState("");
  const [burnoutLoading, setBurnoutLoading] = useState(false);

  useEffect(() => {
    if (student && !student.onboarding_complete) {
      router.push("/onboarding");
    }
  }, [student, router]);

  useEffect(() => {
    // Fetch live custom support coaching text from Claude API route if burnout risk is high
    const getBurnoutMessage = async () => {
      if (!student || student.id === "student-123" || student.burnout_risk_score < 0.6) return;
      setBurnoutLoading(true);
      try {
        const response = await fetch('/api/burnout-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: student.id })
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson && resJson.message) {
            setBurnoutMessage(resJson.message);
          }
        }
      } catch (err) {
        console.warn("Could not retrieve AI burnout care narrative, using static default.", err);
      } finally {
        setBurnoutLoading(false);
      }
    };

    getBurnoutMessage();
  }, [student]);

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <RotateCcw className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase">Compiling dashboard data...</span>
      </div>
    );
  }

  // Dynamically calculate days remaining based on actual system date and exam_date
  const examDate = new Date(student.exam_date + "T00:00:00");
  const systemToday = new Date();
  examDate.setHours(0, 0, 0, 0);
  systemToday.setHours(0, 0, 0, 0);
  const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - systemToday.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate statistics
  const completedCount = sessionLogs.filter((l) => l.completed).length;
  const executionHealth = Math.round(
    sessionLogs.length > 0 ? (completedCount / sessionLogs.length) * 100 : 92
  );

  const totalCoverage = topicWeights.reduce((acc, tw) => acc + tw.coverage_percent, 0);
  const avgCoverage = Math.round(totalCoverage / (topicWeights.length || 1));

  // Heatmap generation (last 30 days)
  const today = new Date();
  const heatmapData = Array.from({ length: 30 }).map((_, idx) => {
    const d = new Date();
    d.setDate(today.getDate() - (29 - idx));
    const dateStr = d.toISOString().split("T")[0];
    
    // Find logs for this day
    const dayLogs = sessionLogs.filter((l) => l.log_date === dateStr);
    let state: "completed" | "partial" | "missed" | "grey" = "grey";

    if (dayLogs.length > 0) {
      const allDone = dayLogs.every((l) => l.completed);
      const someDone = dayLogs.some((l) => l.completed);
      state = allDone ? "completed" : someDone ? "partial" : "missed";
    }

    return { date: dateStr, state };
  });

  // Recharts Chart Data (Mon to Sun session counts)
  const chartData = [
    { name: "Mon", Planned: 2, Completed: 2 },
    { name: "Tue", Planned: 2, Completed: 1 },
    { name: "Wed", Planned: 3, Completed: 2 },
    { name: "Thu", Planned: 2, Completed: 2 },
    { name: "Fri", Planned: 2, Completed: 0 },
    { name: "Sat", Planned: 3, Completed: 3 },
    { name: "Sun", Planned: 1, Completed: 1 },
  ];

  return (
    <div className="space-y-8 max-w-[1000px] w-full animate-fade-in antialiased text-text-primary selection:bg-accent-light selection:text-accent-text">
      
      {/* 1. SIMULATION CONTROLS */}
      <div className="bg-bg-surface border border-dashed border-accent/40 rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-mono text-[9px] font-black text-accent tracking-widest uppercase block mb-1">
            SIMULATION CONTROL PANEL
          </span>
          <p className="text-xs text-text-secondary leading-relaxed font-sans">
            Fast-forward remaining days to trigger Acceleration or Crunch prep rules in real-time.
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "200 Days (Foundation)", val: 200 },
            { label: "120 Days (Acceleration)", val: 120 },
            { label: "45 Days (Crunch)", val: 45 },
            { label: "5 Days (Final Week)", val: 5 }
          ].map((btn) => (
            <button
              key={btn.val}
              onClick={() => setDaysRemaining(btn.val)}
              className="bg-bg-elevated border border-border hover:border-accent hover:bg-accent-light text-[10px] font-mono font-bold tracking-wider py-1.5 px-3 rounded-md text-text-secondary hover:text-accent-text transition-colors cursor-pointer uppercase shadow-sm"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1B. COGNITIVE CARE LAYER AI INTERVENTION BANNER */}
      {student.burnout_risk_score >= 0.6 && (
        <div className="bg-warning-light border border-warning/30 rounded-lg p-6 relative overflow-hidden shadow-warm animate-fade-in">
          <div className="flex gap-4">
            <div className="bg-warning/10 text-warning p-2 rounded-md h-fit">
              <ShieldAlert size={20} className="stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <span className="font-mono text-[9px] font-black text-warning tracking-widest uppercase">
                COGNITIVE CARE LAYERS INTERVENTION ACTIVE
              </span>
              <p className="font-display italic text-text-primary text-sm leading-relaxed">
                {burnoutLoading ? "Synthesizing support telemetry..." : burnoutMessage || "Sustaining focused execution is hard. Take a deliberate breath and look at how far you've come today."}
              </p>
              <div className="flex items-center gap-4 text-[10px] font-mono font-bold text-text-secondary">
                <span className="uppercase">Rolling fatigue: {Math.round(student.burnout_risk_score * 100)}%</span>
                <span>&bull;</span>
                <span className="text-warning uppercase font-black">Intervention: Take standard Decompression Day</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. DYNAMIC HERO METRICS PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Streak card */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 flex flex-col justify-between relative overflow-hidden shadow-warm">
          <div className="absolute -right-6 -bottom-6 opacity-10 select-none pointer-events-none text-accent-light">
            <Flame size={120} className="stroke-[1.5]" />
          </div>
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block font-bold">
            Execution Streak
          </span>
          <div className="flex items-baseline gap-2 mt-4 mb-2">
            <span className="font-display font-semibold text-5xl text-accent leading-none">
              {sessionLogs.filter((l) => l.completed).length > 0 ? 5 : 0}
            </span>
            <span className="text-xs font-mono text-text-secondary uppercase font-bold">days shown</span>
          </div>
          <p className="text-[10px] text-text-secondary font-sans leading-relaxed">
            Non-weaponized focus. Your momentum is preserved cleanly.
          </p>
        </div>

        {/* Target & Countdown */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 flex flex-col justify-between relative overflow-hidden shadow-warm">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block font-bold">
                Target Objective
              </span>
              <h3 className="font-display font-bold text-base text-text-primary tracking-wide mt-1.5 leading-tight uppercase">
                IIM {student.dreamIIM} &bull; {student.target_percentile}%ile
              </h3>
            </div>
            
            <span className="bg-accent-light border border-accent/20 text-accent-text text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-badge tracking-wider">
              {student.prep_phase}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-4 mb-4">
            <span className="font-mono text-4xl font-extrabold text-text-primary leading-none">
              {daysRemaining}
            </span>
            <span className="text-xs font-mono text-text-secondary uppercase font-bold">Days Left</span>
          </div>

          {/* Timeline progress */}
          <div className="space-y-1.5">
            <div className="h-1.5 bg-bg-sunken rounded-badge overflow-hidden">
              <div 
                className="h-full bg-accent"
                style={{ width: `${Math.max(10, Math.min(100, ((300 - daysRemaining) / 300) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] font-mono text-text-secondary uppercase tracking-widest font-bold">
              <span>Foundation</span>
              <span>Crunch</span>
              <span>Final</span>
            </div>
          </div>
        </div>

        {/* Vitality Indicator */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 flex flex-col justify-between relative overflow-hidden shadow-warm">
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block font-bold">
            Execution Vitality
          </span>
          <div className="flex items-baseline gap-2 mt-4 mb-2">
            <span className="font-display font-semibold text-5xl text-accent leading-none">
              {executionHealth}%
            </span>
            <span className="text-xs font-mono text-text-secondary uppercase font-bold">efficiency</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${student.burnout_risk_score >= 0.75 ? "bg-danger animate-ping" : "bg-success"}`} />
              <span className="text-[10px] font-mono text-text-secondary uppercase font-bold">
                {student.burnout_risk_score >= 0.75 ? "Recovery Protocol Active" : "Neuro-fatigue locked: Healthy"}
              </span>
            </div>

            <button
              onClick={manualRecovery}
              className="w-full bg-bg-surface hover:bg-accent-light border border-border text-[10px] font-mono font-bold tracking-wider py-1.5 rounded-md text-text-secondary hover:text-accent-text hover:border-accent/40 transition-colors cursor-pointer uppercase text-center shadow-sm"
            >
              Trigger Decompression Day
            </button>
          </div>
        </div>

      </div>

      {/* 3. HEATMAP & CHART SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Streak Heatmap Widget */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 md:col-span-1 shadow-warm">
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block mb-4 font-bold">
            Consistency Map
          </span>

          <div className="grid grid-cols-6 gap-2">
            {heatmapData.map((cell, idx) => {
              let cellColor = "bg-bg-sunken";
              if (cell.state === "completed") cellColor = "bg-[#0A7CFF]/25 border border-[#0A7CFF]/60 text-white shadow-[0_0_8px_rgba(10,124,255,0.25)]";
              if (cell.state === "partial") cellColor = "bg-[#F59E0B]/20 border border-[#F59E0B]/40";
              if (cell.state === "missed") cellColor = "bg-[#EF4444]/20 border border-[#EF4444]/40";
              
              return (
                <div
                  key={idx}
                  title={`${cell.date}: ${cell.state}`}
                  className={`aspect-square rounded-md ${cellColor} transition-all hover:scale-105`}
                />
              );
            })}
          </div>

          <div className="flex justify-between mt-4 text-[9px] font-mono text-text-secondary uppercase tracking-widest font-bold">
            <span>Missed</span>
            <span>Partial</span>
            <span>Showed Up</span>
          </div>
        </div>

        {/* Weekly execution chart using Recharts */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 md:col-span-2 shadow-warm">
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block mb-4 font-bold">
            Weekly Execution Pacing
          </span>

          <div className="h-[180px] w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="#A39D97" />
                <YAxis stroke="#A39D97" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border)",
                    fontSize: "10px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-primary)",
                  }}
                />
                <Bar dataKey="Planned" fill="var(--bg-sunken)" stroke="var(--border)" strokeWidth={1} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Completed" fill="var(--accent)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 4. WATCHLIST & ADAPTATION LOGS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Weak topics watchlist */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 shadow-warm">
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block mb-4 font-bold">
            Avoidance Watchlist
          </span>

          <div className="space-y-4">
            {topicWeights.slice(0, 5).map((tw) => (
              <div key={tw.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-primary font-sans">{tw.topic}</span>
                  <span className="font-mono text-[10px] text-accent font-bold">
                    {tw.coverage_percent}% coverage
                  </span>
                </div>
                <div className="h-1.5 bg-bg-sunken rounded-badge overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${tw.coverage_percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Adaptation Log Widget */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 shadow-warm">
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block mb-4 font-bold">
            System Adaptation Logs
          </span>

          <div className="space-y-4 max-h-[190px] overflow-y-auto pr-2">
            {adaptationLogs.length > 0 ? (
              adaptationLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-bg-surface border border-border rounded-md space-y-1.5 text-xs font-mono"
                >
                  <div className="flex justify-between text-[9px] text-text-secondary">
                    <span className="text-accent font-bold uppercase">[{log.change_type}]</span>
                    <span>{log.log_date}</span>
                  </div>
                  <p className="text-text-primary font-sans leading-relaxed">{log.reason}</p>
                </div>
              ))
            ) : (
              <div className="text-center font-mono text-xs text-text-secondary py-8 uppercase">
                No adaptation triggers logged. Complete sessions to populate.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
