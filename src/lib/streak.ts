import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { StudyEvent } from '../types';

/**
 * "계획을 세웠다"와 "실제로 했다"는 다르다.
 * 완료를 누른 시각(completedAt)만 근거로 삼아, 며칠을 이어서 했는지 계산한다.
 * 계획된 날짜(date)가 아니라 실제 체크한 날 기준이어야 진짜 기록이 된다.
 */

/** 완료 체크가 실제로 일어난 날짜들(YYYY-MM-DD), 중복 없이 */
export function getActiveDays(events: StudyEvent[]): Set<string> {
  const days = new Set<string>();
  events.forEach((e) => {
    if (e.completed && e.completedAt) {
      days.add(format(parseISO(e.completedAt), 'yyyy-MM-dd'));
    }
  });
  return days;
}

/**
 * 연속 학습일.
 * 오늘 아직 안 했더라도 어제까지 이어졌다면 연속은 살아있는 것으로 본다
 * (하루가 끝나기 전에 스트릭이 0으로 보이면 오히려 의욕을 꺾는다).
 */
export function getCurrentStreak(events: StudyEvent[], today: Date = new Date()): number {
  const days = getActiveDays(events);
  if (days.size === 0) return 0;

  const todayKey = format(today, 'yyyy-MM-dd');
  const yesterdayKey = format(subDays(today, 1), 'yyyy-MM-dd');

  let cursor: Date;
  if (days.has(todayKey)) cursor = today;
  else if (days.has(yesterdayKey)) cursor = subDays(today, 1);
  else return 0;

  let streak = 0;
  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** 역대 최장 연속 학습일 */
export function getLongestStreak(events: StudyEvent[]): number {
  const days = [...getActiveDays(events)].sort();
  if (days.length === 0) return 0;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const gap = differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1]));
    run = gap === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

export interface DayActivity {
  date: string;
  label: string;
  count: number;
  isToday: boolean;
}

/** 최근 N일 활동량 — 통계 화면의 막대 그래프용 */
export function getRecentActivity(
  events: StudyEvent[],
  days = 14,
  today: Date = new Date(),
): DayActivity[] {
  const counts = new Map<string, number>();
  events.forEach((e) => {
    if (e.completed && e.completedAt) {
      const key = format(parseISO(e.completedAt), 'yyyy-MM-dd');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });

  const out: DayActivity[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = subDays(today, i);
    const key = format(d, 'yyyy-MM-dd');
    out.push({
      date: key,
      label: format(d, 'd'),
      count: counts.get(key) || 0,
      isToday: i === 0,
    });
  }
  return out;
}
