import { describe, it, expect } from 'vitest';
import { parseDurationToMinutes, formatMinutesToDuration, splitHoursMinutes } from '../duration';

describe('parseDurationToMinutes', () => {
  it('시간과 분을 함께 읽는다', () => {
    expect(parseDurationToMinutes('1시간 30분')).toBe(90);
    expect(parseDurationToMinutes('2시간')).toBe(120);
    expect(parseDurationToMinutes('45분')).toBe(45);
  });

  // 통계 화면만 /(\d+)시간/ 을 써서 "1.5시간"에서 "5시간"을 잡아 300분으로
  // 집계하던 버그가 있었다. 소수점을 반드시 함께 읽어야 한다.
  it('소수점 시간을 올바로 읽는다', () => {
    expect(parseDurationToMinutes('1.5시간')).toBe(90);
    expect(parseDurationToMinutes('0.5시간')).toBe(30);
    expect(parseDurationToMinutes('2.5시간')).toBe(150);
  });

  it('빈 값과 알 수 없는 형식은 0으로 둔다', () => {
    expect(parseDurationToMinutes('')).toBe(0);
    expect(parseDurationToMinutes('나중에')).toBe(0);
  });
});

describe('formatMinutesToDuration', () => {
  it('시/분을 사람이 읽는 형태로 만든다', () => {
    expect(formatMinutesToDuration(90)).toBe('1시간 30분');
    expect(formatMinutesToDuration(120)).toBe('2시간');
    expect(formatMinutesToDuration(45)).toBe('45분');
    expect(formatMinutesToDuration(0)).toBe('0분');
  });

  it('음수는 0으로 막는다', () => {
    expect(formatMinutesToDuration(-30)).toBe('0분');
  });

  it('파싱과 포맷이 서로를 되돌린다', () => {
    for (const m of [15, 45, 60, 90, 125, 300]) {
      expect(parseDurationToMinutes(formatMinutesToDuration(m))).toBe(m);
    }
  });
});

describe('splitHoursMinutes', () => {
  it('시와 분으로 쪼갠다', () => {
    expect(splitHoursMinutes(125)).toEqual({ hours: 2, minutes: 5 });
    expect(splitHoursMinutes(0)).toEqual({ hours: 0, minutes: 0 });
  });
});
