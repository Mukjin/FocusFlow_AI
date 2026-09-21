export type AppTheme = 'indigo' | 'rose' | 'emerald' | 'amber' | 'violet';

/** 목표 성격. 규칙 엔진이 기본 할 일 문구를 고를 때 쓴다. */
export type GoalKind = 'exam' | 'language' | 'reading';

export interface StudyEvent {
  id: number;
  date: string; // "YYYY-MM-DD"
  startTime?: string;
  endTime?: string;
  subject: string;
  task: string;
  duration: string;
  phase: '기초' | '심화' | '마무리';
  colorIndex: number;
  aiEnhanced?: boolean;
  completed?: boolean;
  /** 완료를 누른 시각(ISO). 연속 학습일 계산의 근거가 된다. */
  completedAt?: string;
  /** 규칙 엔진이 자동 삽입한 복습 일정 */
  isReview?: boolean;
  referenceLink?: string;
}

export interface PlannerState {
  dday: number;
  startDate: string;
  goals: string[];
  goalImportance?: Record<string, number>;
  goalKinds?: Record<string, GoalKind>;
  timePerDay: string;
  prefTime: string;
  restDay: string;
  extraRequest: string;
  events: StudyEvent[];
  apiKey: string;
  theme: AppTheme;
  planVersion: number;
  aiNotice: string | null;
  setAiNotice: (notice: string | null) => void;
  setTheme: (theme: AppTheme) => void;
  setApiKey: (key: string) => void;
  setSetup: (setup: Partial<Omit<PlannerState, 'events' | 'apiKey' | 'setApiKey' | 'setSetup' | 'setEvents' | 'addEvent' | 'updateEvent' | 'deleteEvent' | 'toggleEventCompletion' | 'theme' | 'setTheme' | 'aiNotice' | 'setAiNotice' | 'planVersion'>>) => void;
  setEvents: (events: StudyEvent[]) => void;
  addEvent: (event: Omit<StudyEvent, 'id'>) => void;
  updateEvent: (id: number, event: Partial<StudyEvent>) => void;
  deleteEvent: (id: number) => void;
  toggleEventCompletion: (id: number) => void;
  setFullState: (state: Partial<PlannerState>) => void;
}
