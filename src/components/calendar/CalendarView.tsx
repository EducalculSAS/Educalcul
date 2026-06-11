"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getEventTypeMeta } from "@/lib/calendarEventTypes";
import { getHolidaysInRange } from "@/lib/schoolHolidays";

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string | null;
  event_type: string;
  start_date: string;
  end_date?: string | null;
  visible_to_child?: boolean;
  isVirtual?: boolean;
}

interface CalendarViewProps {
  events: CalendarEventItem[];
  globalEvents?: CalendarEventItem[];
  onDayClick?: (date: string) => void;
  onEventClick?: (event: CalendarEventItem) => void;
  showHolidays?: boolean;
  compact?: boolean;
}

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const toIso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function CalendarView({ events, globalEvents = [], onDayClick, onEventClick, showHolidays = true, compact = false }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  const allEvents: CalendarEventItem[] = useMemo(() => {
    const merged = [
      ...events,
      ...globalEvents.map(e => ({ ...e, id: `global-${e.id}`, isVirtual: true })),
    ];
    if (!showHolidays) return merged;
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const holidays = getHolidaysInRange(from, to).map(h => ({
      id: `holiday-${h.id}`,
      title: h.title,
      event_type: "vacances",
      start_date: h.start_date,
      end_date: h.end_date,
      isVirtual: true,
    }));
    return [...merged, ...holidays];
  }, [events, globalEvents, showHolidays, year, month]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    for (const ev of allEvents) {
      const start = ev.start_date;
      const end = ev.end_date || ev.start_date;
      const startDate = new Date(start + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!map[iso]) map[iso] = [];
        map[iso].push(ev);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [allEvents]);

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=Sun..6=Sat -> convert to Mon=0..Sun=6
  const startOffset = (firstOfMonth.getDay() + 6) % 7;

  const cells: { day: number | null; iso: string | null }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, iso: toIso(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  const goPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  };

  return (
    <div className={compact ? "" : "bg-white rounded-[20px] p-4 md:p-6 shadow-sm border border-[rgba(197,161,72,0.25)]"}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrev}
          className="p-1.5 rounded-full hover:bg-[rgba(197,161,72,0.1)] transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--greek-blue)]" />
        </button>
        <h3 className={`font-bold text-[var(--greek-blue)] ${compact ? "text-sm" : "text-lg"}`}>
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          onClick={goNext}
          className="p-1.5 rounded-full hover:bg-[rgba(197,161,72,0.1)] transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight className="w-4 h-4 text-[var(--greek-blue)]" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--greek-bronze)] py-1">
            {compact ? d[0] : d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={i} className={compact ? "min-h-[28px]" : "min-h-[70px] md:min-h-[90px]"} />;
          }
          const dayEvents = eventsByDay[cell.iso!] || [];
          const isToday = cell.iso === todayIso;
          if (compact) {
            return (
              <button
                key={i}
                onClick={() => onDayClick?.(cell.iso!)}
                className={`min-h-[28px] rounded-[8px] border flex flex-col items-center justify-center gap-0.5 transition-colors hover:bg-[rgba(197,161,72,0.08)] ${
                  isToday ? "border-[var(--greek-gold)] bg-[rgba(197,161,72,0.08)]" : "border-transparent"
                }`}
              >
                <span className={`text-[11px] font-semibold ${isToday ? "text-[var(--greek-gold)]" : "text-[var(--greek-blue)]"}`}>
                  {cell.day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="flex gap-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <span
                        key={ev.id + cell.iso}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: getEventTypeMeta(ev.event_type).color }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => onDayClick?.(cell.iso!)}
              className={`min-h-[70px] md:min-h-[90px] p-1 rounded-[10px] border text-left flex flex-col gap-0.5 transition-colors hover:bg-[rgba(197,161,72,0.08)] ${
                isToday
                  ? "border-[var(--greek-gold)] bg-[rgba(197,161,72,0.08)]"
                  : "border-transparent"
              }`}
            >
              <span className={`text-xs font-semibold ${isToday ? "text-[var(--greek-gold)]" : "text-[var(--greek-blue)]"}`}>
                {cell.day}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(ev => {
                  const meta = getEventTypeMeta(ev.event_type);
                  return (
                    <span
                      key={ev.id + cell.iso}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev);
                      }}
                      className="text-[10px] leading-tight px-1 py-0.5 rounded truncate"
                      style={{ backgroundColor: meta.color, color: meta.textColor }}
                      title={ev.title}
                    >
                      {ev.title}
                    </span>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-[var(--greek-bronze)]">+{dayEvents.length - 3}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
