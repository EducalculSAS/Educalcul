"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { getEventTypeMeta } from "@/lib/calendarEventTypes";
import {
  type CalendarEventItem, DAYS_SHORT, MONTHS, addDaysIso, fromIso, groupByDay, monthCells, relativeDay, toIso, todayIso,
} from "./calendarUtils";
import DayPanel from "./DayPanel";
import EventEditor, { type EventDraft } from "./EventEditor";
import GlassButton from "@/components/ui/GlassButton";

/**
 * Mini-calendrier des tableaux de bord : le mois en pastilles et les trois
 * prochains événements. Un clic sur un jour ouvre le même panneau du jour que
 * le grand calendrier (voir, cocher, ajouter), sans quitter le tableau de bord.
 */
export default function MiniCalendarWidget({
  ownerId, isParent, title = "Calendrier", fullCalendarHref,
}: {
  authId?: string;
  ownerId: number;
  isParent: boolean;
  title?: string;
  fullCalendarHref: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [globalEvents, setGlobalEvents] = useState<CalendarEventItem[]>([]);
  const [cursor, setCursor] = useState(todayIso());
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ event: CalendarEventItem | null; date: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/calendar/events?ownerId=${ownerId}`);
    if (!res.ok) return;
    const d = await res.json();
    setEvents(d.events ?? []);
    setGlobalEvents((d.globalEvents ?? []).map((g: CalendarEventItem) => ({ ...g, id: `global-${g.id}`, isVirtual: true })));
  }, [ownerId]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/calendar/events?ownerId=${ownerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setEvents(d.events ?? []);
        setGlobalEvents((d.globalEvents ?? []).map((g: CalendarEventItem) => ({ ...g, id: `global-${g.id}`, isVirtual: true })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ownerId]);

  const byDay = useMemo(() => groupByDay([...events, ...globalEvents]), [events, globalEvents]);
  const today = todayIso();
  const d = fromIso(cursor);
  const cells = monthCells(d.getFullYear(), d.getMonth());
  const next = events
    .filter((e) => e.start_date >= today && !e.completed_at)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3);

  const shift = (dir: -1 | 1) => {
    const nd = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    setCursor(toIso(nd.getFullYear(), nd.getMonth(), 1));
  };

  const save = async (draft: EventDraft) => {
    const editing = editor?.event;
    const res = await fetch(editing ? `/api/calendar/events/${editing.id}` : "/api/calendar/events", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, ownerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Enregistrement impossible");
      return false;
    }
    toast.success(editing ? "Événement modifié." : "Événement ajouté.");
    setEditor(null);
    await load();
    return true;
  };

  const remove = async (ev: CalendarEventItem) => {
    if (!(await confirm(`« ${ev.title} » sera supprimé.`, { title: "Supprimer l'événement ?", confirmLabel: "Supprimer" }))) return;
    const res = await fetch(`/api/calendar/events/${ev.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error((await res.json().catch(() => ({}))).error || "Suppression impossible");
    setEvents((l) => l.filter((e) => e.id !== ev.id));
  };

  const toggleDone = async (ev: CalendarEventItem) => {
    const completed = !ev.completed_at;
    setEvents((l) => l.map((e) => (e.id === ev.id ? { ...e, completed_at: completed ? new Date().toISOString() : null } : e)));
    const res = await fetch(`/api/calendar/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) load();
  };

  return (
    <div className="bg-white rounded-[20px] p-5 shadow-sm border border-[rgba(197,161,72,0.25)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[var(--greek-blue)] flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[var(--greek-gold)]" /> {title}</h3>
        <GlassButton href={fullCalendarHref} variant="outline" size="sm">
          Ouvrir <ArrowRight className="w-3.5 h-3.5" />
        </GlassButton>
      </div>

      <div className="flex items-center justify-between mb-2">
        <GlassIconButton icon={ChevronLeft} color="gray" size="sm" onClick={() => shift(-1)} aria-label="Mois précédent" />
        <span className="block text-sm font-bold text-[var(--greek-blue)] first-letter:uppercase">{MONTHS[d.getMonth()]} {d.getFullYear()}</span>
        <GlassIconButton icon={ChevronRight} color="gray" size="sm" onClick={() => shift(1)} aria-label="Mois suivant" />
      </div>
      <div className="grid grid-cols-7 text-center mb-1">
        {DAYS_SHORT.map((n) => <span key={n} className="text-[10px] font-bold text-[var(--greek-bronze)]">{n[0]}</span>)}
      </div>
      <div key={cursor.slice(0, 7)} className="grid grid-cols-7 gap-0.5 page-enter">
        {cells.map(({ iso, inMonth }) => {
          const list = byDay.get(iso) ?? [];
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDayOpen(iso)}
              aria-label={`${iso} : ${list.length} élément(s)`}
              className={`h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:bg-[rgba(197,161,72,0.2)] hover:shadow-[0_6px_14px_rgba(197,161,72,0.25)] hover:-translate-y-0.5 hover:scale-105 active:scale-95 ${inMonth ? "" : "opacity-35"} ${isToday ? "bg-[rgba(197,161,72,0.15)] ring-1 ring-[var(--greek-gold)]" : ""}`}
            >
              <span className={`text-[11px] font-semibold ${isToday ? "text-[var(--greek-bronze)]" : "text-[var(--greek-blue)]"}`}>{fromIso(iso).getDate()}</span>
              <span className="flex gap-0.5 h-1.5">
                {list.slice(0, 3).map((e) => <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: getEventTypeMeta(e.event_type).color }} />)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-[rgba(197,161,72,0.2)] space-y-1">
        {next.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Rien de prévu prochainement.</p>
        ) : next.map((ev) => (
          <button key={ev.id} type="button" onClick={() => setDayOpen(ev.start_date)} className="w-full text-left flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-[rgba(197,161,72,0.16)] hover:translate-x-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getEventTypeMeta(ev.event_type).color }} />
            <span className="text-sm font-medium text-[var(--greek-blue)] truncate flex-1">{ev.title}</span>
            <span className="text-[11px] text-[var(--text-muted)] shrink-0">{relativeDay(ev.start_date)}</span>
          </button>
        ))}
      </div>

      {dayOpen && (
        <DayPanel
          date={dayOpen}
          events={byDay.get(dayOpen) ?? []}
          onClose={() => setDayOpen(null)}
          onChangeDate={setDayOpen}
          onAdd={() => setEditor({ event: null, date: dayOpen })}
          onEdit={(ev) => setEditor({ event: ev, date: ev.start_date })}
          onDelete={remove}
          onToggleDone={toggleDone}
          canEdit={(ev) => !ev.isVirtual && (isParent || ev.created_by === ownerId)}
          courseHref={isParent ? undefined : (id) => `/child/cours/${id}`}
        />
      )}
      {editor && (
        <EventEditor
          event={editor.event}
          date={editor.date ?? addDaysIso(today, 0)}
          isParent={isParent}
          defaultOwnerId={ownerId}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
