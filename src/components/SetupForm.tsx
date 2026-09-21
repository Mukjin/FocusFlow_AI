import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlannerStore } from '../store/plannerStore';
import type { GoalKind } from '../types';
import { generateRuleBasedEvents } from '../lib/ruleEngine';
import { Loader2, ChevronRight, ChevronLeft, Calendar, Target, Sparkles, X, CheckCircle2, Circle, AlertCircle, Check } from 'lucide-react';
import { DURATION, EASE_OUT, SPRING, pressable } from '../lib/motion';

const GOAL_CATEGORIES: { category: string; kind: GoalKind; options: string[] }[] = [
  {
    category: '프로그래밍',
    kind: 'exam',
    options: ['코딩테스트', 'Python', 'Java', 'C++', 'JavaScript', 'React', 'Spring Boot']
  },
  {
    category: '자격증 (IT/데이터)',
    kind: 'exam',
    options: ['정보처리기사', 'ADsP', 'SQLD', '빅데이터분석기사', 'AWS 자격증']
  },
  {
    category: '어학',
    kind: 'language',
    options: ['토익', '오픽(OPIc)', '토익스피킹', 'JLPT', 'HSK']
  },
  {
    category: '자격증 (일반)',
    kind: 'exam',
    options: ['한국사능력검정시험', '컴퓨터활용능력', '전산세무회계', '공인중개사']
  },
  {
    category: '시험/고시',
    kind: 'exam',
    options: ['수능', '공무원 시험', '임용고시', '중간고사', '기말고사']
  },
  {
    category: '독서',
    kind: 'reading',
    options: ['독서 습관 만들기', '전공 서적 완독', '고전 읽기', '자기계발서', '영어 원서 읽기']
  }
];

const KIND_BY_GOAL: Record<string, GoalKind> = Object.fromEntries(
  GOAL_CATEGORIES.flatMap((c) => c.options.map((o) => [o, c.kind]))
);

const TIME_OPTIONS = ['30분', '40분', '1시간', '1.5시간', '2시간', '3시간', '4시간', '5시간+'];
const PREF_TIMES = ['아침', '오전', '오후', '저녁', '혼합'];
const REST_DAYS = ['없음', '토요일', '일요일', '토일'];

export default function SetupForm({ onComplete }: { onComplete: () => void }) {
  const store = usePlannerStore();
  
  const [step, setStep] = useState(1);
  
  const [dday, setDday] = useState(store.dday);
  const [startDate, setStartDate] = useState(store.startDate);
  const [goals, setGoals] = useState<string[]>(store.goals);
  const [goalImportance, setGoalImportance] = useState<Record<string, number>>(store.goalImportance || {});
  const [goalKinds, setGoalKinds] = useState<Record<string, GoalKind>>(store.goalKinds || {});
  const [customGoal, setCustomGoal] = useState('');
  const [timePerDay, setTimePerDay] = useState(store.timePerDay);
  const [prefTime, setPrefTime] = useState(store.prefTime);
  const [restDay, setRestDay] = useState(store.restDay);
  const [extraRequest, setExtraRequest] = useState(store.extraRequest);
  
  const [isGenerating, setIsGenerating] = useState(false);
  // 2단계 파이프라인(규칙 엔진 -> Gemini)의 진행 상태를 화면에 드러내기 위한 상태
  const [genStage, setGenStage] = useState<'idle' | 'rule' | 'ai'>('idle');
  const [ruleCount, setRuleCount] = useState(0);
  const [notice, setNotice] = useState<{ kind: 'error' | 'warn'; text: string } | null>(null);

  const handleGoalToggle = (goal: string) => {
    if (goals.includes(goal)) {
      setGoals(goals.filter(g => g !== goal));
      const newImportance = { ...goalImportance };
      delete newImportance[goal];
      setGoalImportance(newImportance);
    } else {
      setGoals([...goals, goal]);
      setGoalImportance({ ...goalImportance, [goal]: 2 });
      setGoalKinds({ ...goalKinds, [goal]: KIND_BY_GOAL[goal] || 'exam' });
    }
  };

  const handleAddCustomGoal = () => {
    if (customGoal.trim() && !goals.includes(customGoal.trim())) {
      const newGoal = customGoal.trim();
      setGoals([...goals, newGoal]);
      setGoalImportance({ ...goalImportance, [newGoal]: 2 });
      // 직접 추가한 목표는 성격을 알 수 없으므로 가장 무난한 시험형으로 둔다
      setGoalKinds({ ...goalKinds, [newGoal]: 'exam' });
      setCustomGoal('');
    }
  };

  const handleGenerate = async () => {
    if (goals.length === 0) {
      setNotice({ kind: 'error', text: '최소 1개의 목표를 선택해주세요.' });
      return;
    }

    setIsGenerating(true);
    setNotice(null);
    store.setAiNotice(null);
    setGenStage('rule');

    try {
      // Save setup to store
      store.setSetup({
        dday,
        startDate,
        goals,
        goalImportance,
        goalKinds,
        timePerDay,
        prefTime,
        restDay,
        extraRequest
      });

      // Step 1: Rule-based generation (결정론적 뼈대)
      const ruleEvents = generateRuleBasedEvents(dday, startDate, goals, goalImportance, goalKinds, timePerDay, restDay, prefTime);
      setRuleCount(ruleEvents.length);

      // 1단계 완료가 화면에 인지되도록 짧게 머문 뒤 2단계로 넘어간다
      await new Promise((resolve) => setTimeout(resolve, 700));
      setGenStage('ai');
      // 여기서 바로 저장하고 화면을 넘긴다.
      // AI를 기다리며 30초 동안 빈 화면을 보여주는 대신, 규칙 엔진이 만든 일정을
      // 즉시 보여주고 구체화는 스토어에서 이어서 진행한다.
      const eventsWithIds = ruleEvents.map((e, i) => ({ ...e, id: Date.now() + i }));
      store.setEvents(eventsWithIds);
      onComplete();

      // 화면이 바뀐 뒤에도 끊기지 않도록 스토어 액션에 맡긴다
      void store.refineWithAI();
    } catch (error) {
      console.error("Generation error:", error);
      setNotice({ kind: 'error', text: '일정 생성 중 오류가 발생했습니다. 다시 시도해주세요.' });
    } finally {
      setIsGenerating(false);
      setGenStage('idle');
    }
  };

  // Get all preset options to filter out custom goals
  const allPresetOptions = GOAL_CATEGORIES.flatMap(c => c.options);
  const customGoals = goals.filter(g => !allPresetOptions.includes(g));

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="w-full max-w-3xl p-8 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80">
      
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="relative flex items-start justify-between">
          {/* 연결선은 첫 원의 중심(left-5)에서 마지막 원의 중심(right-5)까지만 그린다.
              세로 위치도 컨테이너 중앙이 아니라 원의 중심(top-5 = w-10의 절반)에 맞춘다. */}
          <div className="absolute left-5 right-5 top-5 -translate-y-1/2 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full bg-primary-600 rounded-full"
              initial={false}
              animate={{ width: `${((step - 1) / 2) * 100}%` }}
              transition={{ duration: DURATION.base, ease: EASE_OUT }}
            />
          </div>

          {[
            { num: 1, label: '기본 정보', icon: Calendar },
            { num: 2, label: '목표 설정', icon: Target },
            { num: 3, label: 'AI 최적화', icon: Sparkles }
          ].map((s) => {
            const Icon = s.icon;
            const isDone = step > s.num;
            const isCurrent = step === s.num;
            const isActive = isDone || isCurrent;
            return (
              <div key={s.num} className="relative z-10 flex w-20 flex-col items-center gap-2">
                <motion.div
                  animate={{ scale: isCurrent ? 1.08 : 1 }}
                  transition={SPRING}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-200 dark:shadow-primary-900/20'
                      : 'bg-white dark:bg-zinc-900 text-zinc-400 border-2 border-zinc-200 dark:border-zinc-800'
                  } ${isCurrent ? 'ring-4 ring-primary-500/20' : ''}`}
                >
                  {/* 지나온 단계는 체크로 바꿔 어디까지 왔는지 한눈에 보이게 한다 */}
                  {isDone ? <Check className="w-5 h-5" strokeWidth={3} /> : <Icon className="w-5 h-5" />}
                </motion.div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  isCurrent
                    ? 'text-primary-600 dark:text-primary-400 font-bold'
                    : isDone
                      ? 'text-zinc-600 dark:text-zinc-300'
                      : 'text-zinc-400 dark:text-zinc-500'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[400px]">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">언제, 얼마나 공부할까요?</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">학습 기간과 가용 시간을 알려주세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">D-Day (남은 일수)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">D-</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="365"
                    value={dday} 
                    onChange={(e) => setDday(parseInt(e.target.value) || 1)}
                    className="w-full pl-9 pr-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:primary-500 focus:border-primary-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">시작 날짜</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">하루 공부 시간</label>
                <select 
                  value={timePerDay} 
                  onChange={(e) => setTimePerDay(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:primary-500 focus:border-primary-500 outline-none transition-all appearance-none"
                >
                  {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">선호 시간대</label>
                <select 
                  value={prefTime} 
                  onChange={(e) => setPrefTime(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:primary-500 focus:border-primary-500 outline-none transition-all appearance-none"
                >
                  {PREF_TIMES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">쉬는 요일</label>
                <select 
                  value={restDay} 
                  onChange={(e) => setRestDay(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:primary-500 focus:border-primary-500 outline-none transition-all appearance-none"
                >
                  {REST_DAYS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Goals */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">무엇을 공부할까요?</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">목표를 선택하고 중요도를 설정해주세요.</p>
            </div>

            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {GOAL_CATEGORIES.map(category => (
                <div key={category.category}>
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">{category.category}</h3>
                  <div className="flex flex-wrap gap-2">
                    {category.options.map(goal => (
                      <button
                        key={goal}
                        onClick={() => handleGoalToggle(goal)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          goals.includes(goal) 
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-200 dark:shadow-primary-900/20 scale-105' 
                            : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                        }`}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">직접 추가</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {customGoals.map(goal => (
                    <button
                      key={goal}
                      onClick={() => handleGoalToggle(goal)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-primary-600 text-white shadow-md shadow-primary-200 dark:shadow-primary-900/20 scale-105 flex items-center gap-2"
                    >
                      {goal} <X className="w-3 h-3 opacity-70" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="목록에 없는 목표 직접 입력" 
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomGoal()}
                    className="flex-1 px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:primary-500 focus:border-primary-500 outline-none transition-all"
                  />
                  <button 
                    onClick={handleAddCustomGoal}
                    className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                  >
                    추가
                  </button>
                </div>
              </div>

              {goals.length > 0 && (
                <div className="mt-8 p-5 bg-primary-50/50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-800/30">
                  <h3 className="text-sm font-bold text-primary-900 dark:text-primary-100 mb-4">선택한 목표 중요도 (시간 배분)</h3>
                  <div className="space-y-3">
                    {goals.map(goal => (
                      <div key={goal} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{goal}</span>
                        <div className="flex gap-1">
                          {[
                            { label: '낮음', value: 1 },
                            { label: '보통', value: 2 },
                            { label: '높음', value: 3 }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setGoalImportance({...goalImportance, [goal]: opt.value})}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                (goalImportance[goal] || 2) === opt.value
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Extra & Generate */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI 맞춤 설정</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">AI에게 특별히 요청하고 싶은 사항이 있나요?</p>
            </div>

            <div className="bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 p-6 rounded-2xl border border-primary-100 dark:border-primary-800/30">
              <label className="flex items-center gap-2 text-sm font-bold text-primary-900 dark:text-primary-100 mb-3">
                <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                추가 요청사항 (선택)
              </label>
              <textarea 
                value={extraRequest} 
                onChange={(e) => setExtraRequest(e.target.value)}
                placeholder="예: 주말에는 모의고사 위주로 짜줘, 토익은 LC 비중을 높여줘, 첫 주는 가볍게 시작하고 싶어"
                className="w-full p-4 border border-white/50 dark:border-zinc-700/50 rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none resize-none h-32 shadow-sm"
              />
            </div>

            <div className="pt-4">
              {isGenerating ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT }}
                  className="w-full p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-primary-100 dark:border-primary-800/30 shadow-sm space-y-5"
                >
                  {/* 1단계: 규칙 엔진 */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <AnimatePresence mode="wait" initial={false}>
                        {genStage === 'rule' ? (
                          <motion.span key="spin" exit={{ opacity: 0, scale: 0.6 }}>
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="done"
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ ...SPRING, stiffness: 520 }}
                            className="block"
                          >
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">① 규칙 엔진 · 일정 뼈대 생성</p>
                        {genStage !== 'rule' && (
                          <motion.span
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: DURATION.base, ease: EASE_OUT }}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                          >
                            {ruleCount}개 완료
                          </motion.span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                        날짜 · 시간대 · 소요시간 · 기초/심화/마무리 단계 계산
                      </p>
                    </div>
                  </div>

                  <div className="ml-3 h-4 w-0.5 bg-zinc-200 dark:bg-zinc-700 overflow-hidden rounded">
                    <motion.div
                      className="w-full bg-emerald-500"
                      initial={{ height: 0 }}
                      animate={{ height: genStage === 'rule' ? 0 : '100%' }}
                      transition={{ duration: DURATION.base, ease: EASE_OUT }}
                    />
                  </div>

                  {/* 2단계: Gemini */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {genStage === 'ai'
                        ? <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
                        : <Circle className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold ${genStage === 'ai' ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        ② Gemini · 할 일 내용 + 참고자료 검색
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                        뼈대는 그대로 두고, 각 칸의 내용만 채웁니다
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  {...pressable}
                  onClick={handleGenerate}
                  disabled={goals.length === 0}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                >
                  ✨ 맞춤형 학습 일정 생성하기
                </motion.button>
              )}

              {notice && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE_OUT }}
                  className={`mt-4 flex items-start gap-2.5 p-4 rounded-xl border text-sm font-medium ${
                  notice.kind === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300'
                }`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{notice.text}</span>
                </motion.div>
              )}

              {goals.length === 0 && !isGenerating && (
                <p className="text-center text-red-500 text-sm mt-3 font-medium">
                  이전 단계에서 최소 1개의 목표를 선택해주세요.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={step === 1 || isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-0 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> 이전
        </button>
        
        {step < 3 && (
          <button
            onClick={nextStep}
            className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
          >
            다음 <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
