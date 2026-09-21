import { addDays, format, getDay } from 'date-fns';
import { StudyEvent } from '../types';
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

export function generateRuleBasedEvents(
  dday: number,
  startDateStr: string,
  goals: string[],
  goalImportance: Record<string, number>,
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
      
      // Generate basic task
      let task = '';
      if (phase === '기초') task = `${subject} 핵심 개념 정리 및 이론 학습`;
      else if (phase === '심화') task = `${subject} 기출문제 풀이 및 오답 노트`;
      else if (phase === '마무리') task = `${subject} 실전 모의고사 및 최종 점검`;
      
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
  }
  
  return events;
}
