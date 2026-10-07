"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, EyeOff, Sparkles,
} from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { getEventTypeMeta } from "@/lib/calendarEventTypes";
import { STUDENT_ZONE_OPTIONS } from "@/lib/calendarZones";
import {
  type CalendarEventItem, DAYS_SHORT, MONTHS, MONTHS_SHORT, addDaysIso, daysUntil, fromIso, groupByDay, longDate, monthCells,
  relativeDay, timeLabel, toIso, todayIso, weekStart,
} from "./calendarUtils";
import DayPanel from "./DayPanel";
import EventEditor, { type EventDraft } from "./EventEditor";
import AiPlanDialog from "./AiPlanDialog";

type View = "month" | "week" | "list";
const FAMILY = -1;

const FILTERS: { id: string; label: string }[] = [
  { id: "controle", label: "Contrôles" },
  { id: "devoir", label: "Devoirs" },
  { id: "revision", label: "Révisions" },
  { id: "event", label: "Événements" },
  { id: "vacances", label: "Vacances" },
  { id: "abonnement", label: "Abonnement" },
];

/**
 * Calendrier scolaire — le même pour l'élève et le parent.
 * Vues mois / semaine / liste, filtres par type, panneau du jour au clic sur
 * une date, événements à heure précise, répétition hebdomadaire, « fait » à
 * cocher, plan de révision IA validé séance par séance, vue famille pour le
 * parent, compte à rebours du prochain contrôle.
 */
export default function CalendarApp({
  role, meId, owners, initialOwnerId, initialEvents, initialGlobalEvents, initialZone, extraEvents = [],
}: {
  role: "child" | "parent";
  meId: number;
  owners: { id: number; name: string }[];
  initialOwnerId: number;
  initialEvents: CalendarEventItem[];
  initialGlobalEvents: CalendarEventItem[];
  initialZone: string;
  /** Événements calculés (ex. échéance d'abonnement du parent). */
  extraEvents?: CalendarEventItem[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const isParent = role === "parent";

  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [events, setEvents] = useState<CalendarEventItem[]>(initialEvents);
  const [globalEvents, setGlobalEvents] = useState<CalendarEventItem[]>(initialGlobalEvents);
  const [zone, setZone] = useState(initialZone);
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(todayIso());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hideDone, setHideDone] = useState(false);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ event: CalendarEventItem | null; date: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const ownerName = useCallback((id: number) => owners.find((o) => o.id === id)?.name ?? "", [owners]);
  const studentOwners = owners.filter((o) => o.id !== meId || !isParent);

  // ── Chargement ─────────────────────────────────────────────────
  const fetchOwner = useCallback(async (id: number) => {
    const res = await fetch(`/api/calendar/events?ownerId=${id}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Chargement impossible");
    return res.json() as Promise<{ events: CalendarEventItem[]; globalEvents: CalendarEventItem[]; schoolZone: string }>;
  }, []);

  const reload = useCallback(async (id: number = ownerId) => {
    try {
      if (id === FAMILY) {
        const all = await Promise.all(owners.map((o) => fetchOwner(o.id).then((d) => ({ o, d }))));
        setEvents(all.flatMap(({ o, d }) => d.events.map((e) => ({ ...e, ownerName: o.name }))));
        setGlobalEvents(all[0]?.d.globalEvents ?? []);
      } else {
        const d = await fetchOwner(id);
        setEvents(d.events);
        setGlobalEvents(d.globalEvents);
        setZone(d.schoolZone || "C");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [fetchOwner, owners, ownerId, toast]);

  const switchOwner = (id: number) => {
    setOwnerId(id);
    reload(id);
  };

  // ── Données affichées ──────────────────────────────────────────
  const allEvents = useMemo(() => {
    const holidays = globalEvents.map((g) => ({ ...g, id: `global-${g.id}`, event_type: g.event_type || "vacances", isVirtual: true }));
    const extra = ownerId === meId || ownerId === FAMILY ? extraEvents : [];
    return [...events, ...holidays, ...extra].filter(
      (e) => !hidden.has(e.event_type) && !(hideDone && e.completed_at),
    );
  }, [events, globalEvents, extraEvents, hidden, hideDone, ownerId, meId]);

  const byDay = useMemo(() => groupByDay(allEvents), [allEvents]);
  const today = todayIso();

  const upcoming = useMemo(
    () => events
      .filter((e) => e.start_date >= today && e.start_date <= addDaysIso(today, 14) && !e.completed_at)
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
      .slice(0, 8),
    [events, today],
  );
  const nextTest = useMemo(
    () => events.filter((e) => e.event_type === "controle" && e.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0],
    [events, today],
  );
  const week = useMemo(() => {
    const start = weekStart(today);
    const end = addDaysIso(start, 6);
    const revs = events.filter((e) => (e.event_type === "revision" || e.event_type === "devoir") && e.start_date >= start && e.start_date <= end);
    return { done: revs.filter((e) => e.completed_at).length, total: revs.length };
  }, [events, today]);

  // ── Navigation ─────────────────────────────────────────────────
  const d = fromIso(cursor);
  const periodLabel = view === "week"
    ? (() => {
        const s = weekStart(cursor);
        const e = addDaysIso(s, 6);
        const sd = fromIso(s), ed = fromIso(e);
        return sd.getMonth() === ed.getMonth()
          ? `${sd.getDate()} – ${ed.getDate()} ${MONTHS[ed.getMonth()]} ${ed.getFullYear()}`
          : `${sd.getDate()} ${MONTHS[sd.getMonth()].slice(0, 4)}. – ${ed.getDate()} ${MONTHS[ed.getMonth()].slice(0, 4)}. ${ed.getFullYear()}`;
      })()
    : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const move = (dir: -1 | 1) => {
    if (view === "week") {
      setCursor(addDaysIso(cursor, 7 * dir));
    } else {
      const nd = new Date(d.getFullYear(), d.getMonth() + dir, 1);
      setCursor(toIso(nd.getFullYear(), nd.getMonth(), 1));
    }
  };

  // ── Actions ────────────────────────────────────────────────────
  const canEdit = useCallback(
    (ev: CalendarEventItem) => !ev.isVirtual && (isParent || ev.created_by === meId),
    [isParent, meId],
  );

  const saveEvent = async (draft: EventDraft): Promise<boolean> => {
    const editing = editor?.event;
    const body = { ...draft, ownerId: ownerId === FAMILY ? draft.ownerId : ownerId };
    const res = await fetch(editing ? `/api/calendar/events/${editing.id}` : "/api/calendar/events", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Enregistrement impossible");
      return false;
    }
    toast.success(editing ? "Événement modifié." : draft.repeatWeeks > 1 ? `${draft.repeatWeeks} événements ajoutés.` : "Événement ajouté.");
    setEditor(null);
    await reload();
    return true;
  };

  const deleteEvent = async (ev: CalendarEventItem) => {
    if (!(await confirm(`« ${ev.title} » sera supprimé.`, { title: "Supprimer l'événement ?", confirmLabel: "Supprimer" }))) return;
    const res = await fetch(`/api/calendar/events/${ev.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error || "Suppression impossible");
      return;
    }
    setEvents((list) => list.filter((e) => e.id !== ev.id));
    toast.success("Événement supprimé.");
  };

  const toggleDone = async (ev: CalendarEventItem) => {
    const completed = !ev.completed_at;
    setEvents((list) => list.map((e) => (e.id === ev.id ? { ...e, completed_at: completed ? new Date().toISOString() : null } : e)));
    const res = await fetch(`/api/calendar/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) {
      setEvents((list) => list.map((e) => (e.id === ev.id ? { ...e, completed_at: ev.completed_at } : e)));
      toast.error("Impossible d'enregistrer.");
    } else if (completed) toast.success("Bravo, c'est fait !");
  };

  const acceptPlan = async (sessions: any[]): Promise<boolean> => {
    const target = ownerId === FAMILY ? studentOwners[0]?.id : ownerId;
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: target, events: sessions.map((s) => ({ ...s, source: "ai" })) }),
    });
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error || "Ajout impossible");
      return false;
    }
    toast.success(`${sessions.length} séance${sessions.length > 1 ? "s" : ""} de révision ajoutée${sessions.length > 1 ? "s" : ""}.`);
    setAiOpen(false);
    await reload();
    return true;
  };

  const changeZone = async (z: string) => {
    setZone(z);
    const res = await fetch("/api/calendar/zone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId, zone: z }),
    });
    if (res.ok) reload();
  };

  const exportIcs = async () => {
    const res = await fetch(`/api/calendar/export?ownerId=${ownerId === FAMILY ? meId : ownerId}`);
    if (!res.ok) return toast.error("Export impossible.");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: "educalcul-calendrier.ics" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Échap : fermer / flèches : naviguer (quand aucune fenêtre n'est ouverte).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dayOpen || editor || aiOpen) return;
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const planTarget = isParent ? (ownerId !== meId && ownerId !== FAMILY ? ownerId : null) : meId;
  const courseHref = role === "child" ? (id: number) => `/child/cours/${id}` : undefined;
  const filterOptions = FILTERS.filter((f) => isParent || f.id !== "abonnement");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
      <section className="min-w-0 space-y-4">
        {/* Barre d'outils */}
        <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {view === "list" ? (
              <h2 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)]">Les 3 prochains mois</h2>
            ) : (
              <div className="flex items-center gap-2">
                <GlassIconButton icon={ChevronLeft} color="gray" size="sm" onClick={() => move(-1)} aria-label="Période précédente" />
                <h2 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] min-w-[11rem] text-center  first-letter:uppercase">{periodLabel}</h2>
                <GlassIconButton icon={ChevronRight} color="gray" size="sm" onClick={() => move(1)} aria-label="Période suivante" />
                <GlassButton variant="ghost" size="sm" onClick={() => setCursor(today)}>Aujourd&apos;hui</GlassButton>
              </div>
            )}
            <GlassSegmentedControl
              size="sm"
              value={view}
              onChange={(v) => setView(v as View)}
              options={[{ id: "month", label: "Mois" }, { id: "week", label: "Semaine" }, { id: "list", label: "À venir" }]}
            />
          </div>

          {isParent && owners.length > 1 && (
            <GlassSegmentedControl
              size="sm"
              nowrap
              value={String(ownerId)}
              onChange={(v) => switchOwner(Number(v))}
              options={[...owners.map((o) => ({ id: String(o.id), label: o.id === meId ? "Mon calendrier" : o.name })), { id: String(FAMILY), label: "Toute la famille" }]}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par type">
              {filterOptions.map((f) => {
                const meta = getEventTypeMeta(f.id);
                const on = !hidden.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${on ? "border-transparent" : "border-gray-200 opacity-50 line-through"}`}
                    style={on ? { background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color.startsWith("var") ? "var(--greek-blue)" : meta.color } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} /> {f.label}
                  </button>
                );
              })}
              <GlassButton onClick={() => setHideDone((v) => !v)} variant={hideDone ? "navy" : "ghost"} size="sm">
                {hideDone ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {hideDone ? "Faits masqués" : "Masquer les faits"}
              </GlassButton>
            </div>
            <div className="flex flex-wrap gap-2">
              {planTarget && (
                <GlassButton variant="outline" size="sm" onClick={() => setAiOpen(true)}>
                  <Sparkles className="w-4 h-4" /> Planifier mes révisions
                </GlassButton>
              )}
              <GlassButton variant="navy" size="sm" onClick={() => setEditor({ event: null, date: dayOpen ?? (cursor >= today ? cursor : today) })}>
                <CalendarPlus className="w-4 h-4" /> Ajouter
              </GlassButton>
            </div>
          </div>
        </div>

        {/* Vues */}
        <div key={`${view}-${view === "week" ? weekStart(cursor) : cursor.slice(0, 7)}`} className="page-enter">
          {view === "month" && (
            <MonthGrid cursor={cursor} byDay={byDay} today={today} onOpenDay={setDayOpen} />
          )}
          {view === "week" && (
            <WeekGrid start={weekStart(cursor)} byDay={byDay} today={today} onOpenDay={setDayOpen} onToggleDone={toggleDone} />
          )}
          {view === "list" && (
            <ListView byDay={byDay} from={today} onOpenDay={setDayOpen} />
          )}
        </div>
      </section>

      {/* Colonne « à venir » */}
      <aside className="space-y-4 lg:sticky lg:top-[calc(var(--nav-h)+1rem)]">
        {nextTest && (
          <div className="rounded-3xl p-5 text-white shadow-md" style={{ background: "linear-gradient(135deg, var(--greek-blue), #1e3a6a)" }}>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--greek-gold)] flex items-center gap-1.5"><AlarmClock className="w-4 h-4" /> Prochain contrôle</p>
            <p className="font-bold text-lg mt-2 leading-snug">{nextTest.title}</p>
            <p className="text-sm text-white/75 mt-1  first-letter:uppercase">{relativeDay(nextTest.start_date)}{nextTest.ownerName ? ` · ${nextTest.ownerName}` : ""}</p>
            <p className="font-[family-name:var(--font-display)] text-4xl font-bold mt-3 tabular-nums">
              J-{Math.max(0, daysUntil(nextTest.start_date))}
            </p>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--greek-bronze)] mb-3">Cette semaine</p>
          {week.total === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Aucune révision ni devoir prévu.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-[var(--greek-blue)] font-semibold">Révisions et devoirs faits</span>
                <span className="text-sm font-bold tabular-nums text-[var(--greek-blue)]">{week.done}/{week.total}</span>
              </div>
              <div className="h-2.5 rounded-full bg-[rgba(15,30,58,0.08)] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.round((week.done / week.total) * 100)}%` }} />
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--greek-bronze)] mb-3">Les 15 prochains jours</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Rien de prévu.</p>
          ) : (
            <ul className="space-y-1">
              {upcoming.map((ev) => {
                const meta = getEventTypeMeta(ev.event_type);
                return (
                  <li key={ev.id}>
                    <button type="button" onClick={() => setDayOpen(ev.start_date)} className="w-full text-left flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-[var(--greek-cream)] transition-colors">
                      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--greek-blue)] truncate">{ev.title}</span>
                        <span className="block text-xs text-[var(--text-muted)]  first-letter:uppercase">
                          {relativeDay(ev.start_date)}{ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ""}{ev.ownerName ? ` · ${ev.ownerName}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5 space-y-3">
          {isParent && ownerId !== FAMILY && (
            <label className="flex items-center justify-between gap-3 text-sm text-[var(--greek-blue)]">
              Zone de vacances
              <select value={zone} onChange={(e) => changeZone(e.target.value)} className="py-1.5 px-3 rounded-xl text-sm">
                {STUDENT_ZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )}
          <GlassButton variant="ghost" size="sm" fullWidth onClick={exportIcs}>
            <Download className="w-4 h-4" /> Exporter vers mon agenda (.ics)
          </GlassButton>
        </div>
      </aside>

      {dayOpen && (
        <DayPanel
          date={dayOpen}
          events={byDay.get(dayOpen) ?? []}
          onClose={() => setDayOpen(null)}
          onChangeDate={setDayOpen}
          onAdd={() => setEditor({ event: null, date: dayOpen })}
          onEdit={(ev) => setEditor({ event: ev, date: ev.start_date })}
          onDelete={deleteEvent}
          onToggleDone={toggleDone}
          canEdit={canEdit}
          courseHref={courseHref}
        />
      )}
      {editor && (
        <EventEditor
          event={editor.event}
          date={editor.date}
          isParent={isParent}
          owners={ownerId === FAMILY ? owners : undefined}
          defaultOwnerId={ownerId === FAMILY ? meId : ownerId}
          onClose={() => setEditor(null)}
          onSave={saveEvent}
        />
      )}
      {aiOpen && planTarget && (
        <AiPlanDialog
          studentName={isParent ? ownerName(planTarget) : "moi"}
          childId={isParent ? planTarget : undefined}
          onClose={() => setAiOpen(false)}
          onAccept={acceptPlan}
        />
      )}
    </div>
  );
}

/* ── Vues ─────────────────────────────────────────────────────────── */

function Chip({ ev }: { ev: CalendarEventItem }) {
  const meta = getEventTypeMeta(ev.event_type);
  return (
    <span
      className={`block truncate text-[11px] leading-tight px-1.5 py-0.5 rounded-md ${ev.completed_at ? "line-through opacity-50" : ""}`}
      style={{ background: meta.color, color: meta.textColor }}
      title={`${ev.title}${ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ""}`}
    >
      {ev.start_time ? `${ev.start_time.slice(0, 5)} ` : ""}{ev.title}
    </span>
  );
}

function MonthGrid({
  cursor, byDay, today, onOpenDay,
}: {
  cursor: string; byDay: Map<string, CalendarEventItem[]>; today: string; onOpenDay: (iso: string) => void;
}) {
  const d = fromIso(cursor);
  const cells = monthCells(d.getFullYear(), d.getMonth());
  return (
    <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] shadow-sm p-3 md:p-4">
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((n) => <div key={n} className="text-center text-[11px] font-bold uppercase tracking-wide text-[var(--greek-bronze)] py-1.5">{n}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ iso, inMonth }) => {
          const list = byDay.get(iso) ?? [];
          const holiday = list.some((e) => e.event_type === "vacances");
          const shown = list.filter((e) => e.event_type !== "vacances");
          const isToday = iso === today;
          const dow = (fromIso(iso).getDay() + 6) % 7;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onOpenDay(iso)}
              aria-label={`${longDate(iso)} : ${list.length ? `${list.length} élément${list.length > 1 ? "s" : ""}` : "rien de prévu"}`}
              className={`group min-h-[64px] md:min-h-[104px] rounded-2xl p-1.5 text-left flex flex-col gap-1 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--greek-blue)]/40 ${
                isToday ? "border-[var(--greek-gold)] bg-[rgba(197,161,72,0.08)]" : "border-transparent hover:border-[rgba(197,161,72,0.35)]"
              } ${!inMonth ? "opacity-40" : ""} ${holiday ? "bg-emerald-50/70" : dow >= 5 && !isToday ? "bg-[var(--greek-cream)]/60" : ""}`}
            >
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${isToday ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]" : "text-[var(--greek-blue)]"}`}>
                {fromIso(iso).getDate()}
              </span>
              {/* Téléphone : pastilles. Grand écran : titres. */}
              <span className="flex gap-0.5 md:hidden">
                {list.slice(0, 4).map((e) => <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: getEventTypeMeta(e.event_type).color }} />)}
              </span>
              <span className="hidden md:flex flex-col gap-0.5 min-w-0">
                {holiday && <span className="text-[10px] font-semibold text-emerald-700 truncate">Vacances</span>}
                {shown.slice(0, 3).map((e) => <Chip key={e.id} ev={e} />)}
                {shown.length > 3 && <span className="text-[10px] font-semibold text-[var(--greek-bronze)]">+{shown.length - 3} autre{shown.length - 3 > 1 ? "s" : ""}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  start, byDay, today, onOpenDay, onToggleDone,
}: {
  start: string; byDay: Map<string, CalendarEventItem[]>; today: string; onOpenDay: (iso: string) => void; onToggleDone: (ev: CalendarEventItem) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
  return (
    <div className="grid grid-cols-1 xl:grid-cols-7 gap-2">
      {days.map((iso, i) => {
        const list = byDay.get(iso) ?? [];
        const isToday = iso === today;
        return (
          <div key={iso} className={`rounded-3xl border p-3 xl:min-h-[320px] flex flex-col gap-2 bg-white ${isToday ? "border-[var(--greek-gold)] shadow-md" : "border-[rgba(197,161,72,0.22)]"}`}>
            <button type="button" onClick={() => onOpenDay(iso)} className="flex items-baseline justify-between gap-2 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--greek-bronze)]">{DAYS_SHORT[i]}</span>
              <span className={`text-lg font-bold ${isToday ? "text-[var(--greek-gold)]" : "text-[var(--greek-blue)]"}`}>{fromIso(iso).getDate()}</span>
            </button>
            {list.length === 0 && <button type="button" onClick={() => onOpenDay(iso)} className="flex-1 min-h-[36px] rounded-2xl border border-dashed border-[rgba(197,161,72,0.25)] text-xs text-[var(--text-muted)] hover:bg-[var(--greek-cream)]">Libre</button>}
            {list.map((ev) => {
              const meta = getEventTypeMeta(ev.event_type);
              const tickable = !ev.isVirtual && ["revision", "devoir", "event"].includes(ev.event_type);
              return (
                <div key={ev.id} className={`rounded-xl p-2 text-left border-l-4 bg-[var(--greek-cream)]/60 ${ev.completed_at ? "opacity-60" : ""}`} style={{ borderLeftColor: meta.color }}>
                  <button type="button" onClick={() => onOpenDay(iso)} className="block w-full text-left">
                    <span className="block text-[11px] text-[var(--text-muted)]">{timeLabel(ev)}</span>
                    <span className={`block text-sm font-semibold text-[var(--greek-blue)] ${ev.completed_at ? "line-through" : ""}`}>{ev.title}</span>
                    {ev.ownerName && <span className="block text-[11px] text-[var(--text-muted)]">{ev.ownerName}</span>}
                  </button>
                  {tickable && (
                    <div className="mt-1.5">
                      <GlassButton onClick={() => onToggleDone(ev)} variant="outline" size="sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {ev.completed_at ? "Fait" : "Marquer fait"}
                      </GlassButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ListView({ byDay, from, onOpenDay }: { byDay: Map<string, CalendarEventItem[]>; from: string; onOpenDay: (iso: string) => void }) {
  // Un événement sur plusieurs jours (vacances…) n'apparaît qu'une fois : au
  // premier jour visible, avec sa date de fin.
  const to = addDaysIso(from, 90);
  const firstVisible = (ev: CalendarEventItem) => (ev.start_date > from ? ev.start_date : from);
  const rows = new Map<string, CalendarEventItem[]>();
  for (const [iso, list] of byDay) {
    if (iso < from || iso > to) continue;
    const kept = list.filter((ev) => firstVisible(ev) === iso);
    if (kept.length) rows.set(iso, kept);
  }
  const days = [...rows.keys()].sort();
  if (days.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-dashed border-[rgba(197,161,72,0.4)] p-10 text-center">
        <CalendarDays className="w-10 h-10 mx-auto mb-3 text-[var(--greek-gold)]" />
        <p className="text-[var(--text-muted)]">Rien de prévu dans les trois prochains mois.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {days.map((iso) => (
        <button key={iso} type="button" onClick={() => onOpenDay(iso)} className="w-full text-left bg-white rounded-3xl border border-[rgba(197,161,72,0.22)] shadow-sm p-4 flex gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 shrink-0 text-center">
            <p className="text-[11px] font-bold uppercase text-[var(--greek-bronze)]">{MONTHS_SHORT[fromIso(iso).getMonth()]}</p>
            <p className="text-2xl font-bold text-[var(--greek-blue)] leading-none">{fromIso(iso).getDate()}</p>
            <p className="text-[11px] text-[var(--text-muted)]  first-letter:uppercase">{relativeDay(iso).startsWith("dans") || ["aujourd'hui", "demain"].includes(relativeDay(iso)) ? relativeDay(iso) : ""}</p>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {(rows.get(iso) ?? []).map((ev) => {
              const meta = getEventTypeMeta(ev.event_type);
              const multi = ev.end_date && ev.end_date > ev.start_date;
              return (
                <p key={ev.id} className={`flex items-center gap-2 text-sm ${ev.completed_at ? "line-through opacity-50" : ""}`}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="text-xs text-[var(--text-muted)] w-28 shrink-0">{multi ? `jusqu'au ${fromIso(ev.end_date!).getDate()} ${MONTHS_SHORT[fromIso(ev.end_date!).getMonth()]}` : timeLabel(ev)}</span>
                  <span className="font-semibold text-[var(--greek-blue)] truncate">{ev.title}</span>
                  {ev.ownerName && <span className="text-xs text-[var(--text-muted)] shrink-0">· {ev.ownerName}</span>}
                </p>
              );
            })}
          </div>
        </button>
      ))}
    </div>
  );
}
