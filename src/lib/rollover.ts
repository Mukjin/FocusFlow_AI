import { format, parseISO, startOfDay } from 'date-fns';
import { StudyEvent } from '../types';

/**
 * 계획은 반드시 밀린다.
 * 지난 날짜에 남아 있는 미완료 일정을 오늘로 끌어와, 지나간 칸을 들여다보지
 * 않아도 오늘 할 일이 한자리에 모이게 한다. 일정 개수는 변하지 않는다.
 */

export function findOverdue(events: StudyEvent[], today: Date = new Date()): StudyEvent[] {
  const todayStart = startOfDay(today);
  return events.filter(
    (e) => !e.completed && startOfDay(parseISO(e.date)).getTime() < todayStart.getTime(),
  );
}

export function rollOverdueToToday(events: StudyEvent[], today: Date = new Date()): StudyEvent[] {
  const todayKey = format(today, 'yyyy-MM-dd');
  const overdue = new Set(findOverdue(events, today).map((e) => e.id));
  if (overdue.size === 0) return events; // 바뀐 게 없으면 참조를 유지해 불필요한 렌더를 막는다

  return events.map((e) => (overdue.has(e.id) ? { ...e, date: todayKey } : e));
}
