import { create } from 'zustand';
import { PlannerState, AppTheme } from '../types';

export const usePlannerStore = create<PlannerState>((set) => ({
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
  apiKey: sessionStorage.getItem('geminiApiKey') || '',
  theme: (localStorage.getItem('appTheme') as AppTheme) || 'indigo',
  planVersion: 0,
  aiNotice: null,
  setAiNotice: (aiNotice) => set({ aiNotice }),
  setTheme: (theme) => {
    localStorage.setItem('appTheme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setApiKey: (key) => {
    sessionStorage.setItem('geminiApiKey', key);
    set({ apiKey: key });
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
