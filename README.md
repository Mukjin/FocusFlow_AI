# FocusFlow_AI

> 규칙 엔진이 학습 일정의 **뼈대**를 만들고, Gemini가 그 뼈대 안의 **내용만** 채우는 D-Day 학습 플래너

**▶ 데모: https://mukjin.github.io/FocusFlow_AI/**

> 공개 데모에는 API 키를 넣지 않았습니다. 키가 노출되기 때문입니다(아래 보안 주의 참고).
> 그래서 데모는 **규칙 엔진 전용**으로 돌아가며, 모든 날짜에 같은 문구가 들어갑니다.
> AI 구체화까지 보려면 아래 방법으로 로컬에서 본인 키로 실행해주세요.

AI에게 학습 계획을 통째로 맡기면 물어볼 때마다 결과 구조가 달라지고 요청한 일수와 실제 일정 개수가 맞지 않습니다.
FocusFlow_AI는 **날짜·시간대·소요시간·학습 단계를 결정론적 규칙으로 먼저 확정**한 뒤, LLM에게는 각 칸의 할 일 문구와 참고 링크만 채우게 해서 일정 구조가 깨지지 않도록 만든 브라우저 단독 실행 플래너입니다.

---

## 실행 방법

**필요한 것:** Node.js 18 이상

```bash
git clone https://github.com/Mukjin/FocusFlow_AI.git
cd FocusFlow_AI
npm install
cp .env.example .env.local     # 키를 여기에 채웁니다
npm run dev
```

`http://localhost:3000` 에서 열립니다.

### Gemini API 키 (권장)

`.env.local` 에 한 줄만 넣으면 됩니다. **앱 화면에서 키를 입력하는 곳은 없습니다.**

```bash
VITE_GEMINI_API_KEY=여기에_발급받은_키
```

[Google AI Studio](https://aistudio.google.com/apikey)에서 **카드 등록 없이 무료로** 발급받습니다.

키가 없어도 앱은 정상 실행되며, 규칙 엔진이 만든 기본 일정이 나옵니다.
다만 모든 날짜에 같은 문구가 들어가고, Gemini가 날짜별 구체적인 주제로 바꿔주는 단계만 생략됩니다.

> ### ⚠️ 공개 배포 전에 반드시 읽어주세요
>
> 이 앱은 **백엔드가 없고 Gemini를 브라우저에서 직접 호출**합니다.
> Vite는 빌드할 때 `.env` 값을 **번들 안에 그대로 넣기 때문에**, 이 상태로 배포하면
> 누구나 개발자도구에서 키를 꺼내 쓸 수 있습니다.
>
> - **로컬에서 각자 자기 키로 실행** → 안전합니다. 위 방법이 그것입니다.
> - **내 키를 넣은 채로 공개 배포** → 키가 노출되고 할당량이 소진됩니다. 하지 마세요.
>
> 공개 서비스로 만들려면 Gemini 호출을 서버 함수(Vercel/Cloudflare Functions,
> Supabase Edge Functions 등)로 옮기고 키를 서버에만 두어야 합니다.

### Supabase (선택)

설정하지 않으면 저장 기능만 비활성화되고 나머지는 정상 동작합니다.

```bash
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
② Gemini    src/lib/geminiClient.ts  (①이 화면에 뜬 뒤 백그라운드에서 진행)
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
| 목표 성격별 기본 문구 (시험형 / 어학형 / 독서형) | `src/lib/ruleEngine.ts` |
| **주간 복습 자동 배치** — 7일마다 그 주 학습을 되짚는 일정 삽입 | `src/lib/ruleEngine.ts` |
| **연속 학습일·최근 14일 활동** — 완료 시각 기준 실제 기록 | `src/lib/streak.ts` |
| Gemini 할 일 구체화 (규칙 엔진의 반복 문구를 날짜별 구체 주제로 교체) | `src/lib/geminiClient.ts` |
| 2단계 파이프라인 진행 표시 · AI 실패 시 폴백 배너 | `src/components/SetupForm.tsx`, `src/App.tsx` |
| 규칙 엔진 결과를 먼저 보여주고 AI 구체화는 백그라운드 진행 | `src/store/plannerStore.ts` (`refineWithAI`) |
| 월간/주간 캘린더, 드래그로 날짜 이동, **가로 드래그로 소요시간 리사이즈** | `src/components/CalendarView.tsx` |
| 일자 상세 패널 (일정 추가·수정·삭제) | `src/components/DayDetailPanel.tsx` |
| 칸반 보드 (예정 / 오늘 / 완료) 드래그 이동 | `src/components/KanbanView.tsx` |
| 통계 (달성률, 과목별 진행률, 계획 대비 완료 시간) | `src/components/DashboardView.tsx` |
| 과목별 목록 뷰 | `src/components/ListView.tsx` |
| 뽀모도로 타이머 (종료 시각 기준 계산 · 백그라운드 탭에서도 정확) | `src/components/PomodoroWidget.tsx` |
| PDF 내보내기 (html2canvas + jsPDF) | `src/App.tsx`, `src/components/PdfExportTemplate.tsx` |
| ICS 내보내기 (RFC 5545 이스케이프·75옥텟 폴딩·CRLF 준수) | `src/App.tsx` |
| 테마 5색 전환 (CSS 변수 교체) | `src/index.css` |
| 과목 식별 색 — 명도·채도·색각이상 분리 검증을 통과한 고정 8색 | `src/lib/palette.ts`, `src/index.css` |
| 소요 시간 파싱·포맷 공용 유틸 | `src/lib/duration.ts` |
| 모션 시스템 (토큰 기반 진입·전환·순차 등장, 접근성 `reducedMotion` 대응) | `src/lib/motion.ts`, `src/components/motion/Primitives.tsx` |
| 익명 기기 ID 기반 자동 저장 | `src/App.tsx` |

## 아직 없는 것

투명하게 밝혀둡니다.

- **백엔드 서버 없음.** 모든 로직이 브라우저에서 실행되며 Gemini도 클라이언트에서 직접 호출합니다. 그래서 공개 배포 시 키가 노출됩니다(위 경고 참고). 로컬 실행 전용입니다.
- **로그인 없음.** `crypto.randomUUID()`로 만든 기기 ID를 `localStorage`에 저장해 식별합니다. 브라우저를 바꾸면 데이터를 이어받을 수 없습니다.
- **실제 공부한 시간은 측정하지 않습니다.** 완료를 누른 시각(`completedAt`)은 기록되어 연속 학습일 계산에 쓰이지만, 타이머로 실측한 시간은 아닙니다. 통계의 "실제 학습 시간"은 *완료 체크된 일정의 계획 시간 합*입니다.
- **플랜 이력이 남지 않습니다.** 저장이 `user_id` 1행 통째 덮어쓰기라 지난 플랜은 사라집니다.
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
