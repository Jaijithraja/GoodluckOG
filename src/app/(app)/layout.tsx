"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStudentStore } from "@/store/studentStore";
import { Calendar, CheckSquare, BarChart2, FileText, UserCheck, Settings, LogOut, Menu, X, Sun, Moon } from "lucide-react";
import GoodluckLogo from "@/components/GoodluckLogo";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const student = useStudentStore((state) => state.student);
  const loadFromLocalStorage = useStudentStore((state) => state.loadFromLocalStorage);
  const clearDemoData = useStudentStore((state) => state.clearDemoData);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [daysToCAT, setDaysToCAT] = useState(181);

  useEffect(() => {
    // Load student state on mount
    loadFromLocalStorage();

    // Load active theme
    const activeTheme = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(activeTheme as any);
  }, [loadFromLocalStorage]);

  useEffect(() => {
    // Calculate days remaining dynamically based on student exam date or fallback to Nov 29, 2026
    const calculateDays = () => {
      const targetDateStr = student?.exam_date || "2026-11-29";
      const examDate = new Date(targetDateStr + "T00:00:00");
      const today = new Date();
      examDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    };
    setDaysToCAT(calculateDays());
  }, [student]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("goodluck-theme", nextTheme);
    setTheme(nextTheme);
  };



  // If onboarding is active, skip layout shell to avoid sidebar distractions
  const isOnboarding = pathname === "/onboarding";

  if (isOnboarding) {
    return <div className="min-h-screen bg-bg-base">{children}</div>;
  }

  // Sidebar navigation elements
  const NAV_ITEMS = [
    { name: "Today's Plan", href: "/today", icon: CheckSquare },
    { name: "Dashboard", href: "/dashboard", icon: Calendar },
    { name: "Mock Analytics", href: "/mocks", icon: BarChart2 },
    { name: "Weekly Reports", href: "/weekly", icon: FileText },
    { name: "Accountability Pod", href: "/pod", icon: UserCheck },
    { name: "System Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="h-screen w-screen bg-bg-base text-text-primary flex flex-col md:flex-row select-none antialiased overflow-hidden">
      
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-bg-surface border-b border-border z-30 sticky top-0 shadow-warm">
        <Link href="/today">
          <GoodluckLogo size={24} showTagline={false} />
        </Link>
        <div className="flex items-center gap-4">
          <div className="bg-accent-light border border-accent/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-[9px] font-black text-accent-text">{daysToCAT} DAYS TO CAT</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-[260px] bg-bg-surface border-r border-border p-6 h-screen justify-between shrink-0 sticky top-0 shadow-warm overflow-y-auto">
        <div className="space-y-6">
          {/* Brand header */}
          <Link href="/today" className="block hover:opacity-90 transition-opacity">
            <GoodluckLogo size={36} showTagline={true} />
          </Link>

          {/* Countdown card anchor */}
          <div className="bg-bg-sunken border border-border rounded-xl p-4 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-text-secondary tracking-widest uppercase font-bold">DAYS TO CAT 2026</span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-4xl font-extrabold text-accent leading-none tracking-tighter">
                {daysToCAT}
              </span>
              <span className="font-mono text-[9px] text-text-secondary uppercase">days remaining</span>
            </div>
            {/* Visual progress bar based on 365 days prep timeline */}
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-500" 
                style={{ width: `${(daysToCAT / 365) * 100}%` }}
              />
            </div>
            <div className="text-[9px] font-mono text-text-tertiary uppercase flex justify-between font-bold">
              <span>{student?.prep_phase || "FOUNDATION"} PHASE</span>
              <span>{Math.round((daysToCAT / 365) * 100)}% Left</span>
            </div>
          </div>

          {/* Nav list */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-mono tracking-wider transition-all ${
                    isActive
                      ? "bg-accent-light border-l-2 border-accent text-accent-text font-bold"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-sunken"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-accent" : "text-text-secondary"} />
                  <span>{item.name.toUpperCase()}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Profile Footer */}
        {student && (
          <div className="pt-6 border-t border-border flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono font-bold text-text-primary truncate">{student.name}</div>
              </div>
              <div className="flex gap-2 items-center mt-1.5">
                <span className="bg-accent-light border border-accent/20 text-accent-text text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded-badge">
                  {student.prep_phase}
                </span>
                <span className="text-[9px] font-mono text-text-secondary uppercase">
                  {student.target_percentile}%ILE TARGET
                </span>
              </div>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-[10px] font-mono font-bold tracking-wider text-left transition-colors cursor-pointer w-fit uppercase"
            >
              {theme === "light" ? <Moon size={12} /> : <Sun size={12} />}
              <span>{theme === "light" ? "DARK CORE MODE" : "LIGHT EDITORIAL MODE"}</span>
            </button>

            <button
              onClick={async () => {
                // Reset all data & redirect
                await clearDemoData();
                router.push("/");
              }}
              className="flex items-center gap-2 text-text-secondary hover:text-danger text-[10px] font-mono font-bold tracking-wider text-left transition-colors cursor-pointer w-fit uppercase"
            >
              <LogOut size={12} />
              <span>RESET ALL DATA</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer Navigation overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-bg-base/98 z-20 flex flex-col p-8 pt-24 animate-fade-in">
          <nav className="space-y-4 flex-grow">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-md text-sm font-mono tracking-widest transition-all ${
                    isActive
                      ? "bg-accent-light border-l-2 border-accent text-accent-text font-bold"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.name.toUpperCase()}</span>
                </Link>
              );
            })}
          </nav>
          {student && (
            <div className="pt-6 border-t border-border flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-text-primary font-mono">{student.name}</div>
                  </div>
                  <div className="text-[10px] text-text-secondary font-mono">TARGET IIM {student.dreamIIM}</div>
                </div>
                

                {/* Mobile Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="bg-bg-sunken hover:bg-accent-light border border-border p-2 rounded-md text-text-secondary hover:text-accent-text transition-all cursor-pointer"
                  title="Toggle Theme Mode"
                >
                  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                </button>
              </div>

              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await clearDemoData();
                  router.push("/");
                }}
                className="text-danger text-xs font-mono font-bold cursor-pointer hover:underline text-left font-black uppercase tracking-wider"
              >
                RESET ALL DATA
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main content body */}
      <div className="flex-grow h-[calc(100vh-64px)] md:h-screen flex flex-col overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 md:px-12 md:py-10 max-w-[1200px] mx-auto w-full shrink-0">
        {children}
      </div>

    </div>
  );
}
