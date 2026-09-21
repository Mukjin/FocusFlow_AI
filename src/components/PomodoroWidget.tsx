import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, Coffee, Brain, Minimize2, Maximize2, Settings2 } from 'lucide-react';
import { usePlannerStore } from '../store/plannerStore';

export default function PomodoroWidget() {
  const addFocusMinutes = usePlannerStore((s) => s.addFocusMinutes);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  
  const [tempWork, setTempWork] = useState(25);
  const [tempBreak, setTempBreak] = useState(5);

  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 남은 시간을 1초씩 빼면 브라우저가 백그라운드 탭의 타이머를 스로틀링할 때
  // 25분이 40분이 된다. 끝나는 시각을 기억해 두고 매 틱마다 현재 시각으로 다시 계산한다.
  const deadlineRef = useRef<number | null>(null);

  const playChime = () => {
    // 외부 CDN 음원 대신 브라우저 내장 오디오로 직접 소리를 만든다.
    // 네트워크·저작권 의존이 없고, CDN이 죽어도 알림이 멈추지 않는다.
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1200);
    } catch {
      /* 오디오를 못 쓰는 환경이면 조용히 넘어간다 */
    }
  };

  useEffect(() => {
    if (!isActive) {
      deadlineRef.current = null;
      return;
    }

    // 실행을 시작/재개한 시점에 끝나는 시각을 고정한다
    if (deadlineRef.current === null) {
      deadlineRef.current = Date.now() + timeLeft * 1000;
    }

    const tick = () => {
      if (deadlineRef.current === null) return;
      const remaining = Math.round((deadlineRef.current - Date.now()) / 1000);

      if (remaining > 0) {
        setTimeLeft(remaining);
        return;
      }

      // 종료: 반대 모드로 전환하고 멈춘다
      deadlineRef.current = null;
      setIsActive(false);
      setMode((prev) => {
        // 집중 세션을 끝까지 마쳤을 때만 실제 학습 시간으로 적립한다.
        // 계획 시간과 달리 이 값은 실측이다.
        if (prev === 'work') addFocusMinutes(workDuration);
        const next = prev === 'work' ? 'break' : 'work';
        setTimeLeft((next === 'work' ? workDuration : breakDuration) * 60);
        return next;
      });
      playChime();
    };

    tick(); // 탭으로 돌아왔을 때 즉시 실제 남은 시간으로 맞춘다
    timerRef.current = setInterval(tick, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // timeLeft 는 의존성에서 뺀다. 넣으면 매 틱마다 interval 이 다시 만들어진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, workDuration, breakDuration, addFocusMinutes]);

  // 탭이 다시 보이면 즉시 남은 시간을 실제 시각 기준으로 보정한다
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isActive && deadlineRef.current !== null) {
        setTimeLeft(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isActive]);

  const toggleTimer = () => {
    // 일시정지했다가 다시 누르면 남은 시간부터 새로 센다
    if (isActive) deadlineRef.current = null;
    setIsActive((prev) => !prev);
  };

  const resetTimer = () => {
    deadlineRef.current = null;
    setIsActive(false);
    setTimeLeft(mode === 'work' ? workDuration * 60 : breakDuration * 60);
  };

  const switchMode = (newMode: 'work' | 'break') => {
    deadlineRef.current = null;
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(newMode === 'work' ? workDuration * 60 : breakDuration * 60);
  };

  const saveSettings = () => {
    const newWork = Math.max(1, Math.min(120, tempWork));
    const newBreak = Math.max(1, Math.min(60, tempBreak));
    
    setWorkDuration(newWork);
    setBreakDuration(newBreak);
    setShowSettings(false);
    setIsActive(false);
    deadlineRef.current = null;
    
    if (mode === 'work') {
      setTimeLeft(newWork * 60);
    } else {
      setTimeLeft(newBreak * 60);
    }
  };

  const openSettings = () => {
    setTempWork(workDuration);
    setTempBreak(breakDuration);
    setShowSettings(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Progress circle
  const totalSeconds = mode === 'work' ? workDuration * 60 : breakDuration * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
      >
        <Brain className="w-6 h-6" />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-full shadow-xl border border-zinc-200/80 dark:border-zinc-800/80 p-2 flex items-center gap-3 pr-4 animate-in slide-in-from-bottom-4">
        <button 
          onClick={toggleTimer}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${mode === 'work' ? 'bg-primary-600' : 'bg-emerald-500'}`}
        >
          {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
        </button>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            {mode === 'work' ? 'FOCUS' : 'BREAK'}
          </span>
          <span className="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100 leading-none">
            {formatTime(timeLeft)}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2 border-l border-zinc-200/80 dark:border-zinc-800/80 pl-2">
          <button onClick={() => setIsMinimized(false)} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-500 dark:text-primary-400" />
          </div>
          뽀모도로 타이머
        </h3>
        <div className="flex items-center gap-1">
          {!showSettings && (
            <button onClick={openSettings} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="설정">
              <Settings2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setIsMinimized(true)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="최소화">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {showSettings ? (
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">집중 시간 (분)</label>
            <input 
              type="number" 
              value={tempWork} 
              onChange={e => setTempWork(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all dark:text-white"
              min="1"
              max="120"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">휴식 시간 (분)</label>
            <input 
              type="number" 
              value={tempBreak} 
              onChange={e => setTempBreak(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all dark:text-white"
              min="1"
              max="60"
            />
          </div>
          <div className="flex gap-3 mt-6">
            <button 
              onClick={() => setShowSettings(false)}
              className="flex-1 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              취소
            </button>
            <button 
              onClick={saveSettings}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 flex flex-col items-center">
          {/* Mode Switch */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1.5 rounded-xl mb-8 w-full">
            <button
              onClick={() => switchMode('work')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'work' ? 'bg-white dark:bg-zinc-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              집중 ({workDuration}분)
            </button>
            <button
              onClick={() => switchMode('break')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mode === 'break' ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
            >
              <Coffee className="w-4 h-4" /> 휴식 ({breakDuration}분)
            </button>
          </div>

          {/* Timer Circle */}
          <div className="relative w-48 h-48 mb-8">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="4" fill="none" />
              <circle 
                cx="50" cy="50" r="45" 
                className={`${mode === 'work' ? 'stroke-primary-500' : 'stroke-emerald-500'} transition-all duration-1000 ease-linear`}
                strokeWidth="4" 
                fill="none" 
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-mono font-light text-zinc-900 dark:text-zinc-100 tracking-tighter">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTimer}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${mode === 'work' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            >
              {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <button
              onClick={resetTimer}
              className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="초기화"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
