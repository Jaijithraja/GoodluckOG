"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { ArrowRight, ShieldCheck, Zap, Heart, Flame, ShieldAlert, Check, Play, Square, RotateCcw, ChevronDown, AlertCircle, Sun, Moon } from "lucide-react";
import Link from "next/link";
import GoodluckLogo from "@/components/GoodluckLogo";
import { LandingWrapper } from "@/components/LandingWrapper";
import { LogoButton } from "@/components/LogoButton";

// Quiz questions structure - strictly calibrated to serious adult CAT aspirants (22-26 age group)
const QUESTIONS = [
  {
    q: "How many full-length mock tests have you analyzed this month?",
    options: [
      { text: "3 or more mocks with detailed mistake tracking and revision", score: 20 },
      { text: "1-2 mocks, but I only look at the score and close the report", score: 15 },
      { text: "I take shorter practice tests but avoid full mocks due to score anxiety", score: 10 },
      { text: "Zero mocks. I am waiting to finish 100% of the syllabus first", score: 5 }
    ]
  },
  {
    q: "What happens when you hit a series of difficult DILR sets or advanced Math chapters?",
    options: [
      { text: "I write down the question type, adjust my daily routine, and solve them when my focus is highest", score: 20 },
      { text: "I switch to comfortable sections like Verbal and just read articles", score: 10 },
      { text: "I try to solve them, get stuck, feel anxious, and stop studying", score: 5 },
      { text: "I bookmark videos and save PDFs, but rarely solve them under real exam conditions", score: 15 }
    ]
  },
  {
    q: "How consistent is your weekly study schedule under college or work pressure?",
    options: [
      { text: "Fixed daily study hours with clear tracking of what I cover", score: 20 },
      { text: "Highly fragmented; I study late at night when I'm already exhausted", score: 15 },
      { text: "Binge studying on weekends (8+ hours) and almost zero study during the week", score: 10 },
      { text: "Completely irregular; I only study when I feel guilty about not preparing", score: 5 }
    ]
  },
  {
    q: "With CAT exam day getting closer, how structured is your current preparation strategy?",
    options: [
      { text: "Clear plan: wrapping up basic concepts to pivot to timed practice and mock tests", score: 20 },
      { text: "Using the exact same study routine with no timeline-based adjustments", score: 10 },
      { text: "Panic mode: trying to study everything at once without focusing on weak areas", score: 5 },
      { text: "Passive reading; I feel the deadline but don't have a structured daily action plan", score: 15 }
    ]
  },
  {
    q: "What is your main challenge when transitioning from regular practice to actual mock tests?",
    options: [
      { text: "My accuracy under mock test time pressure matches my regular practice sessions", score: 20 },
      { text: "High accuracy during regular practice, but absolute panic under timed mock limits", score: 5 },
      { text: "Extreme score imbalance (e.g., high Verbal percentile, but very low DILR or Math score)", score: 10 },
      { text: "I don't track my practice accuracy vs mock test percentile gap", score: 15 }
    ]
  }
];

export default function Home() {
  const router = useRouter();
  const student = useStudentStore((state) => state.student);
  const loadFromLocalStorage = useStudentStore((state) => state.loadFromLocalStorage);

  const [mounted, setMounted] = useState(false);

  // 1. Fullscreen Loader States
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [loaderComplete, setLoaderComplete] = useState(true);

  // 2. Interactive Quiz States
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // 3. Working Pomodoro Timer States
  const [pomoTime, setPomoTime] = useState(1500); // 25:00
  const [pomoActive, setPomoActive] = useState(false);
  const pomoRef = useRef<NodeJS.Timeout | null>(null);

  // 4. Live Week Plan Generator States
  const [userGoal, setUserGoal] = useState("99th Percentile Target");
  const [userHours, setUserHours] = useState("5 hours");
  const [userWeakest, setUserWeakest] = useState("Quant");
  const [weekPlan, setWeekPlan] = useState<any[]>([]);
  const [planGenerated, setPlanGenerated] = useState(false);

  // 5. FAQ Accordion States
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);

  // Focus Timer rotation loader logic
  const [focusCircleOffset, setFocusCircleOffset] = useState(0);

  // Theme toggle states
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("goodluck-theme", nextTheme);
    setTheme(nextTheme);
  };

  // Helper to generate dynamic week schedule based on inputs
  const generateWeekPlanData = useCallback((goal: string, hours: string, weakest: string) => {
    const hrVal = parseInt(hours) || 5;
    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    
    return days.map(day => {
      if (day === "SAT" || day === "SUN") {
        return {
          day,
          pills: [
            { subject: "Mock Test", time: "3h", bg: "bg-[#F59E0B]/10 text-[#FBBF24] border border-[#F59E0B]/30" },
            { subject: "Mock Analysis", time: "1h", bg: "bg-[#0A7CFF]/10 text-[#38BDF8] border border-[#0A7CFF]/30" }
          ]
        };
      }

      const dailyPills = [];
      
      // Core weak subject block
      dailyPills.push({
        subject: `${weakest} Practice`,
        time: `${Math.round(hrVal * 0.4)}h`,
        bg: weakest === "Quant" 
          ? "bg-[#10B981]/10 text-[#34D399] border border-[#10B981]/30" 
          : weakest === "DILR"
          ? "bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/30"
          : "bg-[#3B82F6]/10 text-[#93C5FD] border border-[#3B82F6]/30"
      });

      // Other sections block
      const others = ["Quant", "DILR", "VARC"].filter(s => s !== weakest);
      dailyPills.push({
        subject: `${others[0]} Practice`,
        time: `${Math.round(hrVal * 0.3) || 1}h`,
        bg: others[0] === "Quant" 
          ? "bg-[#10B981]/5 text-[#A7F3D0] border border-[#10B981]/20" 
          : others[0] === "DILR"
          ? "bg-[#8B5CF6]/5 text-[#D8B4FE] border border-[#8B5CF6]/20"
          : "bg-[#3B82F6]/5 text-[#BFDBFE] border border-[#3B82F6]/20"
      });

      // Revision block
      dailyPills.push({
        subject: "Revision",
        time: `${Math.round(hrVal * 0.2) || 1}h`,
        bg: "bg-gray-800 text-gray-400 border border-gray-700"
      });

      return { day, pills: dailyPills };
    });
  }, []);

  // Mount logic
  useEffect(() => {
    setMounted(true);
    loadFromLocalStorage();

    // Fetch theme
    const activeTheme = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(activeTheme as any);

    // Skip loader immediately for instant paint
    setLoaderProgress(100);
    setLoaderComplete(true);
  }, [loadFromLocalStorage, generateWeekPlanData]);

  // Pomodoro Timer tick logic
  useEffect(() => {
    if (pomoActive) {
      pomoRef.current = setInterval(() => {
        setPomoTime((prev) => {
          if (prev <= 1) {
            setPomoActive(false);
            if (pomoRef.current) clearInterval(pomoRef.current);
            return 1500;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (pomoRef.current) clearInterval(pomoRef.current);
    }

    return () => {
      if (pomoRef.current) clearInterval(pomoRef.current);
    };
  }, [pomoActive]);

  // Circular progress rotation logic for visual Focus Clock
  useEffect(() => {
    let tickInterval: NodeJS.Timeout;
    if (pomoActive) {
      tickInterval = setInterval(() => {
        setFocusCircleOffset((prev) => (prev + 2) % 360);
      }, 100);
    }
    return () => clearInterval(tickInterval);
  }, [pomoActive]);

  // Handle live week generation button
  const handleGenerateClick = () => {
    setWeekPlan(generateWeekPlanData(userGoal, userHours, userWeakest));
    setPlanGenerated(true);
  };

  // Handle quiz option select
  const handleOptionSelect = useCallback((index: number) => {
    const selectedScore = QUESTIONS[currentQ].options[index].score;
    setQuizAnswers((prevAnswers) => {
      const updatedAnswers = [...prevAnswers, selectedScore];
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ((q) => q + 1);
      } else {
        const totalScore = updatedAnswers.reduce((sum, s) => sum + s, 0);
        setQuizScore(totalScore);
        setQuizComplete(true);
      }
      return updatedAnswers;
    });
  }, [currentQ]);

  // Keyboard navigation for the Quiz (A/B/C/D)
  useEffect(() => {
    if (!quizStarted || quizComplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const char = e.key.toUpperCase();
      const options = ["A", "B", "C", "D"];
      const index = options.indexOf(char);
      if (index !== -1 && index < QUESTIONS[currentQ].options.length) {
        handleOptionSelect(index);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quizStarted, quizComplete, currentQ, handleOptionSelect]);

  const resetQuiz = () => {
    setCurrentQ(0);
    setQuizAnswers([]);
    setQuizComplete(false);
    setQuizScore(0);
  };

  // Format Pomodoro Time
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Skip loader utility
  const skipLoader = () => {
    setLoaderProgress(100);
    setLoaderComplete(true);
  };

  return (
    <LandingWrapper>
      <div className="min-h-screen bg-bg-base text-text-primary select-none antialiased overflow-x-hidden font-sans selection:bg-accent/10 selection:text-accent">
      
      {/* ─────────────────────────────────────────────
         1. FULLSCREEN PROGRESS LOADER
         ───────────────────────────────────────────── */}
      {!loaderComplete && (
        <div className="fixed inset-0 bg-[#0A0A0A] z-[9999] flex flex-col justify-center items-center px-8 transition-opacity duration-500 ease-out">
          <div className="max-w-[400px] w-full space-y-8 text-center animate-fade-in">
            <div className="flex items-center justify-center">
              <GoodluckLogo size={32} showTagline={true} />
            </div>
            
            <div className="space-y-3">
              <div className="h-[2px] bg-[#1E1E1E] rounded-full overflow-hidden w-full relative">
                <div 
                  className="h-full bg-accent transition-all duration-100 ease-out"
                  style={{ width: `${Math.min(100, loaderProgress)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                <span>Loading your personalized study plan...</span>
                <span>{Math.min(100, loaderProgress)}%</span>
              </div>
            </div>

            <button 
              onClick={skipLoader}
              className="text-[9px] font-mono text-gray-600 hover:text-white uppercase tracking-widest cursor-pointer hover:underline transition-colors"
            >
              Skip loading
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
         2. STICKY NAV BAR (Minimal, dynamic)
         ───────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-bg-surface/90 backdrop-blur-md border-b border-border h-16 flex items-center px-6 md:px-12 justify-between text-text-primary">
        <LogoButton size={28} />

        {/* Center Links */}
        <div className="hidden md:flex gap-8 text-[10px] font-mono uppercase tracking-widest text-text-secondary">
          <a href="#features" className="hover:text-accent transition-colors">Features</a>
          <a href="#week-plan" className="hover:text-accent transition-colors">Week Planner</a>
          <a href="#quiz" className="hover:text-accent transition-colors">Score quiz</a>
          <a href="#faq" className="hover:text-accent transition-colors">FAQ</a>
        </div>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <Link 
            href={mounted && student ? "/today" : "/onboarding"} 
            className="bg-text-primary hover:bg-text-primary/90 text-bg-base text-[10px] font-mono font-bold tracking-widest py-2.5 px-6 rounded-full transition-all uppercase"
          >
            {mounted && student ? "My Dashboard" : "Start My Plan"}
          </Link>
        </div>
      </nav>

      <section className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 pt-28 pb-16 relative overflow-hidden bg-bg-base border-b border-border">
        {/* Subtle background grids */}
        <div className="absolute inset-0 pointer-events-none hero-grid-bg z-0" />

        {/* Dynamic neon glow behind the text */}
        <div className="hero-neon-glow" />

        {/* Floating coordinate badges */}
        <div className="absolute inset-0 pointer-events-none hidden lg:flex justify-center select-none z-0">
          <div className="relative w-full max-w-[1200px] h-full">
            <div className="absolute top-[22%] left-[2%] bg-bg-surface border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="font-mono text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                Study Session: <span className="text-text-primary font-extrabold">Active</span>
              </span>
            </div>

            <div className="absolute top-[35%] right-[2%] bg-bg-surface border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm animate-float-a">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="font-mono text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                Plan Status: <span className="text-text-primary font-extrabold">Updating Daily</span>
              </span>
            </div>

            <div className="absolute bottom-[30%] left-[2%] bg-bg-surface border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm animate-float-b">
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="font-mono text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                <span className="text-danger font-extrabold">DILR Needs Attention</span>
              </span>
            </div>

            <div className="absolute top-[16%] right-[8%] bg-bg-surface border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="font-mono text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                Target: <span className="text-text-primary font-extrabold">99%ile</span>
              </span>
            </div>

            <div className="absolute bottom-[38%] right-[2%] bg-bg-surface border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm animate-float-a">
              <span className="w-2 h-2 rounded-full bg-warning" />
              <span className="font-mono text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                Streak: <span className="text-text-primary font-extrabold">18 days</span>
              </span>
            </div>

            <div className="absolute bottom-[20%] right-[8%] bg-bg-surface border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-warm animate-float-b">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="font-mono text-[9px] font-bold text-text-secondary uppercase tracking-wider">
                Mock Phase: <span className="text-text-primary font-extrabold">Ready</span>
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-[850px] w-full text-center space-y-8 relative z-10 flex flex-col items-center">
          <span className="font-mono text-[10px] text-accent-text tracking-widest uppercase font-bold border border-accent/20 px-3 py-1 rounded-full bg-bg-surface/50">
            A SYSTEMATIC STUDY METHOD FOR CAT ASPIRANTS
          </span>

          <h1 className="text-3xl sm:text-5xl md:text-7.5xl font-display tracking-tight leading-tight text-text-primary font-extrabold max-w-[850px] uppercase">
            Crack CAT <br />
            Without Burning Out. <br />
            <span className="text-accent italic font-normal">Stay Consistent.</span>
          </h1>

          <p className="text-sm sm:text-base text-text-secondary max-w-[550px] leading-relaxed font-light font-sans">
            AI builds your study plan, tracks your consistency, and helps you stay on track until exam day. Build a daily habit that gets you into your dream B-school.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2 items-center">
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link
                href={mounted && student ? "/today" : "/onboarding"}
                className="bg-accent text-[#0A0A0A] text-[11px] font-mono font-bold tracking-widest py-4 px-9 rounded-full transition-all uppercase shadow-md animate-cta-glow cursor-pointer text-center font-black"
              >
                {mounted && student ? "Go to Dashboard" : "Start My CAT Plan"}
              </Link>
            </div>
          </div>

          {/* Social Proof avatars */}
          <div className="flex items-center gap-2.5 pt-6">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-bg-base bg-bg-surface text-[10px] flex items-center justify-center font-bold text-text-secondary">A</div>
              <div className="w-8 h-8 rounded-full border-2 border-bg-base bg-accent text-[10px] flex items-center justify-center font-bold text-[#0A0A0A]">R</div>
              <div className="w-8 h-8 rounded-full border-2 border-bg-base bg-success text-[10px] flex items-center justify-center font-bold text-[#0A0A0A]">S</div>
              <div className="w-8 h-8 rounded-full border-2 border-bg-base bg-dilr text-[10px] flex items-center justify-center font-bold text-white">P</div>
            </div>
            <span className="text-[10px] font-mono text-text-secondary tracking-wider uppercase font-bold">
              Built for CAT 2026 aspirants
            </span>
          </div>

          {/* Bottom Preview Widgets Grid (Screenshot 3 style) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-[850px] pt-14 text-left">
            
            {/* Widget 1: Personal Week Plan */}
            <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-warm space-y-3">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest font-black">PERSONAL WEEKLY PLAN</span>
              </div>
              <div className="space-y-2 font-mono text-[9px] uppercase tracking-wider text-text-secondary">
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span>MON</span>
                  <span className="bg-success-light text-success border border-success/20 px-2 py-0.5 rounded text-[8px] font-black">Math Practice &bull; 2h</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span>TUE</span>
                  <span className="bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20 px-2 py-0.5 rounded text-[8px] font-black">DILR Caselets &bull; 1.5h</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span>WED</span>
                  <span className="bg-accent-light text-accent-text border border-accent/20 px-2 py-0.5 rounded text-[8px] font-black">Mock Test Analysis &bull; 2h</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span>THU</span>
                  <span className="bg-bg-sunken text-text-secondary border border-border px-2 py-0.5 rounded text-[8px] font-black">Verbal Reading Comp &bull; 1h</span>
                </div>
              </div>
            </div>

            {/* Widget 2: Study Session Timer */}
            <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-warm space-y-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest font-black">STUDY SESSION TIMER</span>
              </div>
              <div className="flex flex-col items-center py-1">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="absolute w-full h-full transform -rotate-95">
                    <circle cx="32" cy="32" r="28" stroke="var(--border)" strokeWidth="2.5" fill="transparent" />
                    <circle 
                      cx="32" 
                      cy="32" 
                      r="28" 
                      stroke="var(--accent)" 
                      strokeWidth="2.5" 
                      fill="transparent" 
                      strokeDasharray="175"
                      strokeDashoffset={175 - (175 * 65) / 100}
                      style={{ transformOrigin: "center", transform: `rotate(${focusCircleOffset}deg)` }}
                    />
                  </svg>
                  <span className="font-mono text-[10px] text-text-primary font-extrabold pt-0.5">01:56</span>
                </div>
                <span className="font-mono text-[8px] text-text-secondary uppercase tracking-widest mt-2 block font-black">Math Focus Session Active</span>
              </div>
            </div>

            {/* Widget 3: Consistency Streak */}
            <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-warm space-y-3 flex flex-col justify-between">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest font-black">CONSISTENCY STREAK</span>
              </div>
              <div className="text-center py-1">
                <div className="font-display font-bold text-4xl text-warning tracking-tight leading-none">18</div>
                <span className="font-mono text-[8px] text-text-tertiary uppercase tracking-widest mt-1 block font-black">DAY CONSISTENCY STREAK</span>
              </div>
              <div className="flex gap-1 justify-center">
                {Array.from({ length: 7 }).map((_, idx) => (
                  <div key={idx} className={`w-3.5 h-1.5 rounded-sm ${idx < 5 ? "bg-success" : "bg-bg-sunken border border-border"}`} />
                ))}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────
         4. CORE DIFFERENTIATOR FEATURES
         ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-12 bg-bg-base border-b border-border" id="features">
        <div className="max-w-[1080px] mx-auto space-y-16">
          
          <div className="text-center space-y-3">
            <h2 className="font-display font-extrabold text-4xl sm:text-6xl text-text-primary tracking-tight uppercase">
              Everything You Need <br />
              To Stay Consistent <span className="italic font-normal text-accent font-display">For CAT.</span>
            </h2>
            <p className="text-xs text-text-secondary tracking-widest uppercase font-mono max-w-[550px] mx-auto mt-4 font-bold">
              Planning is easy. Execution is hard. Goodluck helps you study consistently from Day 1 to Exam Day.
            </p>
          </div>

          {/* Feature matrix grid of 3x2 (Syne style grid cards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Smart Study Planner */}
            <div className="bg-bg-surface border border-border rounded-xl p-7 space-y-4 hover:border-accent/40 transition-all shadow-warm">
              <span className="font-mono text-[9px] text-accent font-black uppercase tracking-widest block">01 / STUDY PLANNER</span>
              <h3 className="font-sans font-bold text-lg text-text-primary tracking-wide">Smart Study Planner</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans font-light">
                Get a weekly study plan based on your target percentile, available hours, and weakest subjects. If your availability shifts, your upcoming slots automatically adjust to keep your schedule realistic and manageable.
              </p>
            </div>

            {/* Card 2: Study Tracker */}
            <div className="bg-bg-surface border border-border rounded-xl p-7 space-y-4 hover:border-accent/40 transition-all shadow-warm">
              <span className="font-mono text-[9px] text-accent font-black uppercase tracking-widest block">02 / TRACKING</span>
              <h3 className="font-sans font-bold text-lg text-text-primary tracking-wide">Study Tracker</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans font-light">
                Track daily study sessions and understand where your time actually goes. Log focus ratings and capture patterns to identify exactly when you study best and which topics are consuming your time.
              </p>
            </div>

            {/* Card 3: Exam Phase Planning */}
            <div className="bg-bg-surface border border-border rounded-xl p-7 space-y-4 hover:border-accent/40 transition-all shadow-warm">
              <span className="font-mono text-[9px] text-accent font-black uppercase tracking-widest block">03 / EXAM STAGES</span>
              <h3 className="font-sans font-bold text-lg text-text-primary tracking-wide">Exam Phase Planning</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans font-light">
                Your preparation strategy changes automatically as CAT gets closer. Automatically switch gears between syllabus coverage, targeted practice drills, full-length mock debriefs, and last-week revisions.
              </p>
            </div>

            {/* Card 4: Mock Analysis */}
            <div className="bg-bg-surface border border-border rounded-xl p-7 space-y-4 hover:border-accent/40 transition-all shadow-warm">
              <span className="font-mono text-[9px] text-accent font-black uppercase tracking-widest block">04 / PERFORMANCE</span>
              <h3 className="font-sans font-bold text-lg text-text-primary tracking-wide">Mock Analysis</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans font-light">
                Find the gap between your practice performance and mock test performance. Track your sectional percentiles across AIMCAT/SimCAT tests to see if timed exam anxiety is affecting your true accuracy.
              </p>
            </div>

            {/* Card 5: Burnout Protection */}
            <div className="bg-bg-surface border border-border rounded-xl p-7 space-y-4 hover:border-accent/40 transition-all shadow-warm">
              <span className="font-mono text-[9px] text-accent font-black uppercase tracking-widest block">05 / WELLNESS</span>
              <h3 className="font-sans font-bold text-lg text-text-primary tracking-wide">Burnout Prevention</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans font-light">
                Detect inconsistent patterns early and prevent burnout before it affects performance. Our planning system monitors shifts in study times and helps you plan lighter slots and scheduled rest days.
              </p>
            </div>

            {/* Card 6: Accountability Circles */}
            <div className="bg-bg-surface border border-border rounded-xl p-7 space-y-4 hover:border-accent/40 transition-all shadow-warm">
              <span className="font-mono text-[9px] text-accent font-black uppercase tracking-widest block">06 / ACCOUNTABILITY</span>
              <h3 className="font-sans font-bold text-lg text-text-primary tracking-wide">Accountability Circles</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-sans font-light">
                Stay motivated with serious CAT aspirants preparing alongside you. Join a silent pod of 3–5 peers targeting similar percentiles to share daily study completions without distracting chats.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────
         5. BUILD YOUR WEEK RIGHT NOW (Interactive dark generator - Screenshot 2)
         ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-12 bg-[#0A0A0A] text-white border-b border-[#1E1E1E]" id="week-plan">
        <div className="max-w-[1080px] mx-auto space-y-12 text-center">
          
          <div className="space-y-3">
            <h2 className="font-display font-medium text-4xl sm:text-5xl text-white tracking-tight">
              Generate Your Personal <span className="italic font-normal">CAT Study Plan</span>
            </h2>
            <p className="text-xs text-gray-400 font-sans font-light max-w-[500px] mx-auto">
              Tell us your goal, study hours, and weak areas. We&apos;ll build your week instantly.
            </p>
          </div>

          {/* Form input selectors block */}
          <div className="bg-[#121212] border border-[#1F2937] rounded-xl p-6 md:p-8 max-w-[950px] mx-auto space-y-8 text-left">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Selector 1 */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2 font-bold">
                  Your Prep Goal
                </label>
                <select 
                  value={userGoal}
                  onChange={(e) => setUserGoal(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#1F2937] text-white text-xs rounded-lg py-3 px-4 focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  <option value="99th Percentile Target">99th Percentile Target</option>
                  <option value="Sectional Balance Focus">Sectional Balance Focus</option>
                  <option value="Mock Test Acceleration">Mock Test Acceleration</option>
                </select>
              </div>

              {/* Selector 2 */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2 font-bold">
                  Hours Per Day
                </label>
                <select 
                  value={userHours}
                  onChange={(e) => setUserHours(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#1F2937] text-white text-xs rounded-lg py-3 px-4 focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  <option value="3 hours">3 hours / day</option>
                  <option value="5 hours">5 hours / day</option>
                  <option value="8 hours">8 hours / day</option>
                </select>
              </div>

              {/* Selector 3 */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2 font-bold">
                  Weakest Subject
                </label>
                <select 
                  value={userWeakest}
                  onChange={(e) => setUserWeakest(e.target.value)}
                  className="w-full bg-[#1A1A1E] border border-[#1F2937] text-white text-xs rounded-lg py-3 px-4 focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  <option value="Quant">Quantitative Aptitude (Quant)</option>
                  <option value="DILR">Data Interpretation & LR (DILR)</option>
                  <option value="VARC">Verbal Ability & RC (VARC)</option>
                </select>
              </div>

            </div>

            {/* Dynamic generate button */}
            <button
              onClick={handleGenerateClick}
              className="w-full bg-accent hover:bg-accent/90 text-[#0A0A0A] text-[11px] font-mono font-bold tracking-widest py-4 rounded-lg uppercase transition-all cursor-pointer shadow-sm hover:shadow"
            >
              Generate My Week Plan
            </button>

            {/* Dynamically Rendered Horizontal Week Schedule preview grid (Screenshot 2 style) with smooth transition */}
            <div className={`transition-all duration-700 ease-in-out overflow-hidden ${planGenerated ? "max-h-[800px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0 pointer-events-none"}`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-4">
                {weekPlan.map((dayData, idx) => (
                  <div key={idx} className="bg-[#1C1C1E] border border-[#1F2937] rounded-xl p-3.5 space-y-3.5 min-h-[190px] flex flex-col justify-between">
                    <span className="font-mono text-[9px] text-gray-400 font-extrabold uppercase border-b border-[#1F2937]/60 pb-1.5 block">
                      {dayData.day}
                    </span>
                    
                    <div className="space-y-2 flex-grow flex flex-col justify-center">
                      {dayData.pills.map((pill: any, pIdx: number) => (
                        <div 
                          key={pIdx} 
                          className={`text-[9px] font-mono font-black py-2 px-2.5 rounded-lg flex flex-col justify-center gap-0.5 leading-tight ${pill.bg}`}
                        >
                          <span className="truncate">{pill.subject}</span>
                          <span className="opacity-75 text-[7px]">{pill.time} duration</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 mt-6 border-t border-[#1F2937]/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                  This is an interactive preview. The real Goodluck adapts this daily based on your logs.
                </span>
                <Link
                  href={mounted && student ? "/today" : "/onboarding"}
                  className="bg-white hover:bg-white/90 text-black text-[10px] font-mono font-black py-3.5 px-8 rounded-full transition-all uppercase tracking-wider text-center"
                >
                  {mounted && student ? "View My Study Plan" : "Get my actual plan"}
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────
         6. BEFORE / AFTER COMPARISONS & COGNITIVE RISK QUIZ
         ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-12 bg-bg-base border-b border-border" id="quiz">
        <div className="max-w-[700px] mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <span className="font-mono text-[10px] text-accent font-black tracking-widest uppercase block">
              CONSISTENCY ASSESSMENT
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-text-primary tracking-tight uppercase">
              Find What&apos;s Slowing Down Your CAT Preparation
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed font-sans font-light">
              Take a 2 minute assessment and discover the habits affecting your consistency.
            </p>
          </div>

          {!quizStarted ? (
            <div className="bg-bg-surface border border-border p-8 rounded-xl text-center space-y-6 shadow-warm">
              <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-accent mx-auto">
                <AlertCircle size={20} className="stroke-[2]" />
              </div>
              <h3 className="text-base font-semibold text-text-primary font-sans">5 Questions &bull; 90 Seconds</h3>
              <p className="text-xs text-text-secondary max-w-[450px] mx-auto leading-relaxed font-light font-sans">
                Analyze your daily preparation habits and mock-testing anxiety triggers. Press keys A/B/C/D to answer instantly.
              </p>
              <button
                onClick={() => setQuizStarted(true)}
                className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-[10px] font-mono font-bold tracking-widest py-3.5 px-8 rounded-full uppercase transition-all cursor-pointer shadow-md"
              >
                Start Assessment
              </button>
            </div>
          ) : quizComplete ? (
            <div className="bg-bg-surface border border-border p-8 rounded-xl space-y-6 shadow-warm text-center">
              <div className="space-y-2">
                <span className="font-mono text-[9px] text-text-secondary uppercase tracking-widest font-black block">
                  Your Consistency Score
                </span>
                <div className="text-5xl font-mono font-black text-accent">{quizScore} / 100</div>
                <div className="text-xs font-bold text-text-primary mt-2 uppercase tracking-wide">
                  {quizScore < 40 ? "Needs Immediate Attention" : quizScore < 70 ? "Moderate Consistency" : "Excellent Consistency"}
                </div>
              </div>

              <div className="h-[1px] bg-border" />

              <div className="space-y-4">
                <p className="text-xs text-text-secondary leading-relaxed font-sans font-light max-w-[500px] mx-auto">
                  {quizScore < 40 
                    ? "You're struggling to stay consistent. Your routine breaks down completely under workload pressure." 
                    : quizScore < 70 
                    ? "You're studying regularly, but your routine breaks after a few days." 
                    : "You have highly consistent habits. Goodluck will help you refine mock strategies and defend your target."}
                </p>

                <div className="space-y-2">
                  <span className="font-mono text-[9px] text-text-tertiary uppercase tracking-widest font-bold">Recommended Adjustments:</span>
                  <ul className="text-left text-xs space-y-1 max-w-[280px] mx-auto text-text-secondary list-disc pl-5">
                    <li>Reduce daily overload</li>
                    <li>Increase revision blocks</li>
                    <li>Schedule recovery days</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2 items-center">
                <button
                  onClick={resetQuiz}
                  className="w-full sm:w-auto text-[9px] font-mono text-text-secondary hover:text-text-primary uppercase tracking-widest border border-border-strong py-2.5 px-4 rounded-full transition-colors cursor-pointer bg-bg-base"
                >
                  Retry Assessment
                </button>
                <Link
                  href={mounted && student ? "/today" : "/onboarding"}
                  className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-[#0A0A0A] text-[9px] font-mono font-bold tracking-widest py-2.5 px-6 rounded-full transition-all text-center font-black"
                >
                  {mounted && student ? "View My Study Plan" : "Get My Personalized Plan"}
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-bg-surface border border-border p-8 rounded-xl space-y-6 shadow-warm">
              {/* Progress bar */}
              <div className="flex justify-between items-center text-[10px] font-mono text-text-secondary uppercase tracking-widest">
                <span>Assessment Progress</span>
                <span>Question {currentQ + 1} of {QUESTIONS.length}</span>
              </div>
              <div className="h-[2px] bg-border rounded-full overflow-hidden w-full">
                <div 
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${((currentQ) / QUESTIONS.length) * 100}%` }}
                />
              </div>

              {/* Question text */}
              <h3 className="text-lg font-sans font-bold text-text-primary leading-snug">
                {QUESTIONS[currentQ].q}
              </h3>

              {/* Options */}
              <div className="space-y-2.5 pt-2">
                {QUESTIONS[currentQ].options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    className="w-full text-left bg-bg-base hover:bg-accent/5 border border-border hover:border-accent rounded-lg p-4 flex items-center justify-between text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer font-sans"
                  >
                    <span>{opt.text}</span>
                    <span className="font-mono text-[9px] bg-bg-surface border border-border px-2 py-0.5 rounded text-text-secondary uppercase tracking-wider">
                      Key {["A", "B", "C", "D"][idx]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────
         7. SYSTEM INTERACTIVE CLOCK (Working Embedded Timer preview)
         ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-12 bg-bg-base border-b border-border" id="preview">
        <div className="max-w-[900px] mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <span className="font-mono text-[10px] text-accent font-black tracking-widest uppercase block animate-pulse">
              LIVE TIMER PREVIEW
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-text-primary tracking-tight uppercase">
              Try the Focused Study Timer
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed font-sans font-light max-w-[450px] mx-auto">
              Start a mock study session to see how Goodluck helps you avoid distractions.
            </p>
          </div>

          {/* Embedded UI Mockup */}
          <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-xl overflow-hidden shadow-warm">
            
            {/* Top Chrome bar */}
            <div className="bg-[#121212] border-b border-[#1F2937] px-4 py-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-danger block animate-pulse" />
                <span className="w-2.5 h-2.5 rounded-full bg-warning block" />
                <span className="w-2.5 h-2.5 rounded-full bg-success block" />
              </div>
              <span className="font-mono text-[8px] text-gray-500 uppercase tracking-widest font-black">
                STUDY TIMER PREVIEW
              </span>
              <div className="w-10" />
            </div>

            {/* Main Embed Body */}
            <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center text-white">
              
              {/* Focus Timer clock */}
              <div className="bg-[#121212] border border-[#1F2937] p-6 rounded-xl text-center space-y-6 shadow-sm">
                <span className="font-mono text-[9px] text-accent tracking-widest uppercase block font-black">
                  STUDY SESSION TIME
                </span>
                
                <div className="font-mono text-5xl sm:text-6xl text-white tracking-tighter leading-none font-bold">
                  {formatTime(pomoTime)}
                </div>

                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-bold">
                  Math Practice &bull; Focus Block
                </p>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setPomoActive(!pomoActive)}
                    className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-[9px] font-mono font-bold tracking-widest py-2.5 px-6 rounded-lg uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    {pomoActive ? <Square size={10} className="fill-current" /> : <Play size={10} className="fill-current font-black" />}
                    <span>{pomoActive ? "PAUSE" : "START"}</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setPomoActive(false);
                      setPomoTime(1500);
                    }}
                    className="border border-[#1F2937] hover:border-white text-gray-400 hover:text-white text-[9px] font-mono font-bold tracking-widest py-2.5 px-4 rounded-lg uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    <span>RESET</span>
                  </button>
                </div>
              </div>

              {/* Informational Text */}
              <div className="space-y-4">
                <span className="font-mono text-[9px] text-[#10B981] tracking-widest uppercase font-black block">
                  No Distractions. No Anxiety.
                </span>
                <h3 className="text-xl font-medium tracking-tight text-white leading-snug">
                  Designed for deep focus.
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed font-sans font-light">
                  No public notifications or sudden alarm interruptions. When your study block ends, your progress is saved to your history automatically. Goodluck provides a quiet, distraction-free environment to do your best work.
                </p>
                <div className="h-[1px] bg-[#1F2937] pt-2" />
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 uppercase tracking-wider font-bold">
                  <ShieldCheck size={14} className="text-accent" />
                  <span>Automatic progress logging</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────
         8. FAQ ACCORDION Accordion list
         ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-12 bg-bg-base border-b border-border" id="faq">
        <div className="max-w-[700px] mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <span className="font-mono text-[10px] text-accent tracking-widest uppercase font-black block">
              QUESTIONS & ANSWERS
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-text-primary tracking-tight uppercase">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How does the planner adapt when I miss a session?",
                a: "If you miss a study block due to work or college, Goodluck doesn't make you feel guilty with a broken calendar. It automatically re-schedules the missed topic into your upcoming week so you stay on track."
              },
              {
                q: "Is this a course or coaching platform?",
                a: "No. Goodluck does not provide video lectures or syllabus textbooks. It sits on top of your existing coaching or study materials, acting as the personal habit assistant that makes sure you actually execute your plan every day."
              },
              {
                q: "How do study circles keep me accountable?",
                a: "You are matched with 3 to 5 serious CAT aspirants targeting a similar percentile. There are no noisy chat rooms or distracting chat threads. You simply see a silent daily progress check showing that others are showing up, which naturally motivates you to do the same."
              }
            ].map((faq, idx) => (
              <div key={idx} className="border border-border rounded-xl overflow-hidden bg-bg-surface shadow-warm">
                <button
                  onClick={() => setActiveFAQ(activeFAQ === idx ? null : idx)}
                  className="w-full py-5 px-6 flex justify-between items-center text-left text-xs font-bold text-text-primary hover:text-accent transition-colors cursor-pointer font-sans"
                >
                  <span>{faq.q}</span>
                  <ChevronDown 
                    size={16} 
                    className={`text-text-secondary transition-transform duration-300 ${activeFAQ === idx ? "transform rotate-180" : ""}`} 
                  />
                </button>
                {activeFAQ === idx && (
                  <div className="p-6 pt-0 border-t border-border text-xs text-text-secondary leading-relaxed font-light font-sans bg-bg-base/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>


      {/* ─────────────────────────────────────────────
         10. FINAL CALL TO ACTION (Dark background grid)
         ───────────────────────────────────────────── */}
      <section className="bg-[#0A0A0A] py-20 sm:py-32 px-4 sm:px-6 md:px-12 border-b border-[#1F2937] text-center relative overflow-hidden text-white">
        <div className="absolute inset-0 pointer-events-none grid-bg-dark opacity-30" />

        <div className="max-w-[700px] mx-auto space-y-8 relative z-10">
          <span className="font-mono text-[10px] text-accent tracking-widest uppercase font-bold block animate-pulse">
            STUDY PROGRAM STATUS: OPEN
          </span>
          <h2 className="text-4xl sm:text-6xl text-white tracking-tighter leading-tight font-medium font-display uppercase">
            Your CAT Rank Will Come From Consistency.
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed max-w-[450px] mx-auto font-light font-sans">
            Not another timetable. Not another productivity video. Build a system that helps you show up every day.
          </p>

          <div className="flex justify-center pt-4">
            <Link
              href={mounted && student ? "/today" : "/onboarding"}
              className="bg-accent hover:bg-accent/90 text-[#0A0A0A] text-[11px] font-mono font-bold tracking-widest py-4 px-10 rounded-full uppercase transition-all shadow-md animate-cta-glow cursor-pointer font-black"
            >
              {mounted && student ? "Continue My Preparation" : "Start Preparing Today"}
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
         11. FOOTER
         ───────────────────────────────────────────── */}
      <footer className="border-t border-border bg-bg-surface text-left py-16 px-6 md:px-12 antialiased text-text-primary">
        <div className="max-w-[1080px] mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          
          <div className="space-y-4">
            <LogoButton size={28} />
            <p className="text-[9px] font-mono text-text-secondary uppercase tracking-widest leading-relaxed max-w-[200px] font-bold">
              A clean study system built for serious CAT preparation. &bull; Copyright &copy; 2026.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-mono text-text-tertiary uppercase tracking-widest font-black">
              Study Core
            </h4>
            <ul className="space-y-2 text-[11px] font-mono text-text-secondary uppercase tracking-wider list-none font-bold p-0 m-0">
              <li><Link href="/onboarding" className="hover:text-accent transition-colors">Mock Planner</Link></li>
              <li><Link href="/onboarding" className="hover:text-accent transition-colors">Study Tracker</Link></li>
              <li><a href="#quiz" className="hover:text-accent transition-colors">Consistency Streaks</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-mono text-text-tertiary uppercase tracking-widest font-black">
              Features
            </h4>
            <ul className="space-y-2 text-[11px] font-mono text-text-secondary uppercase tracking-wider list-none font-bold p-0 m-0">
              <li><span>Peer Accountability</span></li>
              <li><span>Progress Analytics</span></li>
              <li><span>Weekly Schedule</span></li>
            </ul>
          </div>

        </div>
      </footer>

      </div>
    </LandingWrapper>
  );
}
