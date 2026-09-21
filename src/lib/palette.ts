/**
 * 과목 식별 색.
 *
 * 색은 '누구의 것인가'만 나타낸다. 글자는 절대 이 색을 입지 않고
 * 본문 잉크 색을 쓰며, 색은 옆의 작은 마크(점·막대)만 담당한다.
 * 그래야 색각이상·저대비 환경에서도 과목이 글자로 먼저 읽힌다.
 *
 * 순서는 고정이며 순환시키지 않는다. 8개를 넘어가면 색을 새로
 * 만들지 말고 마지막 슬롯을 공유한다.
 */
export const SERIES_COUNT = 8;

export function seriesColor(index: number): string {
  const slot = Math.min(Math.max(index, 0), SERIES_COUNT - 1) + 1;
  return `var(--series-${slot})`;
}

/** 아주 옅은 배경 틴트 — 면이 아니라 '기미' 정도로만 쓴다 */
export function seriesTint(index: number, alpha = 0.1): string {
  return `color-mix(in srgb, ${seriesColor(index)} ${Math.round(alpha * 100)}%, transparent)`;
}
