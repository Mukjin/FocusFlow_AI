import { addDays, format, getDay } from 'date-fns';
import { StudyEvent, GoalKind } from '../types';
import { formatMinutesToDuration } from './duration';

function parseTimeToMinutes(timeStr: string): number {
  if (timeStr === '5시간+') return 300;
  const match = timeStr.match(/([\d.]+)(시간|분)/);
  if (!match) return 60;
  const val = parseFloat(match[1]);
  return match[2] === '시간' ? val * 60 : val;
}

function getStartTimeMinutes(prefTime: string): number {
  switch(prefTime) {
    case '아침': return 7 * 60; // 07:00
    case '오전': return 9 * 60; // 09:00
    case '오후': return 13 * 60; // 13:00
    case '저녁': return 19 * 60; // 19:00
    case '혼합': return 10 * 60; // 10:00
    default: return 9 * 60;
  }
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const TASK_TEMPLATES: Record<GoalKind, Record<'기초' | '심화' | '마무리', (subject: string) => string>> = {
  exam: {
    기초: (s) => `${s} 핵심 개념 정리 및 이론 학습`,
    심화: (s) => `${s} 기출문제 풀이 및 오답 노트`,
    마무리: (s) => `${s} 실전 모의고사 및 최종 점검`,
  },
  language: {
    기초: (s) => `${s} 기본 어휘·문법 다지기`,
    심화: (s) => `${s} 실전 문제 풀이 및 오답 분석`,
    마무리: (s) => `${s} 실전 모의고사 및 취약 파트 보완`,
  },
  reading: {
    기초: (s) => `${s} 읽기 — 배경 파악하며 정독`,
    심화: (s) => `${s} 읽기 — 핵심 문장 발췌 및 메모`,
    마무리: (s) => `${s} 완독 마무리 — 서평·요약 정리`,
  },
};

/** 복습 간격(일). 한 번 배운 내용을 잊기 전에 다시 꺼내보게 한다. */
const REVIEW_INTERVAL_DAYS = 7;

export function generateRuleBasedEvents(
  dday: number,
  startDateStr: string,
  goals: string[],
  goalImportance: Record<string, number>,
  goalKinds: Record<string, GoalKind>,
  timePerDay: string,
  restDay: string,
  prefTime: string
): Omit<StudyEvent, 'id'>[] {
  if (goals.length === 0) return [];

  const events: Omit<StudyEvent, 'id'>[] = [];
  const startDate = new Date(startDateStr);
  
  const baseMinutes = parseTimeToMinutes(timePerDay);
  const totalWeight = goals.reduce((sum, g) => sum + (goalImportance[g] || 2), 0);
  
  for (let i = 0; i < dday; i++) {
    const currentDate = addDays(startDate, i);
    const dayOfWeek = getDay(currentDate); // 0: Sun, 6: Sat
    
    // Check rest days
    if (restDay === '토요일' && dayOfWeek === 6) continue;
    if (restDay === '일요일' && dayOfWeek === 0) continue;
    if (restDay === '토일' && (dayOfWeek === 0 || dayOfWeek === 6)) continue;
    
    // Determine phase
    const progress = i / dday;
    let phase: '기초' | '심화' | '마무리' = '기초';
    if (progress >= 0.75) phase = '마무리';
    else if (progress >= 0.4) phase = '심화';
    
    // Determine duration per goal
    const dailyMinutes = dayOfWeek === 6 ? baseMinutes * 1.5 : baseMinutes;
    
    let currentDayMinutes = getStartTimeMinutes(prefTime);
    let remainingDailyMinutes = dailyMinutes;
    
    // Add an event for EACH goal on this day
    for (let j = 0; j < goals.length; j++) {
      const subject = goals[j];
      const weight = goalImportance[subject] || 2;
      
      let minutesPerGoal = 0;
      if (j === goals.length - 1) {
        minutesPerGoal = remainingDailyMinutes;
      } else {
        // Round to nearest 5 minutes
        minutesPerGoal = Math.round((dailyMinutes * (weight / totalWeight)) / 5) * 5;
        remainingDailyMinutes -= minutesPerGoal;
      }
      
      const durationStr = formatMinutesToDuration(minutesPerGoal);
      const startTime = formatTime(currentDayMinutes);
      const endTime = formatTime(currentDayMinutes + minutesPerGoal);
      currentDayMinutes += minutesPerGoal;
      
      const kind: GoalKind = goalKinds[subject] || 'exam';
      const task = TASK_TEMPLATES[kind][phase](subject);
      
      events.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        startTime,
        endTime,
        subject,
        task,
        duration: durationStr,
        phase,
        colorIndex: j,
        aiEnhanced: false,
        completed: false
      });
    }

    // 7일마다 그 주에 배운 내용을 다시 꺼내보는 복습 일정을 자동으로 끼워 넣는다.
    // 계획을 세워주는 데서 끝내지 않고, 배운 것이 남도록 되짚어주는 역할.
    const isReviewDay = i > 0 && (i + 1) % REVIEW_INTERVAL_DAYS === 0;
    if (isReviewDay) {
      const weekNumber = Math.floor(i / REVIEW_INTERVAL_DAYS) + 1;
      const reviewMinutes = Math.max(20, Math.round((dailyMinutes * 0.25) / 5) * 5);
      const reviewStart = currentDayMinutes;

      events.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        startTime: formatTime(reviewStart),
        endTime: formatTime(reviewStart + reviewMinutes),
        subject: goals.length === 1 ? goals[0] : '전체 복습',
        task: `${weekNumber}주차 복습 — 이번 주에 공부한 내용 다시 훑고 헷갈린 부분만 표시하기`,
        duration: formatMinutesToDuration(reviewMinutes),
        phase,
        colorIndex: goals.length,
        aiEnhanced: false,
        completed: false,
        isReview: true,
      });
    }
  }

  return events;
}
