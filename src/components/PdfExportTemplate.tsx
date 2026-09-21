import React, { forwardRef } from 'react';
import { StudyEvent } from '../types';

interface Props {
  events: StudyEvent[];
  dday: number;
  startDate: string;
}

export const PdfExportTemplate = forwardRef<HTMLDivElement, Props>(({ events, dday, startDate }, ref) => {
  // Group events by date
  const grouped = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, StudyEvent[]>);

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="absolute -left-[9999px] top-0">
      <div ref={ref} className="p-10 bg-white text-black w-[800px] min-h-[1122px] font-sans">
        <h1 className="text-3xl font-bold mb-2 text-center text-zinc-900">FocusFlow_AI 학습 플래너</h1>
        <p className="text-center text-zinc-500 mb-8">시작일: {startDate} | D-{dday}</p>

        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date} className="border-b border-zinc-200 pb-4">
              <h2 className="text-xl font-bold mb-3 text-primary-600">{date}</h2>
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100">
                    <th className="p-2 border border-zinc-300 w-1/4 font-semibold text-zinc-700">과목</th>
                    <th className="p-2 border border-zinc-300 w-1/2 font-semibold text-zinc-700">학습 내용</th>
                    <th className="p-2 border border-zinc-300 w-1/4 font-semibold text-zinc-700">소요 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[date].map(event => (
                    <tr key={event.id}>
                      <td className="p-2 border border-zinc-300 font-medium text-zinc-800">{event.subject}</td>
                      <td className="p-2 border border-zinc-300 text-zinc-700">
                        {event.task} <span className="text-xs text-zinc-500 ml-1">({event.phase})</span>
                        {event.referenceLink && (
                          <div className="text-[10px] text-primary-600 mt-1">
                            참고: {event.referenceLink}
                          </div>
                        )}
                      </td>
                      <td className="p-2 border border-zinc-300 text-zinc-700">{event.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
