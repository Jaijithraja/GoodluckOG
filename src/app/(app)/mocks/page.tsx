"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { MockSource, MockDebrief } from "@/types";
import { Sparkles, Calendar, PlusCircle, Award, CheckCircle2, ChevronRight, BarChart2, AlertCircle, X, RotateCcw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase/client";

export default function MocksPage() {
  const router = useRouter();

  // Zustand store selectors
  const student = useStudentStore((state) => state.student);
  const mockResults = useStudentStore((state) => state.mockResults);
  const logMockResult = useStudentStore((state) => state.logMockResult);

  // Component states
  const [showLogModal, setShowLogModal] = useState(false);
  const [activeDebriefIdx, setActiveDebriefIdx] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    source: "SimCAT" as MockSource,
    overall_percentile: 95.0,
    varc_percentile: 92.5,
    dilr_percentile: 90.0,
    quant_percentile: 89.5,
    varc_score: 28,
    dilr_score: 24,
    quant_score: 18,
  });

  useEffect(() => {
    const checkUserAndOnboarding = async () => {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;

      if (!user) {
        if (student) {
          setPageLoading(false);
          return;
        }
        router.push("/onboarding");
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

  const handleMockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.overall_percentile < 50 || form.overall_percentile > 100) {
      setError("Please input a realistic overall percentile score.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await logMockResult({
        mock_date: new Date().toISOString().split("T")[0],
        source: form.source,
        overall_percentile: form.overall_percentile,
        varc_score: form.varc_score,
        varc_percentile: form.varc_percentile,
        dilr_score: form.dilr_score,
        dilr_percentile: form.dilr_percentile,
        quant_score: form.quant_score,
        quant_percentile: form.quant_percentile,
        varc_time_minutes: 40,
        dilr_time_minutes: 40,
        quant_time_minutes: 40,
        total_attempts: 75,
        total_accuracy: 0.78,
      });

      setShowLogModal(false);
      setActiveDebriefIdx(0); // Automatically expand the newly logged mock
    } catch (err) {
      console.error(err);
      setError("Unable to analyze mock scores. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Format Recharts data (reverse results order so it draws progress sequentially)
  const chartData = [...mockResults].reverse().map((mock) => ({
    name: mock.source.slice(0, 7),
    Overall: mock.overall_percentile,
    VARC: mock.varc_percentile,
    DILR: mock.dilr_percentile,
    Quant: mock.quant_percentile,
  }));

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 antialiased bg-bg-base text-text-primary">
        <RotateCcw className="animate-spin text-accent" size={24} />
        <span className="font-mono text-xs text-text-secondary uppercase tracking-widest">
          Loading mock analytics...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1000px] w-full animate-fade-in antialiased text-text-primary selection:bg-accent-light selection:text-accent-text">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-text-secondary uppercase block mb-2 font-bold">
            Mock Analysis & Coaching
          </span>
          <h1 className="font-display font-medium text-3xl tracking-wide text-text-primary">
            Mock Analytics
          </h1>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black py-2.5 px-6 rounded-md flex items-center gap-1.5 transition-all cursor-pointer uppercase tracking-widest shadow-sm hover:shadow"
        >
          <PlusCircle size={14} className="stroke-[2.5]" />
          <span>LOG MOCK EXAM</span>
        </button>
      </div>

      {/* 1. MOCK SCORE VISUAL PROGRESS */}
      {mockResults.length > 0 ? (
        <div className="bg-bg-elevated border border-border rounded-lg p-6 shadow-warm w-full overflow-hidden">
          <span className="font-mono text-[10px] text-text-secondary tracking-wider uppercase block mb-4 font-bold">
            Percentile Progress Trend
          </span>

          <div className="h-[240px] w-full overflow-hidden font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                 <XAxis dataKey="name" stroke="#A39D97" />
                 <YAxis domain={[50, 100]} stroke="#A39D97" />
                 <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                 <Legend />
                 <Line type="monotone" dataKey="Overall" stroke="var(--accent)" strokeWidth={2.5} activeDot={{ r: 6 }} />
                 <Line type="monotone" dataKey="VARC" stroke="var(--varc)" strokeDasharray="5 5" />
                 <Line type="monotone" dataKey="DILR" stroke="var(--dilr)" strokeDasharray="5 5" />
                 <Line type="monotone" dataKey="Quant" stroke="var(--quant)" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-bg-elevated border border-dashed border-border rounded-lg font-mono text-xs text-text-secondary uppercase space-y-4 shadow-sm">
          <BarChart2 size={36} className="mx-auto text-text-secondary/40 animate-pulse" />
          <p>No mocks logged yet.</p>
          <button
            onClick={() => setShowLogModal(true)}
            className="border border-accent/40 hover:bg-accent-light text-accent-text font-black py-2.5 px-5 rounded-md tracking-widest uppercase text-[10px] mx-auto block cursor-pointer transition-all"
          >
            Log your first mock →
          </button>
        </div>
      )}

      {/* 2. MOCK HISTORY ARCHIVE & AI DEBRIEF TIMELINE */}
      {mockResults.length > 0 && (
        <div className="space-y-6">
          <h2 className="font-display font-bold text-lg text-text-primary tracking-wide">
            Mock Debrief Timeline
          </h2>

          <div className="space-y-4">
            {mockResults.map((mock, idx) => {
              const debrief = (mock.debrief as MockDebrief) || { wins: [], fixes: [], planAdjust: "" };
              const isExpanded = activeDebriefIdx === idx;

              return (
                <div
                  key={mock.id}
                  className="bg-bg-elevated border border-border rounded-lg p-6 shadow-warm transition-calm"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <h4 className="font-display font-bold text-base text-text-primary">
                          {mock.source}
                        </h4>
                        <span className="bg-bg-surface text-text-secondary text-[9px] font-mono px-2 py-0.5 border border-border rounded-badge">
                          {mock.mock_date}
                        </span>
                      </div>
                      <div className="flex gap-4 font-mono text-[9px] text-text-secondary uppercase font-bold">
                        <span>VARC: {mock.varc_percentile}%ile</span>
                        <span>DILR: {mock.dilr_percentile}%ile</span>
                        <span>Quant: {mock.quant_percentile}%ile</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xl font-extrabold text-accent">
                        {mock.overall_percentile.toFixed(1)}%ile
                      </span>

                      <button
                        onClick={() => setActiveDebriefIdx(isExpanded ? null : idx)}
                        className="text-[10px] font-mono font-black tracking-widest text-text-secondary hover:text-accent flex items-center gap-1 transition-colors cursor-pointer uppercase"
                      >
                        <span>{isExpanded ? "COLLAPSE" : "DEBRIEF"}</span>
                        <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Debrief Content Panel */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-border space-y-6 animate-fade-in">
                      
                      {debrief.headline && (
                        <p className="text-xs font-mono font-bold text-text-primary uppercase bg-bg-surface/50 border border-border rounded-md p-3">
                          {debrief.headline}
                        </p>
                      )}

                      {/* Wins */}
                      {debrief.two_things_that_worked && debrief.two_things_that_worked.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-mono uppercase tracking-wider text-success font-black flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> Execution Wins
                          </h5>
                          <ul className="list-disc list-inside text-xs text-text-secondary pl-2 space-y-1.5 font-sans leading-relaxed">
                            {debrief.two_things_that_worked.map((w, wIdx) => (
                              <li key={wIdx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Fixes */}
                      {debrief.three_things_to_fix && debrief.three_things_to_fix.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-mono uppercase tracking-wider text-danger font-black flex items-center gap-1.5">
                            <AlertCircle size={12} /> Priority Fixes
                          </h5>
                          <div className="pl-2 space-y-2.5">
                            {debrief.three_things_to_fix.map((f, fIdx) => (
                              <div key={fIdx} className="text-xs leading-relaxed font-sans">
                                <span className="font-bold text-text-primary block">{f.issue}</span>
                                <span className="text-text-secondary block mt-0.5">{f.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Plan adjusts */}
                      {debrief.plan_adjustment && (
                        <div className="bg-bg-surface border border-border rounded-md p-4 text-xs font-sans">
                          <span className="font-mono text-[9px] text-accent uppercase tracking-wider font-black block mb-1">
                            Plan Adjustment Applied
                          </span>
                          <p className="text-text-secondary leading-relaxed">{debrief.plan_adjustment}</p>
                        </div>
                      )}

                      {/* Choke Risk */}
                      {debrief.choke_risk && debrief.choke_note && (
                        <div className="bg-warning-light border border-warning/20 rounded-md p-4 text-xs font-sans">
                          <span className="font-mono text-[9px] text-warning uppercase tracking-wider font-black block mb-1">
                            Performance Watchpoint
                          </span>
                          <p className="text-warning leading-relaxed">{debrief.choke_note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL LOG MOCK DIALOG
          ==================================================================== */}
      {showLogModal && (
        <div className="fixed inset-0 bg-text-primary/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] bg-bg-elevated border border-accent/20 rounded-lg p-5 sm:p-8 shadow-warmLg relative animate-fade-in max-h-[95vh] overflow-y-auto overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-accent" />

            {/* Submitting Loading Overlay */}
            {submitting && (
              <div className="absolute inset-0 bg-bg-elevated/95 z-50 flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in">
                <RotateCcw className="animate-spin text-accent" size={32} />
                <div>
                  <h4 className="font-display font-bold text-base text-text-primary uppercase tracking-wider">
                    Analyzing Your Mock
                  </h4>
                  <p className="text-xs text-text-secondary mt-1 max-w-[280px] mx-auto font-sans leading-relaxed">
                    Our AI is evaluating your sectional percentiles to balance and recalibrate your study plan.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2.5">
                <Award size={20} className="text-accent" />
                <h3 className="font-display font-bold text-lg text-text-primary uppercase tracking-wider">
                  LOG YOUR MOCK RESULT
                </h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-danger-light border border-danger/20 text-danger text-xs rounded-md font-mono">
                {error.toUpperCase()}
              </div>
            )}

            <form onSubmit={handleMockSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                    Mock Source
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value as MockSource })}
                    className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent"
                  >
                    <option value="SimCAT">SimCAT (IMS)</option>
                    <option value="AIMCAT">AIMCAT (TIME)</option>
                    <option value="CL">CL Mock (Career Launcher)</option>
                    <option value="TIME">TIME Mock</option>
                    <option value="IMS">IMS Mock</option>
                    <option value="Other">Other Mock Paper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-2 font-bold">
                    Overall Percentile
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="50"
                    max="100"
                    value={form.overall_percentile}
                    onChange={(e) =>
                      setForm({ ...form, overall_percentile: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2 px-3 focus:outline-none focus:border-accent font-mono text-center"
                  />
                </div>
              </div>

              <div className="h-[1px] bg-border my-4" />
              <h5 className="text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-3 font-bold">
                Sectional Percentiles
              </h5>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                    VARC Percentile
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.varc_percentile}
                    onChange={(e) =>
                      setForm({ ...form, varc_percentile: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-bg-surface border border-border text-text-primary text-xs rounded-md py-2 px-2 focus:outline-none focus:border-accent font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                    DILR Percentile
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.dilr_percentile}
                    onChange={(e) =>
                      setForm({ ...form, dilr_percentile: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-bg-surface border border-border text-text-primary text-xs rounded-md py-2 px-2 focus:outline-none focus:border-accent font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
                    Quant Percentile
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.quant_percentile}
                    onChange={(e) =>
                      setForm({ ...form, quant_percentile: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-bg-surface border border-border text-text-primary text-xs rounded-md py-2 px-2 focus:outline-none focus:border-accent font-mono text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90 text-[#0A0A0A] text-xs font-mono font-black py-3.5 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-widest mt-6 shadow-sm hover:shadow"
              >
                <span>Save mock and analyze</span>
                <CheckCircle2 size={14} className="stroke-[2.5]" />
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
