import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlannerStore } from '../store/plannerStore';
import { format, isAfter, parseISO, startOfDay, addDays } from 'date-fns';
import { Sparkles, CheckCircle2, Circle, Clock, Calendar as CalendarIcon, GripVertical, Inbox, ExternalLink, Repeat } from 'lucide-react';
import { StudyEvent } from '../types';
import { DURATION, EASE_OUT, SPRING } from '../lib/motion';
import { seriesColor } from '../lib/palette';


type ColumnType = 'upcoming' | 'today' | 'done';

export default function KanbanView() {
  const store = usePlannerStore();
  const [draggedEventId, setDraggedEventId] = useState<number | null>(null);

  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');

  const columns = useMemo(() => {
    const cols: Record<ColumnType, StudyEvent[]> = {
      upcoming: [],
      today: [],
      done: []
    };

    store.events.forEach(event => {
      if (event.completed) {
        cols.done.push(event);
      } else {
        const eventDate = parseISO(event.date);
        if (isAfter(eventDate, today)) {
          cols.upcoming.push(event);
        } else {
          cols.today.push(event);
        }
      }
    });

    // Sort by date and time
    const sortFn = (a: StudyEvent, b: StudyEvent) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '').localeCompare(b.startTime || '');
    };

    cols.upcoming.sort(sortFn);
    cols.today.sort(sortFn);
    cols.done.sort((a, b) => sortFn(b, a)); // Reverse sort for done (newest first)

    return cols;
  }, [store.events, today]);

  const handleDragStart = (e: React.DragEvent, eventId: number) => {
    e.dataTransfer.setData('eventId', eventId.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedEventId(eventId);
  };

  const handleDragEnd = () => {
    setDraggedEventId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, column: ColumnType) => {
    e.preventDefault();
    const eventId = parseInt(e.dataTransfer.getData('eventId'), 10);
    if (isNaN(eventId)) return;

    const event = store.events.find(ev => ev.id === eventId);
    if (!event) return;

    const updates: Partial<StudyEvent> = {};

    if (column === 'done') {
      if (!event.completed) updates.completed = true;
    } else if (column === 'today') {
      if (event.completed) updates.completed = false;
      if (event.date !== todayStr) updates.date = todayStr;
    } else if (column === 'upcoming') {
      if (event.completed) updates.completed = false;
      const eventDate = parseISO(event.date);
      // If it's today or past, move it to tomorrow
      if (!isAfter(eventDate, today)) {
        updates.date = tomorrowStr;
      }
    }

    if (Object.keys(updates).length > 0) {
      store.updateEvent(eventId, updates);
    }
    setDraggedEventId(null);
  };

  const renderEventCard = (event: StudyEvent) => (
    <motion.div
      key={event.id}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: DURATION.fast } }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      whileHover={{ y: -3, transition: SPRING }}
      draggable
      onDragStart={(e: React.DragEvent) => handleDragStart(e, event.id)}
      onDragEnd={handleDragEnd}
      className={`group relative p-4 mb-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800/50 ${
        draggedEventId === event.id ? 'opacity-40 scale-95 shadow-inner' : 'opacity-100'
      } ${event.completed ? 'opacity-60 grayscale-[0.3]' : ''}`}
    >
      <div className="absolute top-1/2 -translate-y-1/2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="p-1 bg-white dark:bg-zinc-800 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-700 text-zinc-400">
          <GripVertical className="w-3 h-3" />
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 overflow-hidden flex-1">
          <button 
            onClick={() => store.toggleEventCompletion(event.id)}
            className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform text-zinc-300 hover:text-primary-600 dark:text-zinc-600 dark:hover:text-primary-400"
          >
            {event.completed ? (
              <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <span className={`flex items-center gap-2 font-bold text-[15px] leading-snug text-zinc-900 dark:text-zinc-100 ${event.completed ? 'line-through text-zinc-500 dark:text-zinc-400' : ''}`}>
              <span
                aria-hidden
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: event.isReview ? 'var(--color-zinc-400)' : seriesColor(event.colorIndex) }}
              />
              <span className="truncate">{event.subject}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] px-2 py-0.5 rounded-md font-semibold whitespace-nowrap bg-zinc-100 dark:bg-white/[0.07] text-zinc-600 dark:text-zinc-300">
              {event.isReview && <Repeat className="w-3 h-3" />}
              {event.isReview ? '복습' : event.phase}
            </span>
          </div>
        </div>
      </div>
      
      <p className={`text-[13px] leading-relaxed mb-4 line-clamp-3 ${event.completed ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-600 dark:text-zinc-300'}`}>
        {event.task}
      </p>
      
      {event.referenceLink && (
        <a 
          href={event.referenceLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded border border-primary-100 dark:border-primary-800/30 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors mb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          레퍼런스
        </a>
      )}
      
      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/50 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{format(parseISO(event.date), 'M/d')}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
            <Clock className="w-3.5 h-3.5" />
            <span>{event.duration}</span>
          </div>
        </div>
        {event.aiEnhanced && (
          <div className="flex items-center gap-1 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-md">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] font-bold">AI</span>
          </div>
        )}
      </div>
    </motion.div>
  );

  if (store.events.length === 0) {
    return (
      <div className="h-full m-6 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50">
        <div className="w-20 h-20 mb-6 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center">
          <Inbox className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
        </div>
        <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300 mb-2">등록된 일정이 없습니다</p>
        <p className="text-sm">새로운 일정을 추가하여 보드를 채워보세요.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 overflow-x-auto p-6">
      {/* Upcoming Column */}
      <div 
        className="flex-1 min-w-[320px] max-w-[400px] flex flex-col bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden shadow-sm"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'upcoming')}
      >
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30"></div>
            예정된 할 일
          </h3>
          <span className="text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2.5 py-1 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-700">
            {columns.upcoming.length}
          </span>
        </div>
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          <AnimatePresence initial={false}>{columns.upcoming.map(renderEventCard)}</AnimatePresence>
          {columns.upcoming.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center text-sm text-zinc-400 dark:text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/50 dark:bg-zinc-900/50">
              <Inbox className="w-6 h-6 mb-2 opacity-50" />
              예정된 일정이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Today Column */}
      <div 
        className="flex-1 min-w-[320px] max-w-[400px] flex flex-col bg-primary-50/50 dark:bg-primary-900/10 backdrop-blur-xl rounded-3xl border border-primary-100 dark:border-primary-900/30 overflow-hidden shadow-sm ring-1 ring-primary-500/5 dark:ring-primary-500/10"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'today')}
      >
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-primary-900 dark:text-primary-200 flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-sm shadow-primary-500/30"></div>
            오늘 할 일
          </h3>
          <span className="text-xs font-bold bg-white dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 px-2.5 py-1 rounded-full shadow-sm border border-primary-100 dark:border-primary-800/50">
            {columns.today.length}
          </span>
        </div>
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          <AnimatePresence initial={false}>{columns.today.map(renderEventCard)}</AnimatePresence>
          {columns.today.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center text-sm text-primary-400/60 dark:text-primary-500/60 border-2 border-dashed border-primary-200 dark:border-primary-800/50 rounded-2xl bg-white/50 dark:bg-primary-900/20">
              <Inbox className="w-6 h-6 mb-2 opacity-50" />
              오늘 할 일이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Done Column */}
      <div 
        className="flex-1 min-w-[320px] max-w-[400px] flex flex-col bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden shadow-sm"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, 'done')}
      >
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30"></div>
            완료
          </h3>
          <span className="text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2.5 py-1 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-700">
            {columns.done.length}
          </span>
        </div>
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          <AnimatePresence initial={false}>{columns.done.map(renderEventCard)}</AnimatePresence>
          {columns.done.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center text-sm text-zinc-400 dark:text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/50 dark:bg-zinc-900/50">
              <Inbox className="w-6 h-6 mb-2 opacity-50" />
              완료된 일정이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

