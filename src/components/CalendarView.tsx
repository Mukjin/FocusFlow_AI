import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { usePlannerStore } from '../store/plannerStore';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, Circle, Calendar as CalendarIcon } from 'lucide-react';
import DayDetailPanel from './DayDetailPanel';
import { DURATION, EASE_OUT, STAGGER, SPRING } from '../lib/motion';
import { parseDurationToMinutes, formatMinutesToDuration } from '../lib/duration';

const COLORS = [
  'bg-red-50 text-red-700 border-l-4 border-l-red-500 border-y border-r border-transparent dark:bg-red-500/10 dark:text-red-300 dark:border-l-red-500',
  'bg-blue-50 text-blue-700 border-l-4 border-l-blue-500 border-y border-r border-transparent dark:bg-blue-500/10 dark:text-blue-300 dark:border-l-blue-500',
  'bg-green-50 text-green-700 border-l-4 border-l-green-500 border-y border-r border-transparent dark:bg-green-500/10 dark:text-green-300 dark:border-l-green-500',
  'bg-yellow-50 text-yellow-700 border-l-4 border-l-yellow-500 border-y border-r border-transparent dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-l-yellow-500',
  'bg-purple-50 text-purple-700 border-l-4 border-l-purple-500 border-y border-r border-transparent dark:bg-purple-500/10 dark:text-purple-300 dark:border-l-purple-500',
  'bg-pink-50 text-pink-700 border-l-4 border-l-pink-500 border-y border-r border-transparent dark:bg-pink-500/10 dark:text-pink-300 dark:border-l-pink-500',
  'bg-primary-50 text-primary-700 border-l-4 border-l-primary-500 border-y border-r border-transparent dark:bg-primary-500/10 dark:text-primary-300 dark:border-l-primary-500',
  'bg-orange-50 text-orange-700 border-l-4 border-l-orange-500 border-y border-r border-transparent dark:bg-orange-500/10 dark:text-orange-300 dark:border-l-orange-500',
];

export default function CalendarView() {
  const store = usePlannerStore();
  const [currentDate, setCurrentDate] = useState(new Date(store.startDate || new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Resize state
  const [resizingEventId, setResizingEventId] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState<number>(0);
  const [originalDurationMinutes, setOriginalDurationMinutes] = useState<number>(0);
  const [currentDurationMinutes, setCurrentDurationMinutes] = useState<number>(0);

  const next = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };
  const prev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const handleDragStart = (e: React.DragEvent, eventId: number) => {
    e.dataTransfer.setData('eventId', eventId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const eventId = parseInt(e.dataTransfer.getData('eventId'), 10);
    if (!isNaN(eventId)) {
      const dateString = format(date, 'yyyy-MM-dd');
      store.updateEvent(eventId, { date: dateString });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, event: typeof store.events[0]) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingEventId(event.id);
    setResizeStartX(e.clientX);
    const mins = parseDurationToMinutes(event.duration) || 60;
    setOriginalDurationMinutes(mins);
    setCurrentDurationMinutes(mins);
  };

  useEffect(() => {
    if (resizingEventId === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX;
      const deltaMinutes = Math.round(deltaX / 5) * 15; // 15 mins per 5 pixels
      let newMinutes = originalDurationMinutes + deltaMinutes;
      if (newMinutes < 15) newMinutes = 15;
      setCurrentDurationMinutes(newMinutes);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX;
      const deltaMinutes = Math.round(deltaX / 5) * 15;
      let newMinutes = originalDurationMinutes + deltaMinutes;
      if (newMinutes < 15) newMinutes = 15;
      
      store.updateEvent(resizingEventId, { duration: formatMinutesToDuration(newMinutes) });
      setResizingEventId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingEventId, resizeStartX, originalDurationMinutes, store]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = viewMode === 'month' ? startOfWeek(monthStart) : startOfWeek(currentDate);
  const endDate = viewMode === 'month' ? endOfWeek(monthEnd) : endOfWeek(currentDate);

  const headerTitle = viewMode === 'month' 
    ? format(currentDate, 'yyyy년 M월')
    : `${format(startDate, 'M월 d일')} - ${format(endDate, 'M월 d일')}`;

  const dateFormat = 'd';
  // 날짜 셀을 가로지르며 칩이 순서대로 등장하도록 렌더 단위 러닝 인덱스를 쓴다
  let chipIndex = 0;
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = '';

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof store.events>();
    store.events.forEach(event => {
      const existing = map.get(event.date) || [];
      map.set(event.date, [...existing, event]);
    });
    return map;
  }, [store.events]);

  if (store.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80">
        <div className="w-20 h-20 mb-6 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <CalendarIcon className="w-10 h-10 text-primary-500 dark:text-primary-400" />
        </div>
        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">등록된 일정이 없습니다</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm text-center">
          플랜 설정 탭에서 새로운 학습 계획을 생성하고<br/>캘린더에서 일정을 관리해보세요.
        </p>
      </div>
    );
  }

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const dateKey = format(cloneDay, 'yyyy-MM-dd');
      const dayEvents = eventsByDate.get(dateKey) || [];
      const isToday = isSameDay(day, new Date());
      const isSelected = selectedDate && isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);

      days.push(
        <div
          key={day.toString()}
          onClick={() => setSelectedDate(cloneDay)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, cloneDay)}
          className={`flex flex-col p-2 border-r border-b border-zinc-100 dark:border-zinc-800/50 transition-all cursor-pointer relative group
            ${viewMode === 'month' ? 'min-h-[140px]' : 'min-h-[200px] h-full'}
            ${!isCurrentMonth && viewMode === 'month' ? 'bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-400' : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'}
            ${isSelected ? 'ring-2 ring-inset ring-primary-500 bg-primary-50/10 dark:bg-primary-900/10 z-10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}
          `}
        >
          <div className="flex justify-between items-start flex-shrink-0 mb-1.5">
            <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-primary-600 text-white shadow-md' : isSelected ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300' : ''}`}>
              {formattedDate}
            </span>
            {dayEvents.length > 0 && (
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1 mr-1">
                {dayEvents.length}개
              </span>
            )}
          </div>
          <div className={`flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 ${viewMode === 'month' ? 'max-h-[105px]' : ''}`}>
            {dayEvents.slice(0, viewMode === 'month' ? 3 : undefined).map((event) => {
              const isResizing = resizingEventId === event.id;
              const displayDuration = isResizing 
                ? formatMinutesToDuration(currentDurationMinutes) 
                : event.duration;

              const myChipIndex = chipIndex++;
              return (
              <motion.div 
                key={event.id} 
                draggable={!isResizing}
                onDragStart={(e: React.DragEvent) => {
                  if (!isResizing) handleDragStart(e, event.id);
                }}
                initial={{ opacity: 0, scale: 0.9, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: DURATION.base, ease: EASE_OUT, delay: Math.min(myChipIndex * STAGGER.dense, 1.1) }}
                whileHover={isResizing ? undefined : { scale: 1.03, transition: SPRING }}
                className={`group/event relative text-xs px-2 py-1.5 rounded-md ${COLORS[event.colorIndex % COLORS.length]} ${event.completed ? 'opacity-50 grayscale-[0.5]' : 'hover:shadow-sm'} ${isResizing ? 'ring-2 ring-primary-500 z-20 scale-105 shadow-md' : 'cursor-grab active:cursor-grabbing'}`}
                title={`${event.task} (${displayDuration})`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        store.toggleEventCompletion(event.id);
                      }}
                      className="flex-shrink-0 hover:scale-110 transition-transform focus:outline-none"
                    >
                      {event.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                      )}
                    </button>
                    <span className={`font-semibold truncate ${event.completed ? 'line-through opacity-70' : ''}`}>
                      {event.subject}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] opacity-70 whitespace-nowrap font-medium bg-black/5 dark:bg-white/10 px-1 rounded">{displayDuration}</span>
                    {event.aiEnhanced && <Sparkles className="w-3 h-3 flex-shrink-0 text-amber-500" />}
                  </div>
                </div>

                {/* Resize Handle */}
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/event:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-r transition-opacity"
                  onMouseDown={(e) => handleResizeStart(e, event)}
                />
              </motion.div>
            )})}
            {viewMode === 'month' && dayEvents.length > 3 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDate(cloneDay);
                }}
                className="text-[10px] font-bold text-center py-1.5 mt-0.5 text-zinc-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-md transition-colors w-full"
              >
                + {dayEvents.length - 3}개 더보기
              </button>
            )}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className={`grid grid-cols-7 ${viewMode === 'week' ? 'h-full' : ''}`} key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-full">
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 min-w-[140px] tracking-tight">
              {headerTitle}
            </h2>
            <div className="hidden sm:flex bg-zinc-100/80 dark:bg-zinc-800/80 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('month')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${viewMode === 'month' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
              >
                월간
              </button>
              <button 
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${viewMode === 'week' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
              >
                주간
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            <div className="text-sm text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/30 px-4 py-2 rounded-full border border-primary-100 dark:border-primary-800/50">
              D-{store.dday} 프로젝트
            </div>
            <div className="flex items-center bg-zinc-100/80 dark:bg-zinc-800/80 rounded-xl p-1">
              <button onClick={prev} className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors shadow-sm hover:shadow">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goToday} className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors">
                오늘
              </button>
              <button onClick={next} className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors shadow-sm hover:shadow">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div
          key={store.planVersion}
          className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-800/50 gap-[1px] flex flex-col"
        >
          {rows}
        </div>
      </div>

      {/* Side Panel */}
      {selectedDate && (
        <div className="w-full lg:w-80 flex-shrink-0 animate-in slide-in-from-right-4 duration-300 border-l border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
          <DayDetailPanel 
            date={selectedDate} 
            events={eventsByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []} 
            onClose={() => setSelectedDate(null)}
          />
        </div>
      )}
    </div>
  );
}
