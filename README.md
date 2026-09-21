# FocusFlow_AI

> 규칙 엔진이 학습 일정의 **뼈대**를 만들고, Gemini가 그 뼈대 안의 **내용만** 채우는 D-Day 학습 플래너

AI에게 학습 계획을 통째로 맡기면 물어볼 때마다 결과 구조가 달라지고 요청한 일수와 실제 일정 개수가 맞지 않습니다.
FocusFlow_AI는 **날짜·시간대·소요시간·학습 단계를 결정론적 규칙으로 먼저 확정**한 뒤, LLM에게는 각 칸의 할 일 문구와 참고 링크만 채우게 해서 일정 구조가 깨지지 않도록 만든 브라우저 단독 실행 플래너입니다.

---

## 실행 방법

**필요한 것:** Node.js 18 이상

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 열립니다. **환경변수 없이도 바로 실행됩니다.**

### 선택 1 — Gemini API 키 (AI 기능을 쓰려면)

키가 없어도 규칙 엔진이 일정을 생성하지만, 모든 날짜에 같은 문구(`토익 핵심 개념 정리 및 이론 학습`)가 들어갑니다.
키를 넣으면 Gemini가 **날짜마다 다른 구체적인 주제로 바꿔** 채웁니다.

> **무료 등급으로 충분합니다.** 카드 등록 없이 Google AI Studio에서 키를 발급받아 쓰면 됩니다.
> 단, Google 검색 그라운딩은 유료 등급 전용이라 이 앱에서는 쓰지 않습니다. 그라운딩 없이 링크를
> 생성시키면 열리지 않는 주소가 나오므로, 프롬프트에서 URL 생성을 명시적으로 막아두었습니다.
> 참고 링크는 일정 상세 패널에서 직접 입력할 수 있습니다.

두 가지 방법 중 하나를 쓰면 됩니다.

1. 앱 실행 후 **좌측 사이드바의 `Gemini API 설정`** 에 키를 붙여넣고 저장 (`sessionStorage`에 저장, 탭을 닫으면 사라짐)
2. 프로젝트 루트에 `.env.local` 생성

```bash
GEMINI_API_KEY=your-gemini-api-key
```

> 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받습니다.

### 선택 2 — Supabase (작성한 플랜을 브라우저 밖에 보관하려면)

설정하지 않으면 저장 기능만 비활성화되고 나머지는 정상 동작합니다.

```bash
# .env.local
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Supabase SQL Editor에서 테이블을 먼저 만들어야 합니다.

```sql
create table if not exists planner_data (
  user_id    text primary key,
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table planner_data enable row level security;

-- 로그인이 없는 익명 기기 ID 방식이라 anon 키로 읽고 쓸 수 있어야 합니다.
create policy "anon read write" on planner_data
  for all using (true) with check (true);
```

> ⚠️ 위 정책은 모든 행을 anon 키로 접근 가능하게 열어둡니다. 개인 프로젝트 범위에서만 사용하세요.
> 실제 서비스로 확장하려면 Supabase Auth를 붙이고 `auth.uid()` 기반 정책으로 바꿔야 합니다.

### 기타 명령

```bash
npm run build    # 프로덕션 빌드
npm run lint     # 타입 검사 (tsc --noEmit)
npm run preview  # 빌드 결과 미리보기
```

---

## 어떻게 동작하나

```
사용자 입력 (D-Day · 목표 · 중요도 · 하루 시간 · 쉬는 요일)
        │
        ▼
① 규칙 엔진  src/lib/ruleEngine.ts
   · D-Day를 날짜별로 분할하고 쉬는 요일 제외
   · 진행률 40% / 75% 지점을 경계로 기초 → 심화 → 마무리 단계 배정
   · 목표별 중요도(1·2·3) 가중치로 하루 시간을 비례 배분
   · 선호 시간대를 시작 시각으로 삼아 시작·종료 시각 계산
        │
        ▼  ← 이 시점에 일정 개수·날짜·시간이 모두 확정된다
        │
② Gemini    src/lib/geminiClient.ts
   · 과목·단계별로 필요한 task 개수를 집계해 프롬프트에 명시
   · 날짜마다 다른 구체적인 학습 주제를 요청 (반복 문구 금지)
   · 응답을 shift()로 하나씩 소비해 뼈대에 주입
   · 실패하거나 개수가 모자라도 ①의 일정이 그대로 남는다
        │
        ▼
Zustand 스토어 → 캘린더 / 칸반 / 통계 / 목록 뷰
        │
        └─ (Supabase 설정 시) 1.5초 디바운스 후 전체 스냅샷 upsert
```

핵심은 **②가 실패해도 ①의 결과가 살아남는다**는 점입니다. `SetupForm.tsx`의 `handleGenerate`가 Gemini 호출을 별도 try/catch로 감싸고, 실패 시 규칙 엔진 일정을 그대로 저장한 뒤 화면 상단 배너로 알립니다.

---

## 구현된 기능

| 기능 | 위치 |
|---|---|
| 규칙 기반 일정 생성 (단계·시간 배분·쉬는 요일·토요일 1.5배) | `src/lib/ruleEngine.ts` |
| Gemini 할 일 구체화 (규칙 엔진의 반복 문구를 날짜별 구체 주제로 교체) | `src/lib/geminiClient.ts` |
| 2단계 파이프라인 진행 표시 · AI 실패 시 폴백 배너 | `src/components/SetupForm.tsx`, `src/App.tsx` |
| 월간/주간 캘린더, 드래그로 날짜 이동, **가로 드래그로 소요시간 리사이즈** | `src/components/CalendarView.tsx` |
| 일자 상세 패널 (일정 추가·수정·삭제) | `src/components/DayDetailPanel.tsx` |
| 칸반 보드 (예정 / 오늘 / 완료) 드래그 이동 | `src/components/KanbanView.tsx` |
| 통계 (달성률, 과목별 진행률, 계획 대비 완료 시간) | `src/components/DashboardView.tsx` |
| 과목별 목록 뷰 | `src/components/ListView.tsx` |
| 뽀모도로 타이머 (종료 시각 기준 계산 · 백그라운드 탭에서도 정확) | `src/components/PomodoroWidget.tsx` |
| PDF 내보내기 (html2canvas + jsPDF) | `src/App.tsx`, `src/components/PdfExportTemplate.tsx` |
| ICS 내보내기 (RFC 5545 이스케이프·75옥텟 폴딩·CRLF 준수) | `src/App.tsx` |
| 테마 5색 전환 (CSS 변수 교체) | `src/index.css` |
| 소요 시간 파싱·포맷 공용 유틸 | `src/lib/duration.ts` |
| 모션 시스템 (토큰 기반 진입·전환·순차 등장, 접근성 `reducedMotion` 대응) | `src/lib/motion.ts`, `src/components/motion/Primitives.tsx` |
| 익명 기기 ID 기반 자동 저장 | `src/App.tsx` |

## 아직 없는 것

투명하게 밝혀둡니다.

- **백엔드 서버 없음.** 모든 로직이 브라우저에서 실행되며 Gemini도 클라이언트에서 직접 호출합니다.
- **로그인 없음.** `crypto.randomUUID()`로 만든 기기 ID를 `localStorage`에 저장해 식별합니다. 브라우저를 바꾸면 데이터를 이어받을 수 없습니다.
- **학습 로그가 누적되지 않습니다.** 저장은 `user_id` 1행을 매번 통째로 덮어쓰는 방식이라 이력이 남지 않습니다. 완료 시각이나 실제 공부한 시간은 기록되지 않으며, 통계의 "실제 학습 시간"은 *완료 체크된 일정의 계획 시간 합*입니다.
- **AI가 참고 링크를 만들지 않습니다.** 검색 그라운딩이 유료 전용이라, 검증되지 않은 링크를 내보내는 대신 기능을 빼고 수동 입력만 남겼습니다.
- **테스트 코드 없음.**

---

## 기술 스택

React 19 · TypeScript · Vite 6 · Zustand · Tailwind CSS 4 · Motion 12 · date-fns · lucide-react
`@google/genai` (gemini-3-flash-preview) · `@supabase/supabase-js` · jsPDF · html2canvas

---

## 서드파티 리소스

| 리소스 | 출처 | 라이선스 |
|---|---|---|
| Pretendard | jsDelivr CDN | SIL OFL 1.1 |
| Inter, JetBrains Mono | Google Fonts | SIL OFL 1.1 |
| 아이콘 | lucide-react | ISC |

뽀모도로 알림음은 Web Audio API로 직접 합성합니다. 외부 음원 파일을 쓰지 않습니다.

문제 지문·이미지 등 제3자 저작 콘텐츠는 저장소에 포함되어 있지 않습니다.
설정 화면의 시험·자격증 명칭은 명칭만 사용하며 해당 기관과 제휴 관계가 없습니다.
