import { describe, it, expect } from 'vitest';
import { generateRuleBasedEvents } from '../ruleEngine';
import { parseDurationToMinutes } from '../duration';
import type { GoalKind } from '../../types';

const START = '2026-09-21'; // 월요일
const kinds = (g: string[], k: GoalKind) => Object.fromEntries(g.map((x) => [x, k]));
const imp = (g: string[], v = 2) => Object.fromEntries(g.map((x) => [x, v]));

describe('generateRuleBasedEvents', () => {
  it('목표가 없으면 아무것도 만들지 않는다', () => {
    expect(generateRuleBasedEvents(30, START, [], {}, {}, '2시간', '없음', '저녁')).toEqual([]);
  });

  it('과목 수 × 학습일 수만큼 일정을 만든다 (복습 제외)', () => {
    const goals = ['토익', '정보처리기사'];
    const ev = generateRuleBasedEvents(14, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '저녁');
    expect(ev.filter((e) => !e.isReview)).toHaveLength(14 * 2);
  });

  it('쉬는 요일은 제외한다', () => {
    const goals = ['토익'];
    const all = generateRuleBasedEvents(14, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '저녁');
    const restSun = generateRuleBasedEvents(14, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '일요일', '저녁');
    expect(restSun.length).toBeLessThan(all.length);
    const sundays = restSun.filter((e) => new Date(`${e.date}T00:00:00`).getDay() === 0);
    expect(sundays).toHaveLength(0);
  });

  it('하루 배분 합이 가용 시간과 정확히 일치한다', () => {
    const goals = ['A', 'B', 'C'];
    const ev = generateRuleBasedEvents(7, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '저녁');
    const byDate = new Map<string, number>();
    ev.filter((e) => !e.isReview).forEach((e) => {
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + parseDurationToMinutes(e.duration));
    });
    for (const [date, total] of byDate) {
      const isSat = new Date(`${date}T00:00:00`).getDay() === 6;
      expect(total).toBe(isSat ? 180 : 120); // 토요일은 1.5배
    }
  });

  it('중요도가 높은 과목에 더 많은 시간을 준다', () => {
    const goals = ['많이', '적게'];
    const ev = generateRuleBasedEvents(1, START, goals, { 많이: 3, 적게: 1 }, kinds(goals, 'exam'), '4시간', '없음', '저녁');
    const big = parseDurationToMinutes(ev.find((e) => e.subject === '많이')!.duration);
    const small = parseDurationToMinutes(ev.find((e) => e.subject === '적게')!.duration);
    expect(big).toBeGreaterThan(small);
  });

  it('진행률에 따라 기초 → 심화 → 마무리로 넘어간다', () => {
    const goals = ['토익'];
    const ev = generateRuleBasedEvents(20, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '저녁')
      .filter((e) => !e.isReview);
    expect(ev[0].phase).toBe('기초');
    expect(ev[ev.length - 1].phase).toBe('마무리');
    const phases = [...new Set(ev.map((e) => e.phase))];
    expect(phases).toEqual(['기초', '심화', '마무리']); // 순서가 뒤집히지 않는다
  });

  it('독서 목표에는 시험용 문구를 쓰지 않는다', () => {
    const goals = ['고전 읽기'];
    const ev = generateRuleBasedEvents(10, START, goals, imp(goals), kinds(goals, 'reading'), '1시간', '없음', '저녁')
      .filter((e) => !e.isReview);
    expect(ev.some((e) => /기출문제|모의고사/.test(e.task))).toBe(false);
    expect(ev.some((e) => /읽기|완독/.test(e.task))).toBe(true);
  });

  it('7일마다 복습 일정을 끼워 넣는다', () => {
    const goals = ['토익'];
    const ev = generateRuleBasedEvents(30, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '저녁');
    const reviews = ev.filter((e) => e.isReview);
    expect(reviews.length).toBe(4); // 7·14·21·28일차
    reviews.forEach((r) => expect(r.task).toMatch(/주차 복습/));
  });

  it('선호 시간대가 시작 시각을 결정한다', () => {
    const goals = ['토익'];
    const morning = generateRuleBasedEvents(1, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '아침');
    const evening = generateRuleBasedEvents(1, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '저녁');
    expect(morning[0].startTime).toBe('07:00');
    expect(evening[0].startTime).toBe('19:00');
  });

  it('생성 직후에는 완료도 AI 표시도 없다', () => {
    const goals = ['토익'];
    const ev = generateRuleBasedEvents(5, START, goals, imp(goals), kinds(goals, 'exam'), '2시간', '없음', '저녁');
    expect(ev.every((e) => e.completed === false)).toBe(true);
    expect(ev.every((e) => e.aiEnhanced === false)).toBe(true);
  });
});
