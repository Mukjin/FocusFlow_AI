import { create } from 'zustand';
import { PlannerState, AppTheme } from '../types';
import { enhanceEventsWithGemini, isGeminiConfigured } from '../lib/geminiClient';

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
      const refined = await enhanceEventsWithGemini(events, goals, extraRequest);
      set((state) => ({ events: refined, planVersion: state.planVersion + 1 }));
    } catch (error) {
      console.error('AI refinement failed:', error);
      set({
        aiNotice:
          'AI 구체화에 실패해 규칙 엔진 기본 일정을 유지했습니다. 잠시 후 \'AI 할 일 구체화\'로 다시 시도해주세요.',
      });
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
