import { useMemo } from 'react';
import { motion } from 'motion/react';
import { usePlannerStore } from '../store/plannerStore';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Sparkles, Trash2, CalendarDays, Clock, BookOpen, CheckCircle2, Circle, Inbox, ExternalLink } from 'lucide-react';
import { DURATION, EASE_OUT, STAGGER } from '../lib/motion';
import { parseDurationToMinutes } from '../lib/duration';

export default function ListView() {
  const store = usePlannerStore();

  const groupedEvents = useMemo(() => {
    const groups: Record<string, typeof store.events> = {};
    store.events.forEach(event => {
      if (!groups[event.subject]) {
        groups[event.subject] = [];
      }
      groups[event.subject].push(event);
    });
    
    // Sort events in each group by date
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    
    return groups;
  }, [store.events]);

  const stats = useMemo(() => {
    const uniqueDays = new Set(store.events.map(e => e.date)).size;
    const totalSubjects = Object.keys(groupedEvents).length;
    
    // Rough estimation of total hours based on duration strings
    let totalMinutes = 0;
    store.events.forEach(e => {
      totalMinutes += parseDurationToMinutes(e.duration);
    });
    
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;
    
    return {
      days: uniqueDays,
      subjects: totalSubjects,
      time: `${totalHours}시간 ${remainingMins > 0 ? `${remainingMins}분` : ''}`
    };
  }, [store.events, groupedEvents]);

  const handleDelete = (id: number) => {
    if (confirm('이 일정을 삭제하시겠습니까?')) {
      store.deleteEvent(id);
    }
  };

  if (store.events.length === 0) {
    return (
      <div className="h-full m-6 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50">
        <div className="w-24 h-24 mb-6 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center">
          <Inbox className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
        </div>
        <p className="text-xl font-bold text-zinc-600 dark:text-zinc-300 mb-2">등록된 일정이 없습니다</p>
        <p className="text-sm">새로운 일정을 추가하여 목록을 채워보세요.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-7 h-7 text-primary-500" />
          </div>
          <div>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 block mb-1">총 학습 일수</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.days}일</span>
          </div>
        </div>
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
            <Clock className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 block mb-1">총 학습 시간 (예상)</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.time}</span>
          </div>
        </div>
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 block mb-1">학습 과목 수</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.subjects}개</span>
          </div>
        </div>
      </div>

      {/* List by Subject */}
      <div className="space-y-8">
        {Object.entries(groupedEvents).map(([subject, events]) => (
          <div key={subject} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                {subject}
              </h3>
              <span className="text-sm font-bold bg-white dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 shadow-sm">
                총 {(events as any[]).length}개 일정
              </span>
            </div>
            <div key={store.planVersion} className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
              {(events as any[]).map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT, delay: Math.min(i * STAGGER.dense * 2, 1.1) }}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center gap-5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors ${event.completed ? 'opacity-60 grayscale-[0.2]' : ''}`}
                >
                  <div className="w-36 flex-shrink-0 flex items-center gap-3">
                    <button 
                      onClick={() => store.toggleEventCompletion(event.id)}
                      className="flex-shrink-0 hover:scale-110 transition-transform text-zinc-300 hover:text-primary-600 dark:text-zinc-600 dark:hover:text-primary-400"
                    >
                      {event.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      ) : (
                        <Circle className="w-6 h-6" />
                      )}
                    </button>
                    <div className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                      {format(parseISO(event.date), 'M월 d일 (E)', { locale: ko })}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50">
                        {event.phase}
                      </span>
                      {event.aiEnhanced && (
                        <span className="flex items-center text-[11px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-md border border-primary-100 dark:border-primary-800/50">
                          <Sparkles className="w-3 h-3 mr-1" /> AI
                        </span>
                      )}
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 ml-auto flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1 rounded-lg">
                        {event.startTime && event.endTime && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> 
                            {event.startTime} - {event.endTime}
                          </span>
                        )}
                        <span className="text-zinc-400 dark:text-zinc-500">|</span>
                        <span>{event.duration}</span>
                      </div>
                    </div>
                    <p className={`text-[15px] leading-relaxed ${event.completed ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {event.task}
                    </p>
                    {event.referenceLink && (
                      <a 
                        href={event.referenceLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1.5 rounded-lg border border-primary-100 dark:border-primary-800/30 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors mt-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        레퍼런스 보기
                      </a>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 pl-2">
                    <button 
                      onClick={() => handleDelete(event.id)}
                      className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
