import { useEffect, useRef } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';
import { DURATION, EASE_OUT } from '../../lib/motion';

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

/**
 * 숫자가 이전 값에서 새 값으로 굴러가듯 올라간다.
 * 처음 마운트될 때는 0에서, 이후에는 직전 값에서 시작해
 * 체크 하나 눌렀을 뿐인데 0부터 다시 세는 일이 없게 한다.
 */
export function CountUp({ value, duration = 1.1, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const from = prev.current;
    prev.current = value;

    if (reduceMotion) {
      node.textContent = String(value);
      return;
    }

    const controls = animate(from, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        node.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return <span ref={ref} className={className}>0</span>;
}

interface AnimatedBarProps {
  /** 0~100 */
  percent: number;
  className?: string;
  trackClassName?: string;
  delay?: number;
  /** 막대 색을 직접 지정할 때 (과목 식별 색 등) */
  color?: string;
}

/**
 * 0%에서 목표치까지 차오르는 진행바.
 * CSS transition만으로는 마운트 시점에 이미 최종 너비로 그려져 아무 일도 일어나지 않는다.
 */
export function AnimatedBar({ percent, className, trackClassName, delay = 0, color }: AnimatedBarProps) {
  const reduceMotion = useReducedMotion();
  const target = Math.max(0, Math.min(100, percent));

  return (
    <div className={trackClassName}>
      <motion.div
        className={className}
        style={color ? { background: color } : undefined}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${target}%` }}
        transition={{ duration: DURATION.slow + 0.3, ease: EASE_OUT, delay }}
      />
    </div>
  );
}
