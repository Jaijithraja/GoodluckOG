"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { Sparkles, Calendar, Settings, CheckCircle2, User, RefreshCw, AlertCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();

  // Zustand selectors
  const student = useStudentStore((state) => state.student);
  const topicWeights = useStudentStore((state) => state.topicWeights);
  const setStudentProfile = useStudentStore((state) => state.setStudentProfile);

  // Component states
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("2026-11-29");
  const [weekdayHours, setWeekdayHours] = useState(3);
  const [weekendHours, setWeekendHours] = useState(6);
  const [peakEnergy, setPeakEnergy] = useState("morning");
  const [studyStyle, setStudyStyle] = useState("structured");
  
  const [pageLoading, setPageLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const checkUserAndOnboarding = async () => {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;

      if (!user) {
        if (student && student.isDemo) {
          setName(student.name);
          setExamDate(student.exam_date);
          setWeekdayHours(student.available_hours_weekday);
          setWeekendHours(student.available_hours_weekend);
          setPeakEnergy(student.peak_energy_window);
          setStudyStyle(student.study_style);
          setPageLoading(false);
          return;
        }
        router.push("/login");
        return;
      }

      const { data: stdData } = await supabase
        .from("students")
        .select()
        .eq("user_id", user.id)
        .maybeSingle();

      if (!stdData) {
        router.push("/onboarding");
        return;
      }

      if (!stdData.onboarding_complete) {
        router.push("/onboarding");
        return;
      }

      if (!student || student.id !== stdData.id) {
        await useStudentStore.getState().loadFromSupabase();
      }

      const currentStudent = useStudentStore.getState().student;
      if (currentStudent) {
        setName(currentStudent.name);
        setExamDate(currentStudent.exam_date);
        setWeekdayHours(currentStudent.available_hours_weekday);
        setWeekendHours(currentStudent.available_hours_weekend);
        setPeakEnergy(currentStudent.peak_energy_window);
        setStudyStyle(currentStudent.study_style);
      }

      setPageLoading(false);
    };

    checkUserAndOnboarding();
  }, [student, router]);

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <RotateCcw className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase tracking-widest">Loading settings...</span>
      </div>
    );
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await setStudentProfile({
      name,
      exam_date: examDate,
      target_percentile: student!.target_percentile,
      available_hours_weekday: weekdayHours,
      available_hours_weekend: weekendHours,
      peak_energy_window: peakEnergy as any,
      study_style: studyStyle as any,
      biggest_fear: student!.biggest_fear || "",
      archetype: student!.archetype || "Balanced",
      onboarding_complete: true,
      dreamIIM: student!.dreamIIM || "A",
    });

    setToastMessage("Settings saved successfully.");
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
          Manage your preferences
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
              Study preferences
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
                    Weekday Hours Available
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
                    Weekend Hours Available
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
                  When is your energy highest?
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
                  Planning style
                </label>
                <select
                  value={studyStyle}
                  onChange={(e) => setStudyStyle(e.target.value as any)}
                  className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent"
                >
                  <option value="structured">Structured (fixed duration study blocks)</option>
                  <option value="flexible">Flexible (fluid blocks and recovery days)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black py-3.5 px-8 rounded-md cursor-pointer transition-all uppercase tracking-wider block shadow-sm hover:shadow"
            >
              Save settings
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
