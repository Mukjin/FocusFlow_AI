interface LogoProps {
  className?: string;
  /** 단색으로 쓸지(헤더 등), 그라디언트로 쓸지(랜딩 히어로) */
  variant?: 'solid' | 'gradient';
}

/**
 * FocusFlow_AI 마크.
 *
 * 이 앱의 구조를 그대로 그림으로 옮겼다.
 *  · 바깥 링이 끊겨 있다 = 계획은 닫힌 원이 아니라 밀리고 이어지는 것
 *  · 안쪽의 이어진 곡선 = 규칙 엔진이 만든 흐름(Flow)
 *  · 중심의 점 = 지금 집중해야 할 하나(Focus)
 *
 * 색은 currentColor / 테마 CSS 변수를 따라가므로 5가지 테마에서 전부 자연스럽게 바뀐다.
 */
export default function Logo({ className = 'w-8 h-8', variant = 'solid' }: LogoProps) {
  const gradientId = 'ff-logo-gradient';

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="FocusFlow_AI"
    >
      {variant === 'gradient' && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--color-primary-400)" />
            <stop offset="100%" stopColor="var(--color-primary-700)" />
          </linearGradient>
        </defs>
      )}

      {/* 끊긴 바깥 링 — 일정은 밀릴 수 있다 */}
      <path
        d="M16 3.5a12.5 12.5 0 1 1-8.84 3.66"
        stroke={variant === 'gradient' ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* 이어지는 흐름 — 규칙 엔진이 만든 뼈대 */}
      <path
        d="M9 20.5c2.6 0 3.1-4.2 5.2-4.2 2 0 2.2 4.2 4.3 4.2 2.1 0 2.6-8.4 4.5-8.4"
        stroke={variant === 'gradient' ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 오늘의 초점 */}
      <circle
        cx="16"
        cy="8.6"
        r="2.5"
        fill={variant === 'gradient' ? `url(#${gradientId})` : 'currentColor'}
      />
    </svg>
  );
}

/** 마크 + 글자를 함께 쓰는 자리(헤더, 랜딩 상단) */
export function LogoWordmark({
  className = '',
  markClassName = 'w-8 h-8',
  textClassName = 'text-[17px]',
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="rounded-xl bg-primary-600 p-1.5 shadow-sm shadow-primary-500/20 text-white flex items-center justify-center">
        <Logo className={markClassName} />
      </div>
      <h1 className={`font-bold tracking-tight text-zinc-900 dark:text-white ${textClassName}`}>
        FocusFlow<span className="text-primary-600 dark:text-primary-400">_AI</span>
      </h1>
    </div>
  );
}
