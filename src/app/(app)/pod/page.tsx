"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { supabase } from "@/lib/supabase/client";
import { Sparkles, UserCheck, ShieldAlert, Award, Send, Users, CheckCircle2, User, X, RotateCcw } from "lucide-react";

export default function PodPage() {
  const router = useRouter();

  // Zustand selectors
  const student = useStudentStore((state) => state.student);
  const podMembers = useStudentStore((state) => state.podMembers);
  const podJoined = useStudentStore((state) => state.podJoined);
  const podCheckin = useStudentStore((state) => state.podCheckin);
  const optInPod = useStudentStore((state) => state.optInPod);
  const submitPodCheckin = useStudentStore((state) => state.submitPodCheckin);

  const [pageLoading, setPageLoading] = useState(true);
  const [win, setWin] = useState("");
  const [struggle, setStruggle] = useState("");
  const [error, setError] = useState("");

  // Live Supabase Realtime subscription
  useEffect(() => {
    if (!student) return;

    // Listen to changes in the pod_execution_log table to refresh peer status live
    const channel = supabase
      .channel("pod-live-activity")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pod_execution_log",
        },
        (payload) => {
          console.log("Live peer check-in received!", payload);
          // Auto-reload data from Supabase to update the UI
          useStudentStore.getState().loadFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [student]);

  useEffect(() => {
    const checkUserAndOnboarding = async () => {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;

      if (!user) {
        if (student && student.isDemo) {
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

      setPageLoading(false);
    };

    checkUserAndOnboarding();
  }, [student, router]);

  const handleCheckinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!win || !struggle) {
      setError("Please describe both your weekly win and your struggle.");
      return;
    }
    submitPodCheckin(win, struggle);
    setError("");
  };

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <RotateCcw className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase tracking-widest">Loading your pod...</span>
      </div>
    );
  }

  // If student hasn't joined a pod, render opt-in onboarding card
  if (!podJoined) {
    return (
      <div className="max-w-[600px] mx-auto space-y-8 animate-fade-in py-10 antialiased text-text-primary">
        <div className="bg-bg-elevated border border-border rounded-lg p-8 md:p-12 text-center space-y-6 shadow-warm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-accent" />

          <div className="flex justify-center">
            <div className="bg-accent-light border border-accent/25 p-4 rounded-full text-accent shadow-sm">
              <Users size={48} className="stroke-[1.5]" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-display font-medium text-2xl text-text-primary tracking-wide">
              Join Accountability Pod
            </h2>
            <p className="font-mono text-[9px] text-accent tracking-widest uppercase font-bold">
              Silent peer matches (3-5 members)
            </p>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed font-sans max-w-[450px] mx-auto font-sans">
            Pods are completely silent. No chat distractions. No toxic ranks. 
            You only see each other&apos;s showing up status—whether you completed planned sessions today or missed them. Silent peer pressure that keeps you consistent.
          </p>

          <button
            onClick={() => optInPod(true)}
            className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black tracking-widest py-3.5 px-8 rounded-md cursor-pointer transition-all uppercase shadow-sm hover:shadow"
          >
            Match with Peers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[800px] w-full animate-fade-in antialiased text-text-primary selection:bg-accent-light selection:text-accent-text">
      
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <span className="text-[10px] font-mono tracking-widest text-text-secondary uppercase block mb-2 font-bold">
          Silent Peer Accountability
        </span>
        <h1 className="font-display font-medium text-3xl tracking-tight text-text-primary">
          Accountability Pod
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: 7-day Execution grid */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 md:col-span-2 shadow-warm space-y-6">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-lg text-text-primary">
              Daily Sync Board
            </h3>
            <p className="text-xs text-text-secondary font-sans leading-relaxed">
              Delta-99 Pod: Last 7 days showing up status.
            </p>
          </div>

          <div className="space-y-4">
            {podMembers.map((member) => (
              <div
                key={member.id}
                className="p-4 bg-bg-surface border border-border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-calm hover:border-border-strong"
              >
                <div>
                  <h4 className="text-xs font-mono text-text-primary font-bold flex items-center gap-1.5 uppercase">
                    <User size={12} className="text-accent" />
                    {member.name}
                  </h4>
                  <span className="text-[10px] text-text-secondary font-mono uppercase mt-1 block font-semibold">
                    Target: {member.target_percentile} &bull; Streak: {member.streak_days}d
                  </span>
                </div>

                {/* 7 cells grid */}
                <div className="flex gap-1.5">
                  {member.last_7_days.map((status, idx) => {
                    let cellColor = "bg-bg-sunken border border-border/40";
                    if (status === "completed") cellColor = "bg-success-light border border-success/35 text-success";
                    if (status === "partial") cellColor = "bg-warning-light border border-warning/30 text-warning";
                    if (status === "missed") cellColor = "bg-danger-light border border-danger/30 text-danger";

                    return (
                      <div
                        key={idx}
                        title={`Day ${idx + 1}: ${status}`}
                        className={`w-6 h-6 rounded-md ${cellColor}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Weekly check-in prompt */}
        <div className="bg-bg-elevated border border-border rounded-lg p-6 shadow-warm space-y-6">
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block font-bold">
            Pod Weekly Check-In
          </span>

          <p className="text-xs text-text-secondary leading-relaxed font-sans">
            Every Sunday, share your win and biggest execution struggle. Silent check-ins build real shared accountability.
          </p>

          {podCheckin?.submitted ? (
            <div className="p-4 bg-success-light border border-success/25 rounded-md text-center space-y-3 shadow-inner">
              <CheckCircle2 size={32} className="text-success mx-auto stroke-[2]" />
              <h4 className="font-display font-bold text-sm text-text-primary uppercase">
                STATUS SUBMITTED
              </h4>
              <p className="text-[10px] text-text-secondary leading-relaxed font-sans">
                Delta-99 sync complete. Keep showing up.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCheckinSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-danger-light border border-danger/20 text-danger text-[10px] rounded-md font-mono font-bold">
                  {error.toUpperCase()}
                </div>
              )}

              <div>
                <label className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                  Weekly Core Win
                </label>
                <textarea
                  placeholder="e.g. Smashed 4 timed RC verbal sets cleanly this week..."
                  value={win}
                  onChange={(e) => setWin(e.target.value)}
                  className="w-full bg-bg-surface border border-border text-text-primary text-xs rounded-md py-2 px-3 focus:outline-none focus:border-accent font-sans h-20 resize-none transition-colors focus:bg-bg-elevated"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                  Execution Struggle
                </label>
                <textarea
                  placeholder="e.g. Geometry formula recall remains high load..."
                  value={struggle}
                  onChange={(e) => setStruggle(e.target.value)}
                  className="w-full bg-bg-surface border border-border text-text-primary text-xs rounded-md py-2.5 px-3 focus:outline-none focus:border-accent font-sans h-20 resize-none transition-colors focus:bg-bg-elevated"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90 text-[#0A0A0A] text-[10px] font-mono font-black py-3 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-widest mt-4 shadow-sm hover:shadow"
              >
                <span>Submit check-in</span>
                <Send size={12} className="stroke-[2.5]" />
              </button>
            </form>
          )}
        </div>

      </div>

      {/* Aesthetic Spacer */}
      <div className="h-6" />

    </div>
  );
}
