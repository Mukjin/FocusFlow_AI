import { describe, it, expect } from 'vitest';
import { findOverdue, rollOverdueToToday } from '../rollover';
import type { StudyEvent } from '../../types';

const TODAY = new Date('2026-09-22T09:00:00');
const ev = (date: string, completed = false, id = Math.random()): StudyEvent => ({
  id, date, subject: 'x', task: 'x', duration: '1시간',
  phase: '기초', colorIndex: 0, completed,
});

describe('findOverdue', () => {
  it('지난 날짜의 미완료만 고른다', () => {
    const list = [ev('2026-09-20'), ev('2026-09-21'), ev('2026-09-22'), ev('2026-09-23')];
    expect(findOverdue(list, TODAY)).toHaveLength(2);
  });

  it('이미 완료한 것은 밀린 것이 아니다', () => {
    expect(findOverdue([ev('2026-09-20', true)], TODAY)).toHaveLength(0);
  });

  it('오늘 것은 아직 밀린 것이 아니다', () => {
    expect(findOverdue([ev('2026-09-22')], TODAY)).toHaveLength(0);
  });
});

describe('rollOverdueToToday', () => {
  it('밀린 일정만 오늘로 옮긴다', () => {
    const list = [ev('2026-09-20'), ev('2026-09-25'), ev('2026-09-19', true)];
    const out = rollOverdueToToday(list, TODAY);
    expect(out[0].date).toBe('2026-09-22'); // 옮겨짐
    expect(out[1].date).toBe('2026-09-25'); // 미래는 그대로
    expect(out[2].date).toBe('2026-09-19'); // 완료된 것은 그대로
  });

  it('일정 개수는 변하지 않는다', () => {
    const list = [ev('2026-09-18'), ev('2026-09-19'), ev('2026-09-30')];
    expect(rollOverdueToToday(list, TODAY)).toHaveLength(3);
  });

  it('옮길 것이 없으면 원래 배열을 그대로 돌려준다', () => {
    const list = [ev('2026-09-25')];
    expect(rollOverdueToToday(list, TODAY)).toBe(list);
  });
});
