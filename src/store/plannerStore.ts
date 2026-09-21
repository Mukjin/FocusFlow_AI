import { create } from 'zustand';
import { PlannerState, AppTheme } from '../types';
import { enhanceEventsWithGemini, isGeminiConfigured } from '../lib/geminiClient';
import { rollOverdueToToday } from '../lib/rollover';

export const usePlannerStore = create<PlannerState>((set, get) => ({
  dday: 30,
  startDate: new Date().toISOString().split('T')[0],
  goals: [],
  goalImportance: {},
  goalKinds: {},
  timePerDay: '2시간',
  prefTime: '저녁',
  restDay: '없음',
  extraRequest: '',
  events: [],
  theme: (localStorage.getItem('appTheme') as AppTheme) || 'indigo',
  planVersion: 0,
  aiRefining: false,
  focusMinutes: 0,
  addFocusMinutes: (minutes) =>
    set((state) => ({ focusMinutes: state.focusMinutes + Math.max(0, Math.round(minutes)) })),

  rollOverdue: () => {
    const rolled = rollOverdueToToday(get().events);
    if (rolled === get().events) return; // 옮길 것이 없으면 건드리지 않는다
    set((state) => ({ events: rolled, planVersion: state.planVersion + 1 }));
  },

  // AI 호출을 스토어에 두면 화면을 이동해도 작업이 끊기지 않는다.
  // 덕분에 규칙 엔진 결과를 먼저 보여주고, 구체화는 뒤에서 이어서 할 수 있다.
  refineWithAI: async () => {
    const { events, goals, extraRequest } = get();
    if (events.length === 0) return;

    if (!isGeminiConfigured()) {
      set({
        aiNotice:
          'Gemini API 키가 없어 규칙 엔진 기본 일정으로 두었습니다. 프로젝트 루트의 .env.local 에 VITE_GEMINI_API_KEY 를 넣고 다시 실행해주세요.',
      });
      return;
    }

    set({ aiRefining: true, aiNotice: null });
    try {
      // Gemini 무료 등급은 과부하 시 일부만 돌려주거나 통째로 거절한다.
      // 아직 채워지지 않은 일정만 골라 다시 물어보기를 반복한다.
      // 이미 채운 것은 건드리지 않으므로 재시도가 결과를 되돌리지 않는다.
      let lastError: unknown = null;
      let filled = 0;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = get().events;
        const pending = current.filter((e) => !e.aiEnhanced);
        if (pending.length === 0) break;

        if (attempt > 0) await new Promise((r) => setTimeout(r, 2500 * attempt));

        try {
          const refined = await enhanceEventsWithGemini(pending, goals, extraRequest);
          // 실제로 문구가 바뀐 것만 '채워졌다'고 본다
          const byId = new Map(
            refined
              .filter((r, i) => r.task !== pending[i].task)
              .map((r) => [r.id, r]),
          );
          if (byId.size === 0) continue;

          filled += byId.size;
          set((state) => ({
            events: state.events.map((e) => byId.get(e.id) ?? e),
            planVersion: state.planVersion + 1,
          }));
        } catch (error) {
          lastError = error;
        }
      }

      const remaining = get().events.filter((e) => !e.aiEnhanced).length;
      if (filled === 0) {
        console.error('AI refinement failed:', lastError);
        set({
          aiNotice:
            'AI 구체화에 실패해 규칙 엔진 기본 일정을 유지했습니다. 잠시 후 \'AI 할 일 구체화\'를 눌러 다시 시도해주세요.',
        });
      } else if (remaining > 0) {
        set({
          aiNotice: `${remaining}개는 AI 구체화가 되지 않아 기본 문구로 두었습니다. 'AI 할 일 구체화'를 다시 누르면 남은 것만 채웁니다.`,
        });
      }
    } finally {
      set({ aiRefining: false });
    }
  },
  aiNotice: null,
  setAiNotice: (aiNotice) => set({ aiNotice }),
  setTheme: (theme) => {
    localStorage.setItem('appTheme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setSetup: (setup) => set((state) => ({ ...state, ...setup })),
  // 새 플랜이 통째로 들어올 때만 버전을 올린다
  setEvents: (events) => set((state) => ({ events, planVersion: state.planVersion + 1 })),
  addEvent: (event) => set((state) => ({
    events: [...state.events, { ...event, id: Date.now() + Math.floor(Math.random() * 1000) }]
  })),
  updateEvent: (id, updatedEvent) => set((state) => ({
    events: state.events.map((e) => e.id === id ? { ...e, ...updatedEvent } : e)
  })),
  deleteEvent: (id) => set((state) => ({
    events: state.events.filter((e) => e.id !== id)
  })),
  toggleEventCompletion: (id) => set((state) => ({
    events: state.events.map((e) => {
      if (e.id !== id) return e;
      const completed = !e.completed;
      // 완료 시각을 남겨야 '며칠 연속으로 했는지'를 계산할 수 있다
      return { ...e, completed, completedAt: completed ? new Date().toISOString() : undefined };
    })
  })),
  setFullState: (state) => set((prev) => ({ ...prev, ...state }))
}));
