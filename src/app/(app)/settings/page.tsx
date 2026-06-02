"use client";

import { useState } from "react";
import { useStudentStore } from "@/store/studentStore";
import { Sparkles, Calendar, Settings, CheckCircle2, User, RefreshCw, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  // Zustand selectors
  const student = useStudentStore((state) => state.student);
  const topicWeights = useStudentStore((state) => state.topicWeights);
  const setStudentProfile = useStudentStore((state) => state.setStudentProfile);

  // Component states
  const [name, setName] = useState(student?.name || "");
  const [examDate, setExamDate] = useState(student?.exam_date || "2026-11-29");
  const [weekdayHours, setWeekdayHours] = useState(student?.available_hours_weekday || 3);
  const [weekendHours, setWeekendHours] = useState(student?.available_hours_weekend || 6);
  const [peakEnergy, setPeakEnergy] = useState(student?.peak_energy_window || "morning");
  const [studyStyle, setStudyStyle] = useState(student?.study_style || "structured");
  
  const [toastMessage, setToastMessage] = useState("");

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <RefreshCw className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase">Loading configuration panels...</span>
      </div>
    );
  }

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentProfile({
      name,
      exam_date: examDate,
      target_percentile: student.target_percentile,
      available_hours_weekday: weekdayHours,
      available_hours_weekend: weekendHours,
      peak_energy_window: peakEnergy as any,
      study_style: studyStyle as any,
      biggest_fear: student.biggest_fear || "",
      archetype: student.archetype || "Balanced",
      onboarding_complete: true,
      dreamIIM: student.dreamIIM || "A",
    });

    setToastMessage("Settings updated. Planning schedules adapted.");
    setTimeout(() => setToastMessage(""), 4000);
  };

  return (
    <div className="space-y-8 max-w-[800px] w-full animate-fade-in antialiased text-text-primary selection:bg-accent-light selection:text-accent-text">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-bg-elevated border border-success/30 text-success text-xs font-mono py-3.5 px-6 rounded-md shadow-warmLg flex items-center gap-3 animate-slide-in">
          <CheckCircle2 size={16} className="text-success" />
          <span>{toastMessage.toUpperCase()}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border pb-6">
        <span className="text-[10px] font-mono tracking-widest text-text-secondary uppercase block mb-2 font-bold">
          SYSTEM PARAMETERS & CALIBRATIONS
        </span>
        <h1 className="font-display font-medium text-3xl tracking-wide text-text-primary">
          Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Profile Card Form */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 md:p-8 shadow-warm space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Settings className="text-accent stroke-[2]" size={20} />
            <h3 className="font-display font-bold text-base text-text-primary uppercase tracking-wide">
              Profile Parameters
            </h3>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                  Exam Target Date
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent font-mono transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold">
                    Weekday Hours
                  </label>
                  <span className="font-mono text-xs font-black text-accent">{weekdayHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={weekdayHours}
                  onChange={(e) => setWeekdayHours(parseFloat(e.target.value))}
                  className="w-full accent-accent bg-bg-sunken h-1.5 rounded-md"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-bold">
                    Weekend Hours
                  </label>
                  <span className="font-mono text-xs font-black text-accent">{weekendHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="0.5"
                  value={weekendHours}
                  onChange={(e) => setWeekendHours(parseFloat(e.target.value))}
                  className="w-full accent-accent bg-bg-sunken h-1.5 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                  Peak Cognitive Energy Window
                </label>
                <select
                  value={peakEnergy}
                  onChange={(e) => setPeakEnergy(e.target.value as any)}
                  className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent"
                >
                  <option value="morning">Morning (5am - 12pm)</option>
                  <option value="afternoon">Afternoon (12pm - 6pm)</option>
                  <option value="night">Night (6pm - 12am)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                  Micro-deadlines Strictness
                </label>
                <select
                  value={studyStyle}
                  onChange={(e) => setStudyStyle(e.target.value as any)}
                  className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent"
                >
                  <option value="structured">Structured (micro-milestones)</option>
                  <option value="flexible">Adaptive Fluid (fluid recovery)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black py-3.5 px-8 rounded-md cursor-pointer transition-all uppercase tracking-wider block shadow-sm hover:shadow"
            >
              Save Profile Adjustments
            </button>
          </form>
        </div>

        {/* Diagnostic assessment list view */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 md:p-8 shadow-warm space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <AlertCircle className="text-accent stroke-[2]" size={20} />
            <h3 className="font-display font-bold text-base text-text-primary uppercase tracking-wide">
              Your Topic Priority List
            </h3>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed font-sans">
            Topics with higher priority scores will get more study slots in your daily schedule automatically.
          </p>

          <div className="space-y-3 pt-2">
            {topicWeights.map((tw) => (
              <div
                key={tw.id}
                className="flex items-center justify-between p-3 bg-bg-surface border border-border/80 rounded-md text-xs font-sans"
              >
                <div>
                  <span className="font-semibold text-text-primary">{tw.topic}</span>
                  <span className="text-[9px] font-mono text-text-secondary uppercase block mt-0.5 font-bold">
                    Section: {tw.section}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-text-secondary font-bold uppercase">
                    Priority Score:
                  </span>
                  <span className="font-mono text-xs font-black text-accent">
                    {tw.weight.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Aesthetic Spacer */}
      <div className="h-6" />

    </div>
  );
}
