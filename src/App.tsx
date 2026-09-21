import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { usePlannerStore } from "./store/plannerStore";
import { enhanceEventsWithGemini } from "./lib/geminiClient";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import SetupForm from "./components/SetupForm";
import CalendarView from "./components/CalendarView";
import ListView from "./components/ListView";
import KanbanView from "./components/KanbanView";
import DashboardView from "./components/DashboardView";
import PomodoroWidget from "./components/PomodoroWidget";
import LandingView from "./components/LandingView";
import { PdfExportTemplate } from "./components/PdfExportTemplate";
import { LogoWordmark } from "./components/Logo";
import { isGeminiConfigured } from "./lib/geminiClient";
import {
  Calendar,
  List,
  Settings,
  Key,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  BarChart3,
  Download,
  Clock,
  Menu,
  X,
  FileText,
  Calendar as CalendarIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { tabTransition, DURATION, EASE_OUT, SPRING, pressable } from "./lib/motion";
import { format } from "date-fns";

type Tab = "setup" | "calendar" | "list" | "kanban" | "dashboard";

export default function App() {
  const store = usePlannerStore();
  const geminiReady = isGeminiConfigured();
  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAppStarted, setIsAppStarted] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const deviceId = useRef(
    localStorage.getItem("focusflow_device_id") ||
      (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15))
  ).current;

  // Data Loading
  useEffect(() => {
    localStorage.setItem("focusflow_device_id", deviceId);
    loadData(deviceId);
  }, [deviceId]);

  const loadData = async (userId: string) => {
    if (!isSupabaseConfigured) {
      setIsDataLoaded(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("planner_data")
        .select("state")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading data:", error);
      }

      if (data && data.state) {
        store.setFullState(data.state);
      }
    } catch (error) {
      console.error("Error in loadData:", error);
    } finally {
      setIsDataLoaded(true);
    }
  };

  // Auto-save logic
  useEffect(() => {
    if (!isDataLoaded || !isSupabaseConfigured) return;

    const saveTimeout = setTimeout(async () => {
      try {
        const stateToSave = {
          dday: store.dday,
          startDate: store.startDate,
          goals: store.goals,
          goalImportance: store.goalImportance,
          timePerDay: store.timePerDay,
          prefTime: store.prefTime,
          restDay: store.restDay,
          extraRequest: store.extraRequest,
          events: store.events,
          theme: store.theme,
        };

        const { error } = await supabase.from("planner_data").upsert({
          user_id: deviceId,
          state: stateToSave,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.error("Error saving data:", error);
        }
      } catch (error) {
        console.error("Error in auto-save:", error);
      }
    }, 1500);

    return () => clearTimeout(saveTimeout);
  }, [
    isDataLoaded,
    deviceId,
    store.dday,
    store.startDate,
    store.goals,
    store.goalImportance,
    store.timePerDay,
    store.prefTime,
    store.restDay,
    store.extraRequest,
    store.events,
    store.theme,
  ]);

  useEffect(() => {
    // Apply initial theme
    document.documentElement.setAttribute("data-theme", store.theme);

    // If events exist, default to calendar view
    if (store.events.length > 0 && activeTab === "setup") {
      setActiveTab("calendar");
    }
  }, [store.events.length, store.theme]);

  const handleRefineTasks = () => store.refineWithAI();

  const handleExportPDF = async () => {
    if (!pdfRef.current || store.events.length === 0) return;
    setIsExporting(true);
    setIsExportMenuOpen(false);

    try {
      const element = pdfRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save("study_plan.pdf");
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("PDF 내보내기 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportICS = () => {
    if (store.events.length === 0) return;

    // RFC 5545: TEXT 값 안의 역슬래시·세미콜론·쉼표·줄바꿈은 반드시 이스케이프한다.
    // AI가 쓰는 한국어 할 일 문구에는 쉼표가 흔해서, 그대로 두면 파서가 값 구분자로 읽는다.
    const escapeText = (value: string) =>
      String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");

    // RFC 5545: 한 줄은 75옥텟을 넘으면 접어야 한다(다음 줄을 공백으로 시작).
    // 한글은 UTF-8에서 3바이트라 금방 넘어가므로 바이트 기준으로 자른다.
    const foldLine = (line: string) => {
      const encoder = new TextEncoder();
      if (encoder.encode(line).length <= 75) return line;

      const out: string[] = [];
      let current = "";
      let currentBytes = 0;
      let limit = 75;

      for (const char of line) {
        const size = encoder.encode(char).length;
        if (currentBytes + size > limit) {
          out.push(current);
          current = " " + char; // 이어지는 줄은 공백 한 칸으로 시작
          currentBytes = 1 + size;
          limit = 75;
        } else {
          current += char;
          currentBytes += size;
        }
      }
      if (current) out.push(current);
      return out.join("\r\n");
    };

    const dtstamp =
      new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FocusFlow_AI//KO",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    store.events.forEach((event) => {
      const dateStr = event.date.replace(/-/g, "");
      // 종일 일정의 DTEND는 다음 날이어야 하루짜리로 표시된다
      const end = new Date(`${event.date}T00:00:00`);
      end.setDate(end.getDate() + 1);
      const endStr = format(end, "yyyyMMdd");

      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.id}-${dateStr}@focusflow-ai`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${endStr}`,
        `SUMMARY:${escapeText(`${event.subject} - ${event.task}`)}`,
        `DESCRIPTION:${escapeText(`소요시간: ${event.duration}\n단계: ${event.phase}`)}`,
        "END:VEVENT",
      );
    });

    lines.push("END:VCALENDAR");

    // RFC 5545는 줄바꿈으로 CRLF를 요구한다
    const ics = lines.map(foldLine).join("\r\n") + "\r\n";

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "study_plan.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navItems = [
    { id: "setup", label: "플랜 설정", icon: Settings, disabled: false },
    {
      id: "calendar",
      label: "캘린더",
      icon: Calendar,
      disabled: store.events.length === 0,
    },
    {
      id: "kanban",
      label: "보드",
      icon: LayoutGrid,
      disabled: store.events.length === 0,
    },
    {
      id: "dashboard",
      label: "통계",
      icon: BarChart3,
      disabled: store.events.length === 0,
    },
    {
      id: "list",
      label: "목록",
      icon: List,
      disabled: store.events.length === 0,
    },
  ] as const;

  if (!isDataLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAppStarted) {
    return <LandingView onStart={() => setIsAppStarted(true)} />;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-primary-500/30 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200/80 dark:border-zinc-800/80 flex-shrink-0">
          <LogoWordmark markClassName="w-5 h-5" />
          <button
            className="md:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.disabled) {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={`relative w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-colors duration-200 ${
                  activeTab === item.id
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                } ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {/* 활성 탭 배경이 항목 사이를 미끄러지듯 따라 이동한다 */}
                {activeTab === item.id && (
                  <motion.span
                    layoutId="navActiveBg"
                    transition={SPRING}
                    className="absolute inset-0 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${activeTab === item.id ? "text-primary-500" : ""}`} />
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-5 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-zinc-900/50 flex-shrink-0">
          <div className="mb-5">
            <label className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 block">
              테마 설정
            </label>
            <div className="flex gap-2.5">
              {(["indigo", "rose", "emerald", "amber", "violet"] as const).map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => store.setTheme(t)}
                    className={`w-6 h-6 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                      store.theme === t
                        ? "border-zinc-900 dark:border-white scale-110 shadow-sm"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: `var(--color-${t}-500)`,
                    }}
                    title={t}
                  />
                ),
              )}
            </div>
          </div>

          <div className="flex items-center justify-center p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            {geminiReady ? (
              <div className="flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> AI 최적화 활성
              </div>
            ) : (
              <div className="flex items-center text-xs font-medium text-amber-600 dark:text-amber-400 text-center leading-snug">
                <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                기본 규칙 모드 · .env.local 설정 필요
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-zinc-950">
        {/* Header */}
        <header className="h-16 flex-shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {navItems.find((item) => item.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {store.dday > 0 && (
              <div className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-3.5 py-1.5 rounded-full border border-primary-100/50 dark:border-primary-800/30 font-bold tracking-tight text-sm shadow-sm">
                <Clock className="w-4 h-4" />
                D-{store.dday}
              </div>
            )}

            {store.events.length > 0 && (
              <div className="flex items-center gap-2.5">
                <motion.button
                  {...pressable}
                  onClick={handleRefineTasks}
                  disabled={store.aiRefining}
                  className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-full transition-all text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50"
                >
                  {store.aiRefining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {store.aiRefining ? "구체화 중..." : "AI 할 일 구체화"}
                  </span>
                </motion.button>

                <div className="relative">
                  <button
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 transition-all text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {isExporting ? "생성 중..." : "내보내기"}
                    </span>
                  </button>

                  {isExportMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsExportMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-1.5 z-50 overflow-hidden">
                        <button
                          onClick={handleExportPDF}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-left"
                        >
                          <FileText className="w-4 h-4 text-red-500" />
                          PDF로 내보내기
                        </button>
                        <button
                          onClick={() => {
                            handleExportICS();
                            setIsExportMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-left"
                        >
                          <CalendarIcon className="w-4 h-4 text-blue-500" />
                          구글 캘린더 (ICS)
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* AI 상태 배너 — 일정 생성 직후 캘린더로 자동 전환돼도 사라지지 않도록 App 레벨에서 렌더 */}
        <AnimatePresence>
        {store.aiRefining && (
          <motion.div
            key="refining"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="flex-shrink-0 overflow-hidden flex items-center gap-2.5 px-6 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800/50 text-primary-700 dark:text-primary-300 text-sm font-medium"
          >
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            <span className="flex-1">
              <strong className="font-bold">② Gemini</strong>가 각 날짜의 할 일을 구체화하는 중입니다.
              일정 구조는 그대로 두고 내용만 바뀝니다.
            </span>
          </motion.div>
        )}
        {store.aiNotice && (
          <motion.div
            key="notice"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="flex-shrink-0 overflow-hidden flex items-start gap-2.5 px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-sm font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{store.aiNotice}</span>
            <button
              onClick={() => store.setAiNotice(null)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabTransition}
              initial="hidden"
              animate="show"
              exit="exit"
              className="w-full h-full"
            >
              {activeTab === "setup" && (
                <div className="h-full overflow-auto p-4 sm:p-8 custom-scrollbar flex items-center justify-center">
                  <SetupForm onComplete={() => setActiveTab("calendar")} />
                </div>
              )}
              {activeTab === "calendar" && <CalendarView />}
              {activeTab === "kanban" && <KanbanView />}
              {activeTab === "dashboard" && <DashboardView />}
              {activeTab === "list" && <ListView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global Widgets */}
      <PomodoroWidget />
      <PdfExportTemplate
        ref={pdfRef}
        events={store.events}
        dday={store.dday}
        startDate={store.startDate}
      />
    </div>
  );
}
