import React, { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlannerStore } from '../store/plannerStore';
import { StudyEvent } from '../types';
import { X, Plus, Trash2, Edit2, Sparkles, ExternalLink } from 'lucide-react';

interface Props {
  date: Date;
  events: StudyEvent[];
  onClose: () => void;
}

export default function DayDetailPanel({ date, events, onClose }: Props) {
  const store = usePlannerStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [editForm, setEditForm] = useState<Partial<StudyEvent>>({});

  const handleEdit = (event: StudyEvent) => {
    setEditingId(event.id);
    setEditForm(event);
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.subject && editForm.task) {
      store.updateEvent(editingId, editForm);
      setEditingId(null);
    }
  };

  const handleAdd = () => {
    if (editForm.subject && editForm.task) {
      store.addEvent({
        date: format(date, 'yyyy-MM-dd'),
        startTime: editForm.startTime || '09:00',
        endTime: editForm.endTime || '10:00',
        subject: editForm.subject,
        task: editForm.task,
        duration: editForm.duration || '1시간',
        phase: editForm.phase || '기초',
        colorIndex: store.goals.indexOf(editForm.subject) !== -1 ? store.goals.indexOf(editForm.subject) : 0,
        aiEnhanced: false,
        referenceLink: editForm.referenceLink
      });
      setIsAdding(false);
      setEditForm({});
    }
  };

  // 브라우저 기본 confirm 은 화면 전체를 막고 스타일도 맞지 않는다.
  // 한 번 더 누르면 지워지는 인라인 확인으로 바꾼다.
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const handleDelete = (id: number) => {
    if (confirmingId === id) {
      store.deleteEvent(id);
      setConfirmingId(null);
      return;
    }
    setConfirmingId(id);
    window.setTimeout(() => setConfirmingId((c) => (c === id ? null : c)), 3000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {format(date, 'M월 d일 (EEEE)', { locale: ko })}
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {events.length === 0 && !isAdding && (
          <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
            일정이 없습니다.
          </div>
        )}

        {events.map((event) => (
          <div key={event.id} className="bg-white dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-shadow">
            {editingId === event.id ? (
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={editForm.subject || ''} 
                  onChange={e => setEditForm({...editForm, subject: e.target.value})}
                  className="w-full text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="과목명"
                />
                <textarea 
                  value={editForm.task || ''} 
                  onChange={e => setEditForm({...editForm, task: e.target.value})}
                  className="w-full text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 resize-none focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="할 일"
                />
                <input 
                  type="url"
                  value={editForm.referenceLink || ''} 
                  onChange={e => setEditForm({...editForm, referenceLink: e.target.value})}
                  className="w-full text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="레퍼런스 링크 (선택)"
                />
                <div className="flex gap-2">
                  <input 
                    type="time" 
                    value={editForm.startTime || ''} 
                    onChange={e => setEditForm({...editForm, startTime: e.target.value})}
                    className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  />
                  <input 
                    type="time" 
                    value={editForm.endTime || ''} 
                    onChange={e => setEditForm({...editForm, endTime: e.target.value})}
                    className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editForm.duration || ''} 
                    onChange={e => setEditForm({...editForm, duration: e.target.value})}
                    className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    placeholder="소요 시간"
                  />
                  <select 
                    value={editForm.phase || '기초'} 
                    onChange={e => setEditForm({...editForm, phase: e.target.value as any})}
                    className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="기초">기초</option>
                    <option value="심화">심화</option>
                    <option value="마무리">마무리</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">취소</button>
                  <button onClick={handleSaveEdit} className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm">저장</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-2.5 py-1 rounded-lg border border-primary-100 dark:border-primary-800/50">
                      {event.subject}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{event.phase}</span>
                    {event.aiEnhanced && (
                      <span className="flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                        <Sparkles className="w-3 h-3 mr-1" /> AI
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(event)} className="p-1.5 text-zinc-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className={`rounded-lg transition-colors ${
                        confirmingId === event.id
                          ? 'px-2 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700'
                          : 'p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                      }`}
                      aria-label={confirmingId === event.id ? '한 번 더 누르면 삭제됩니다' : '일정 삭제'}
                    >
                      {confirmingId === event.id ? '삭제' : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-zinc-800 dark:text-zinc-200 mb-3 leading-relaxed font-medium">{event.task}</p>
                {event.referenceLink && (
                  <a 
                    href={event.referenceLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1.5 rounded-lg border border-primary-100 dark:border-primary-800/30 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors mb-3"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    레퍼런스 보기
                  </a>
                )}
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-lg inline-flex">
                  {event.startTime && event.endTime && (
                    <span>🕒 {event.startTime} - {event.endTime}</span>
                  )}
                  <span className="text-zinc-400 dark:text-zinc-500">|</span>
                  <span>⏱ {event.duration}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-4 border-2 border-primary-200 dark:border-primary-800/50 shadow-md">
            <div className="space-y-3">
              <input 
                type="text" 
                value={editForm.subject || ''} 
                onChange={e => setEditForm({...editForm, subject: e.target.value})}
                className="w-full text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                placeholder="과목명"
              />
              <textarea 
                value={editForm.task || ''} 
                onChange={e => setEditForm({...editForm, task: e.target.value})}
                className="w-full text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 resize-none focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                placeholder="할 일"
              />
              <input 
                type="url"
                value={editForm.referenceLink || ''} 
                onChange={e => setEditForm({...editForm, referenceLink: e.target.value})}
                className="w-full text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                placeholder="레퍼런스 링크 (선택)"
              />
              <div className="flex gap-2">
                <input 
                  type="time" 
                  value={editForm.startTime || ''} 
                  onChange={e => setEditForm({...editForm, startTime: e.target.value})}
                  className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
                <input 
                  type="time" 
                  value={editForm.endTime || ''} 
                  onChange={e => setEditForm({...editForm, endTime: e.target.value})}
                  className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={editForm.duration || ''} 
                  onChange={e => setEditForm({...editForm, duration: e.target.value})}
                  className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  placeholder="소요 시간 (예: 1시간)"
                />
                <select 
                  value={editForm.phase || '기초'} 
                  onChange={e => setEditForm({...editForm, phase: e.target.value as any})}
                  className="w-1/2 text-sm p-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                >
                  <option value="기초">기초</option>
                  <option value="심화">심화</option>
                  <option value="마무리">마무리</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => {setIsAdding(false); setEditForm({});}} className="px-4 py-2 text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">취소</button>
                <button onClick={handleAdd} className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm">추가</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isAdding && (
        <div className="p-5 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button 
            onClick={() => { setIsAdding(true); setEditForm({ duration: store.timePerDay, phase: '기초' }); }}
            className="w-full py-3 flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-bold transition-all shadow-sm border border-zinc-200 dark:border-zinc-700"
          >
            <Plus className="w-5 h-5" />
            새 일정 추가
          </button>
        </div>
      )}
    </div>
  );
}
