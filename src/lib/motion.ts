import type { Transition, Variants } from 'motion/react';

/**
 * 앱 전체가 하나의 모션 시스템으로 움직이도록 토큰을 한곳에 모은다.
 * 컴포넌트마다 duration/easing을 따로 정하면 화면 전환마다 속도감이 달라져
 * 완성도가 떨어져 보이기 때문에, 여기서만 값을 바꾼다.
 */

export const DURATION = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
} as const;

/** 진입: 빠르게 나왔다가 부드럽게 멈춘다 (easeOutQuint 계열) */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** 이동·변형: 시작과 끝이 모두 부드럽다 */
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const SPRING: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

/** 촘촘한 목록(캘린더 칩 등)은 간격을 짧게, 카드는 길게 */
export const STAGGER = {
  dense: 0.012,
  card: 0.06,
} as const;

/** 아래에서 떠오르며 나타나기 — 카드·섹션 기본값 */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

/** 살짝 커지며 나타나기 — 캘린더 일정 칩처럼 작은 요소 */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 6 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

/** 자식들을 순차적으로 등장시키는 컨테이너 */
export const staggerParent = (stagger: number = STAGGER.card, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

/** 탭 전환 */
export const tabTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
};

/** 버튼 공통 인터랙션 */
export const pressable = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: SPRING,
} as const;
