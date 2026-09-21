export type AppTheme = 'indigo' | 'rose' | 'emerald' | 'amber' | 'violet';

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
  referenceLink?: string;
}

export interface PlannerState {
  dday: number;
  startDate: string;
  goals: string[];
  goalImportance?: Record<string, number>;
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
