"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useStudentStore } from "@/store/studentStore";
import GoodluckLogo from "@/components/GoodluckLogo";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const setStudentProfile = useStudentStore((state) => state.setStudentProfile);

  useEffect(() => {
    router.replace("/onboarding");
  }, [router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Attempt live Supabase Auth SignUp
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (authError) {
        // Fallback to local simulation to avoid blocking test-drives without database access
        console.warn("Supabase Auth sign-up error. Executing simulated fallback onboarding route.", authError.message);
        router.push("/onboarding");
        setLoading(false);
        return;
      }

      if (data?.user) {
        // 2. Redirect to onboarding diagnostic flow
        router.push("/onboarding");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setLoading(true);
    setError("");
    try {
      // Use skipBrowserRedirect to detect provider-not-enabled errors before redirecting the window
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
          skipBrowserRedirect: true,
        },
      });

      if (authError || !data?.url) {
        const errorMsg = authError?.message || "Provider URL not generated.";
        console.warn(`Supabase OAuth (${provider}) error: ${errorMsg}. Initiating simulated fallback signup.`);
        setStudentProfile({
          name: `${provider === 'google' ? 'Google' : 'GitHub'} Student`,
          exam_date: "2026-11-29",
          target_percentile: 99,
          available_hours_weekday: 3,
          available_hours_weekend: 6,
          peak_energy_window: "morning",
          study_style: "structured",
          biggest_fear: "quant",
          archetype: "Balanced",
          onboarding_complete: false,
          dreamIIM: "A",
        });
        router.push("/onboarding");
        setLoading(false);
        return;
      }

      // If provider is fully supported/enabled, proceed with redirection
      window.location.assign(data.url);
    } catch (err: any) {
      console.warn(`OAuth exception caught: ${err?.message}. Directing to simulated onboarding.`);
      setStudentProfile({
        name: `${provider === 'google' ? 'Google' : 'GitHub'} Student`,
        exam_date: "2026-11-29",
        target_percentile: 99,
        available_hours_weekday: 3,
        available_hours_weekend: 6,
        peak_energy_window: "morning",
        study_style: "structured",
        biggest_fear: "quant",
        archetype: "Balanced",
        onboarding_complete: false,
        dreamIIM: "A",
      });
      router.push("/onboarding");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-base flex flex-col justify-center items-center px-6 py-12 select-none antialiased text-text-primary relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      
      {/* Breathing Radial Glow */}
      <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-accent-light/15 via-transparent to-transparent opacity-50 animate-breathe" />

      {/* Floating telemetry pills */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block">
        <div className="absolute top-[25%] left-[15%] bg-bg-elevated border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm animate-float-a">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-dot-pulse" />
          <span className="font-mono text-[8px] font-bold text-text-secondary uppercase tracking-wider">
            Goodluck OS Active Calibration
          </span>
        </div>
        <div className="absolute bottom-[25%] right-[15%] bg-bg-elevated border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm animate-float-b">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-dot-pulse" />
          <span className="font-mono text-[8px] font-bold text-text-secondary uppercase tracking-wider">
            Streaks Synchronized
          </span>
        </div>
      </div>

      <div className="w-full max-w-[420px] bg-bg-elevated border border-border rounded-lg p-8 shadow-warm relative overflow-hidden z-10">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-accent" />

        <div className="flex flex-col items-center mb-6">
          <GoodluckLogo size={36} showTagline={false} className="mb-2" />
          <p className="text-[10px] text-text-secondary text-center font-mono uppercase tracking-widest font-black">
            STAY CONSISTENT, CRACK CAT
          </p>
        </div>

        {/* Error panel */}
        {error && (
          <div className="mb-6 p-3 bg-danger-light border border-danger/20 text-danger text-[10px] rounded-md font-mono uppercase tracking-wide">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
              Your Name
            </label>
            <input
              type="text"
              placeholder="e.g. Jaijith Raja"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent font-sans transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent font-sans transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5 font-bold">
              Create Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-surface border border-border text-text-primary text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-accent font-sans transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-[#0A0A0A] text-xs font-mono font-black uppercase tracking-widest py-3 px-4 rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm hover:shadow"
          >
            <span>{loading ? "CREATING PROFILE..." : "BEGIN PREPARATION"}</span>
            <ArrowRight size={14} className="stroke-[2.5]" />
          </button>
        </form>

        {/* OAuth Separator */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative px-3 bg-bg-elevated text-[9px] font-mono uppercase tracking-widest text-text-secondary font-bold">
            OR CONTINUE WITH
          </span>
        </div>

        {/* OAuth Buttons Grid */}
        <div className="mb-6">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthSignIn("google")}
            className="w-full bg-bg-surface hover:bg-bg-surface/85 disabled:opacity-50 border border-border hover:border-accent text-text-primary text-[10px] font-mono font-bold uppercase tracking-wider py-2.5 px-4 rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm hover:shadow active:scale-[0.98]"
          >
            <GoogleIcon className="w-3.5 h-3.5" />
            Continue with Google
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-text-secondary">
            Already have a profile?{" "}
            <Link
              href="/login"
              className="text-accent hover:underline font-bold transition-all uppercase text-[10px] font-mono tracking-wider ml-1"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// Inline custom premium SVG icons
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);
