import type { ReactNode } from "react";
import { motion } from "motion/react";
import { riseIn, staggerParent, STAGGER, DURATION, EASE_OUT, pressable } from "../lib/motion";
import { Calendar, Sparkles, LayoutGrid, BarChart3, Clock, ArrowRight } from "lucide-react";

interface LandingViewProps {
  onStart: () => void;
}

export default function LandingView({ onStart }: LandingViewProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-primary-500/30 font-sans overflow-y-auto">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80 z-50 flex items-center justify-between px-6 sm:px-12">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm shadow-primary-500/20">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-[17px] font-bold tracking-tight text-zinc-900 dark:text-white">
            FocusFlow_AI
          </h1>
        </div>
        <button
          onClick={onStart}
          className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          앱으로 이동
        </button>
      </header>

      {/* Hero Section */}
      <motion.section
        className="pt-32 pb-20 px-6 sm:px-12 max-w-7xl mx-auto flex flex-col items-center text-center"
        variants={staggerParent(0.1)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={riseIn} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-sm font-medium mb-8 border border-primary-100/50 dark:border-primary-800/30">
          <Sparkles className="w-4 h-4" />
          <span>AI 기반 맞춤형 학습 플래너</span>
        </motion.div>
        <motion.h1 variants={riseIn} className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          목표 달성을 위한 <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-600 dark:from-primary-400 dark:to-violet-400">
            스마트한 몰입의 시작
          </span>
        </motion.h1>
        <motion.p variants={riseIn} className="text-lg sm:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mb-10 leading-relaxed">
          FocusFlow_AI는 당신의 목표와 일정을 분석하여 최적의 학습 계획을 자동으로 생성합니다. 
          더 이상 계획을 세우는 데 시간을 낭비하지 마세요.
        </motion.p>
        <motion.button
          variants={riseIn}
          {...pressable}
          onClick={onStart}
          className="group flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-4 rounded-full text-lg font-bold transition-colors duration-200 shadow-xl shadow-zinc-900/10 dark:shadow-white/10"
        >
          무료로 시작하기
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </motion.section>

      {/* Features Section */}
      <section className="py-20 px-6 sm:px-12 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              모든 것을 한 곳에서
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              성공적인 학습을 위해 필요한 모든 도구를 제공합니다.
            </p>
          </div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={staggerParent(STAGGER.card)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            <FeatureCard
              icon={<Sparkles className="w-6 h-6 text-violet-500" />}
              title="AI 자동 계획"
              description="목표와 남은 기간을 입력하면 AI가 최적의 일일 학습 계획을 생성합니다."
            />
            <FeatureCard
              icon={<Calendar className="w-6 h-6 text-blue-500" />}
              title="스마트 캘린더"
              description="생성된 계획을 캘린더 뷰로 한눈에 확인하고 쉽게 수정할 수 있습니다."
            />
            <FeatureCard
              icon={<LayoutGrid className="w-6 h-6 text-emerald-500" />}
              title="칸반 보드"
              description="할 일, 진행 중, 완료 상태로 학습 진행도를 직관적으로 관리하세요."
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6 text-amber-500" />}
              title="학습 통계"
              description="과목별 학습 시간과 달성률을 분석하여 학습 패턴을 개선하세요."
            />
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <p>© 2026 FocusFlow_AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <motion.div
      variants={riseIn}
      whileHover={{ y: -6, transition: { duration: DURATION.fast, ease: EASE_OUT } }}
      className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
