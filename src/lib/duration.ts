/**
 * 소요 시간은 "2시간", "1시간 30분", "45분", "1.5시간" 같은 문자열로 저장된다.
 * 파싱을 화면마다 따로 구현했더니 통계 화면만 소수점을 놓쳐
 * "1.5시간"을 300분으로 집계하는 버그가 있었다. 한 곳에서만 다룬다.
 */

export function parseDurationToMinutes(durationStr: string): number {
  if (!durationStr) return 0;

  let minutes = 0;
  // 소수점을 포함해 매칭해야 "1.5시간"에서 "5시간"을 잡는 일이 없다
  const hourMatch = durationStr.match(/([\d.]+)\s*시간/);
  const minuteMatch = durationStr.match(/([\d.]+)\s*분/);

  if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
  if (minuteMatch) minutes += parseFloat(minuteMatch[1]);

  return Number.isFinite(minutes) ? Math.round(minutes) : 0;
}

export function formatMinutesToDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/** 통계 카드용 — 분 단위를 시/분으로 쪼갠다 */
export function splitHoursMinutes(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
