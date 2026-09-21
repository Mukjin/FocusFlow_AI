import { useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { usePlannerStore } from '../store/plannerStore';
import { CountUp, AnimatedBar } from './motion/Primitives';
import { riseIn, staggerParent, STAGGER, DURATION, EASE_OUT } from '../lib/motion';
import { parseDurationToMinutes, splitHoursMinutes } from '../lib/duration';
import { seriesColor } from '../lib/palette';
import { getCurrentStreak, getLongestStreak, getRecentActivity } from '../lib/streak';
import { CheckCircle2, Clock, Target, TrendingUp, Flame, Repeat, Inbox, Brain } from 'lucide-react';
import { parseISO, isSameDay } from 'date-fns';

/* 카드 표면 — 화면 전체가 하나의 재질로 읽히도록 한 곳에서만 정의한다 */
const CARD =
  'bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/70 dark:border-white/[0.07]';

/**
 * 숫자 하나를 크게 보여주는 타일.
 * 장식을 넣지 않는다 — 배경 블러나 색 아이콘 타일은 데이터 의미가 없는 노이즈라
 * 정작 읽어야 할 숫자의 무게를 깎는다. 아이콘은 한 가지 흐린 잉크 색으로 통일한다.
 */
function StatTile({
  icon, label, children, sub,
}: { icon: ReactNode; label: string; children: ReactNode; sub?: string }) {
  return (
    <motion.div variants={riseIn} className={`${CARD} p-5`}>
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-3">
        <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 text-zinc-900 dark:text-white">{children}</div>
      {sub && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">{sub}</p>}
    </motion.div>
  );
}

const NUM = 'text-[34px] font-bold tracking-tight tabular-nums leading-none';
const UNIT = 'text-sm font-medium text-zinc-400 dark:text-zinc-500';
const CARD_TITLE =
  'text-[15px] font-bold text-zinc-900 dark:text-white flex items-center gap-2 [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:text-zinc-400';

export default function DashboardView() {
  const store = usePlannerStore();
  const events = store.events;

  const totalEvents = events.length;
  const completedEvents = events.filter(e => e.completed).length;
  const completionRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

  const totalDurationMinutes = events.reduce((acc, e) => acc + parseDurationToMinutes(e.duration), 0);
  const completedDurationMinutes = events
    .filter(e => e.completed)
    .reduce((acc, e) => acc + parseDurationToMinutes(e.duration), 0);
  const done = splitHoursMinutes(completedDurationMinutes);
  const focus = splitHoursMinutes(store.focusMinutes);
  const planned = splitHoursMinutes(totalDurationMinutes);

  // 과목 식별 색을 같이 들고 다녀야 점과 이름이 항상 짝이 맞는다
  const subjectStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; duration: number; colorIndex: number; isReview: boolean }> = {};
    events.forEach(e => {
      if (!stats[e.subject]) {
        stats[e.subject] = { total: 0, completed: 0, duration: 0, colorIndex: e.colorIndex, isReview: !!e.isReview };
      }
      if (!e.isReview) stats[e.subject].isReview = false;
      stats[e.subject].total += 1;
      if (e.completed) stats[e.subject].completed += 1;
      stats[e.subject].duration += parseDurationToMinutes(e.duration);
    });
    return Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
  }, [events]);

  const todayEvents = useMemo(
    () => events.filter(e => isSameDay(parseISO(e.date), new Date())),
    [events],
  );
  const todayCompleted = todayEvents.filter(e => e.completed).length;
  const todayRate = todayEvents.length > 0 ? Math.round((todayCompleted / todayEvents.length) * 100) : 0;

  const streak = useMemo(() => getCurrentStreak(events), [events]);
  const longestStreak = useMemo(() => getLongestStreak(events), [events]);
  const recentActivity = useMemo(() => getRecentActivity(events, 14), [events]);
  const maxActivity = Math.max(1, ...recentActivity.map(d => d.count));
  const reviewCount = events.filter(e => e.isReview).length;

  if (totalEvents === 0) {
    return (
      <div className="h-full m-6 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
        <Inbox className="w-12 h-12 mb-4 text-zinc-300 dark:text-zinc-700" />
        <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300 mb-1">아직 기록할 학습이 없습니다</p>
        <p className="text-sm">플랜 설정에서 일정을 먼저 만들어주세요.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-5">

      {/* ── 숫자 타일 4개 ─────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
        variants={staggerParent(STAGGER.card)}
        initial="hidden"
        animate="show"
      >
        <StatTile icon={<Target />} label="전체 일정" sub={reviewCount > 0 ? `복습 ${reviewCount}회 포함` : undefined}>
          <span className={NUM}><CountUp value={totalEvents} /></span><span className={UNIT}>개</span>
        </StatTile>

        <StatTile icon={<CheckCircle2 />} label="완료" sub={`남은 ${totalEvents - completedEvents}개`}>
          <span className={NUM}><CountUp value={completedEvents} /></span><span className={UNIT}>개</span>
        </StatTile>

        <StatTile icon={<TrendingUp />} label="달성률">
          <span className={NUM}><CountUp value={completionRate} /></span><span className={UNIT}>%</span>
        </StatTile>

        <StatTile
          icon={<Clock />}
          label="완료한 분량"
          sub={`계획 ${planned.hours}시간 ${planned.minutes}분 중`}
        >
          <span className={NUM}><CountUp value={done.hours} /></span><span className={UNIT}>시간</span>
          <span className={`${NUM} ml-1`}><CountUp value={done.minutes} /></span><span className={UNIT}>분</span>
        </StatTile>

        {/* 위 타일은 '체크한 일정의 계획 시간 합'이고, 이건 뽀모도로로 실제 앉아 있던 시간이다 */}
        <StatTile
          icon={<Brain />}
          label="실제 집중 시간"
          sub={store.focusMinutes > 0 ? '뽀모도로 실측' : '뽀모도로를 완주하면 쌓입니다'}
        >
          <span className={NUM}><CountUp value={focus.hours} /></span><span className={UNIT}>시간</span>
          <span className={`${NUM} ml-1`}><CountUp value={focus.minutes} /></span><span className={UNIT}>분</span>
        </StatTile>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── 연속 학습일 + 최근 14일 ────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.08 }}
          className={`${CARD} lg:col-span-2 p-6`}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className={CARD_TITLE}><Flame />연속 학습일</h2>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-[52px] font-bold tracking-tight tabular-nums leading-none text-zinc-900 dark:text-white">
                  <CountUp value={streak} duration={1.2} />
                </span>
                <span className="text-base font-medium text-zinc-400 dark:text-zinc-500">일째</span>
              </div>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
                {streak > 0 ? '오늘도 이어가고 있어요' : '오늘 하나만 체크하면 시작됩니다'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">최장 기록</p>
              <p className="text-lg font-bold tabular-nums text-zinc-700 dark:text-zinc-300">{longestStreak}일</p>
            </div>
          </div>

          <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-2.5">최근 14일 완료 기록</p>
          {/* 얇은 막대 · 바닥에 붙이고 위쪽만 둥글게 · 눈금선은 뒤로 물린다 */}
          <div className="relative flex items-end gap-1.5 h-24 pb-6">
            <div className="absolute left-0 right-0 bottom-6 h-px bg-zinc-200 dark:bg-white/10" />
            {recentActivity.map((day, i) => (
              <div key={day.date} className="relative flex-1 h-full flex flex-col justify-end items-center">
                <motion.div
                  className={`w-full rounded-t-[4px] ${
                    day.count > 0
                      ? 'bg-primary-500 dark:bg-primary-400'
                      : 'bg-zinc-200 dark:bg-white/[0.08]'
                  }`}
                  initial={{ height: 0 }}
                  animate={{ height: day.count > 0 ? `${Math.max(14, (day.count / maxActivity) * 100)}%` : '3px' }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.16 + i * 0.03 }}
                  title={`${day.date} · ${day.count}개 완료`}
                />
                <span className={`absolute -bottom-0 text-[10px] tabular-nums ${
                  day.isToday ? 'font-bold text-primary-600 dark:text-primary-400' : 'text-zinc-400 dark:text-zinc-600'
                }`}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── 오늘 ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.14 }}
          className={`${CARD} p-6 flex flex-col`}
        >
          <h2 className={CARD_TITLE}><CheckCircle2 />오늘</h2>

          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-[52px] font-bold tracking-tight tabular-nums leading-none text-zinc-900 dark:text-white">
              <CountUp value={todayRate} duration={1.2} />
            </span>
            <span className="text-base font-medium text-zinc-400 dark:text-zinc-500">%</span>
          </div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2 mb-5">
            {todayEvents.length > 0
              ? `${todayEvents.length}개 중 ${todayCompleted}개 완료`
              : '오늘 예정된 일정이 없습니다'}
          </p>

          <AnimatedBar
            percent={todayRate}
            delay={0.25}
            trackClassName="h-2 bg-zinc-100 dark:bg-white/[0.07] rounded-full overflow-hidden"
            className="h-full bg-primary-500 dark:bg-primary-400 rounded-full"
          />

          <div className="mt-auto pt-6 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{todayEvents.length}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">오늘 일정</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{todayEvents.length - todayCompleted}</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">남은 일정</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── 과목별 ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.2 }}
        className={`${CARD} p-6`}
      >
        <h2 className={`${CARD_TITLE} mb-6`}><Repeat />과목별 진행</h2>

        <div className="space-y-5">
          {subjectStats.map(([subject, stat], i) => {
            const rate = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
            const d = splitHoursMinutes(stat.duration);
            return (
              <div key={subject}>
                <div className="flex items-end justify-between gap-4 mb-2">
                  {/* 색은 점이 맡고, 이름과 숫자는 본문 잉크 색을 쓴다 */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      aria-hidden
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: stat.isReview ? "var(--color-zinc-400)" : seriesColor(stat.colorIndex) }}
                    />
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">{subject}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                      {d.hours}시간 {d.minutes}분
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 flex-shrink-0">
                    <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{rate}%</span>
                    <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                      {stat.completed}/{stat.total}
                    </span>
                  </div>
                </div>
                <AnimatedBar
                  percent={rate}
                  delay={0.28 + i * STAGGER.card}
                  color={stat.isReview ? "var(--color-zinc-400)" : seriesColor(stat.colorIndex)}
                  trackClassName="h-1.5 bg-zinc-100 dark:bg-white/[0.07] rounded-full overflow-hidden"
                  className="h-full rounded-full"
                />
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
