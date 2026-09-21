import { describe, it, expect } from 'vitest';
import { getCurrentStreak, getLongestStreak, getRecentActivity, getActiveDays } from '../streak';
import type { StudyEvent } from '../../types';

const TODAY = new Date('2026-09-22T12:00:00');

/** n일 전에 완료한 일정 하나 */
const done = (daysAgo: number, id = daysAgo): StudyEvent => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysAgo);
  return {
    id, date: d.toISOString().split('T')[0], subject: 'x', task: 'x',
    duration: '1시간', phase: '기초', colorIndex: 0,
    completed: true, completedAt: d.toISOString(),
  };
};
const pending = (id: number): StudyEvent => ({
  id, date: '2026-09-22', subject: 'x', task: 'x',
  duration: '1시간', phase: '기초', colorIndex: 0, completed: false,
});

describe('getActiveDays', () => {
  it('완료 시각이 있는 날만 센다', () => {
    expect(getActiveDays([done(0), done(0, 99), pending(1)]).size).toBe(1);
  });

  // 계획된 날짜(date)가 아니라 실제 체크한 날(completedAt)이 근거여야 한다
  it('완료 표시가 있어도 시각이 없으면 세지 않는다', () => {
    const e = { ...done(0), completedAt: undefined };
    expect(getActiveDays([e]).size).toBe(0);
  });
});

describe('getCurrentStreak', () => {
  it('기록이 없으면 0', () => {
    expect(getCurrentStreak([], TODAY)).toBe(0);
  });

  it('오늘부터 이어진 날을 센다', () => {
    expect(getCurrentStreak([done(0), done(1), done(2)], TODAY)).toBe(3);
  });

  // 하루가 끝나기 전에 0으로 보이면 오히려 의욕을 꺾는다
  it('오늘 아직 안 했어도 어제까지 이어졌으면 유지한다', () => {
    expect(getCurrentStreak([done(1), done(2)], TODAY)).toBe(2);
  });

  it('이틀 이상 비면 끊긴다', () => {
    expect(getCurrentStreak([done(2), done(3)], TODAY)).toBe(0);
  });

  it('중간에 빈 날이 있으면 거기서 멈춘다', () => {
    expect(getCurrentStreak([done(0), done(1), done(3), done(4)], TODAY)).toBe(2);
  });

  it('같은 날 여러 개를 완료해도 하루로 센다', () => {
    expect(getCurrentStreak([done(0, 1), done(0, 2), done(0, 3)], TODAY)).toBe(1);
  });
});

describe('getLongestStreak', () => {
  it('가장 길게 이어진 구간을 찾는다', () => {
    // 10~14일 전 5일 연속 / 0~1일 전 2일 연속
    const ev = [10, 11, 12, 13, 14, 0, 1].map((d, i) => done(d, i));
    expect(getLongestStreak(ev)).toBe(5);
  });

  it('기록이 없으면 0', () => {
    expect(getLongestStreak([])).toBe(0);
  });
});

describe('getRecentActivity', () => {
  it('요청한 일수만큼 돌려주고 마지막이 오늘이다', () => {
    const a = getRecentActivity([done(0), done(0, 9), done(3)], 14, TODAY);
    expect(a).toHaveLength(14);
    expect(a[13].isToday).toBe(true);
    expect(a[13].count).toBe(2);
    expect(a[10].count).toBe(1); // 3일 전
    expect(a[0].count).toBe(0);
  });
});
