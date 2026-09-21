import { useMemo } from 'react';
import { motion } from 'motion/react';
import { usePlannerStore } from '../store/plannerStore';
import { CountUp, AnimatedBar } from './motion/Primitives';
import { riseIn, staggerParent, STAGGER, DURATION, EASE_OUT } from '../lib/motion';
import { parseDurationToMinutes } from '../lib/duration';
import { getCurrentStreak, getLongestStreak, getRecentActivity } from '../lib/streak';
import { CheckCircle2, Clock, Target, TrendingUp, BookOpen, Calendar as CalendarIcon, Award, Flame, Repeat } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';

export default function DashboardView() {
  const store = usePlannerStore();
  const events = store.events;

  const totalEvents = events.length;
  const completedEvents = events.filter(e => e.completed).length;
  const completionRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

  const totalDurationMinutes = events.reduce((acc, e) => acc + parseDurationToMinutes(e.duration), 0);
  const completedDurationMinutes = events.filter(e => e.completed).reduce((acc, e) => acc + parseDurationToMinutes(e.duration), 0);

  const subjectStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; duration: number }> = {};
    events.forEach(e => {
      if (!stats[e.subject]) {
        stats[e.subject] = { total: 0, completed: 0, duration: 0 };
      }
      stats[e.subject].total += 1;
      if (e.completed) {
        stats[e.subject].completed += 1;
      }
      stats[e.subject].duration += parseDurationToMinutes(e.duration);
    });
    return Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
  }, [events]);

  const todayEvents = useMemo(() => {
    const today = new Date();
    return events.filter(e => isSameDay(parseISO(e.date), today));
  }, [events]);

  // 실제로 완료를 누른 기록만 근거로 삼는다 (계획된 날짜가 아니라)
  const streak = useMemo(() => getCurrentStreak(events), [events]);
  const longestStreak = useMemo(() => getLongestStreak(events), [events]);
  const recentActivity = useMemo(() => getRecentActivity(events, 14), [events]);
  const maxActivity = Math.max(1, ...recentActivity.map(d => d.count));
  const reviewCount = events.filter(e => e.isReview).length;

  const todayCompleted = todayEvents.filter(e => e.completed).length;
  const todayRate = todayEvents.length > 0 ? Math.round((todayCompleted / todayEvents.length) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
      {/* Overview Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        variants={staggerParent(STAGGER.card)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={riseIn} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary-50 dark:bg-primary-900/20 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 rounded-2xl">
                <Target className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-medium text-zinc-500 dark:text-zinc-400 mb-1">총 학습 목표</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight"><CountUp value={totalEvents} /></p>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">개</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={riseIn} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-medium text-zinc-500 dark:text-zinc-400 mb-1">완료한 학습</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight"><CountUp value={completedEvents} /></p>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">개</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={riseIn} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-medium text-zinc-500 dark:text-zinc-400 mb-1">전체 달성률</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight"><CountUp value={completionRate} /></p>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">%</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={riseIn} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <h3 className="font-medium text-zinc-500 dark:text-zinc-400 mb-1">총 학습 시간</h3>
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight"><CountUp value={Math.floor(completedDurationMinutes / 60)} /></p>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mr-1">시간</span>
              <p className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight"><CountUp value={completedDurationMinutes % 60} /></p>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">분</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Award className="w-6 h-6 text-primary-500" />
                오늘의 학습 현황
              </h2>
              <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full text-sm font-bold">
                {todayRate}% 달성
              </span>
            </div>
            
            <div className="mb-8">
              <div className="flex justify-between text-sm font-medium mb-3">
                <span className="text-zinc-500 dark:text-zinc-400">진행률</span>
                <span className="text-zinc-900 dark:text-white">{todayCompleted} / {todayEvents.length} 완료</span>
              </div>
              <AnimatedBar
                percent={todayRate}
                trackClassName="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"
                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
                  <CalendarIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">오늘의 일정</span>
                </div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white"><CountUp value={todayEvents.length} duration={0.8} />개</p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">남은 일정</span>
                </div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white"><CountUp value={todayEvents.length - todayCompleted} duration={0.8} />개</p>
              </div>
            </div>
          </div>

          {/* 연속 학습일 — '계획'이 아니라 '실제로 한 기록'을 보여주는 자리 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.1 }}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                연속 학습일
              </h2>
              {reviewCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 border border-violet-100 dark:border-violet-800/50">
                  <Repeat className="w-3.5 h-3.5" />
                  복습 {reviewCount}회 자동 배치됨
                </span>
              )}
            </div>

            <div className="flex items-end gap-8 mb-8">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    <CountUp value={streak} duration={1.2} />
                  </span>
                  <span className="text-lg font-medium text-zinc-500 dark:text-zinc-400">일째</span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {streak > 0 ? '이어서 하고 있어요' : '오늘 하나만 체크하면 시작됩니다'}
                </p>
              </div>
              <div className="pb-1">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">최장 기록</p>
                <p className="text-xl font-bold text-zinc-700 dark:text-zinc-300">{longestStreak}일</p>
              </div>
            </div>

            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-3 uppercase tracking-wider">
              최근 14일
            </p>
            <div className="flex items-end gap-1.5 h-20">
              {recentActivity.map((day, i) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <motion.div
                    className={`w-full rounded-md ${
                      day.count > 0
                        ? 'bg-orange-400 dark:bg-orange-500'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    } ${day.isToday ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''}`}
                    initial={{ height: 0 }}
                    animate={{ height: day.count > 0 ? `${Math.max(18, (day.count / maxActivity) * 100)}%` : '6px' }}
                    transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.2 + i * 0.03 }}
                    title={`${day.date} · ${day.count}개 완료`}
                  />
                  <span className={`text-[10px] ${day.isToday ? 'font-bold text-primary-600 dark:text-primary-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Subject Breakdown */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-6">
              <BookOpen className="w-6 h-6 text-emerald-500" />
              과목별 학습 통계
            </h2>
            <div className="space-y-5">
              {subjectStats.map(([subject, stats], i) => {
                const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                return (
                  <motion.div
                    key={subject}
                    className="group"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.15 + i * STAGGER.card }}
                  >
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <h4 className="font-bold text-zinc-800 dark:text-zinc-200">{subject}</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          총 {Math.floor(stats.duration / 60)}시간 {stats.duration % 60}분
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{rate}%</span>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {stats.completed} / {stats.total} 완료
                        </p>
                      </div>
                    </div>
                    <AnimatedBar
                      percent={rate}
                      delay={0.25 + i * STAGGER.card}
                      trackClassName="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"
                      className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full group-hover:brightness-110"
                    />
                  </motion.div>
                );
              })}
              {subjectStats.length === 0 && (
                <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
                  등록된 학습 일정이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Recent Activity or Summary */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-500 to-purple-600 p-8 rounded-3xl text-white shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-8 -mb-8"></div>
            
            <div className="relative z-10">
              <h3 className="text-lg font-medium text-primary-100 mb-1">전체 진행 상황</h3>
              <div className="flex items-end gap-2 mb-6">
                <span className="text-5xl font-bold tracking-tight"><CountUp value={completionRate} duration={1.4} /></span>
                <span className="text-xl font-medium text-primary-200 mb-1">%</span>
              </div>
              
              <div className="space-y-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="text-primary-100 text-sm mb-1">총 계획된 시간</div>
                  <div className="font-bold text-xl">
                    {Math.floor(totalDurationMinutes / 60)}시간 {totalDurationMinutes % 60}분
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <div className="text-primary-100 text-sm mb-1">실제 학습 시간</div>
                  <div className="font-bold text-xl">
                    {Math.floor(completedDurationMinutes / 60)}시간 {completedDurationMinutes % 60}분
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
