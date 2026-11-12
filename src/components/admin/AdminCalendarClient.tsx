"use client";

import Emblem3D from "@/components/Emblem3D";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Calendar, CheckSquare, Copy, Download, Landmark, Loader2, Pencil, Plus, Search, Square, Trash2,
} from "lucide-react";
import { getEventTypeMeta } from "@/lib/calendarEventTypes";
import { ZONE_OPTIONS, getZoneLabel } from "@/lib/calendarZones";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassDialog from "@/components/ui/GlassDialog";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { MONTHS_SHORT, addDaysIso, fromIso, todayIso } from "@/components/calendar/calendarUtils";

interface GlobalEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  zone: string;
  import_key?: string | null;
}

/** Une même période (titre + dates) posée sur plusieurs zones = une seule ligne. */
interface Group {
  key: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  official: boolean;
  rows: GlobalEvent[];
}

interface OfficialHoliday {
  import_key: string;
  zone: string;
  title: string;
  start_date: string;
  end_date: string;
  exists: boolean;
}

const MAIN_ZONES = ["A", "B", "C"];
const TIMELINE_ZONES = ZONE_OPTIONS.map((z) => z.value);
const GLOBAL_TYPES = [
  { value: "vacances", label: "Vacances" },
  { value: "event", label: "Journée / événement" },
  { value: "controle", label: "Examen national" },
];
const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-[rgba(197,161,72,0.3)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25";

const schoolYearOf = (iso: string) => {
  const d = fromIso(iso);
  const y = d.getFullYear();
  return d.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};
const yearBounds = (year: string) => {
  const y = Number(year.slice(0, 4));
  return { from: `${y}-08-01`, to: `${y + 1}-07-31` };
};
const yearLabel = (y: string) => `${y.slice(0, 4)}-${y.slice(-2)}`;
const shortDate = (iso: string) => `${fromIso(iso).getDate()} ${MONTHS_SHORT[fromIso(iso).getMonth()]}`;
const dayCount = (a: string, b: string | null) => Math.round((fromIso(b || a).getTime() - fromIso(a).getTime()) / 86_400_000) + 1;
const rangeLabel = (a: string, b: string | null) =>
  !b || b === a ? `le ${shortDate(a)} ${fromIso(a).getFullYear()}` : `du ${shortDate(a)} au ${shortDate(b)} ${fromIso(b).getFullYear()}`;

function groupEvents(events: GlobalEvent[]): Group[] {
  const map = new Map<string, Group>();
  for (const ev of events) {
    const key = `${ev.title}|${ev.event_type}|${ev.start_date}|${ev.end_date ?? ""}`;
    const g = map.get(key);
    if (g) {
      g.rows.push(ev);
      g.official ||= !!ev.import_key;
    } else {
      map.set(key, { key, title: ev.title, description: ev.description, event_type: ev.event_type, start_date: ev.start_date, end_date: ev.end_date, official: !!ev.import_key, rows: [ev] });
    }
  }
  const order = (z: string) => TIMELINE_ZONES.indexOf(z);
  return [...map.values()]
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => order(a.zone) - order(b.zone)) }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
}

/**
 * Calendrier scolaire commun (vacances, dates nationales) : ce qui s'affiche
 * automatiquement dans les calendriers des familles, selon leur zone.
 * Frise de l'année par zone pour repérer d'un coup d'œil un trou, liste
 * groupée (une période sur plusieurs zones = une ligne), import en un clic
 * du calendrier officiel du ministère.
 */
export default function AdminCalendarClient({ initialEvents }: { authId?: string; initialEvents: GlobalEvent[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [events, setEvents] = useState<GlobalEvent[]>(initialEvents);
  const [year, setYear] = useState(() => schoolYearOf(todayIso()));
  const [view, setView] = useState("timeline");
  const [zoneFilter, setZoneFilter] = useState("toutes");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ group: Group | null; preset?: Partial<Group> } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const currentYear = schoolYearOf(todayIso());
  const years = useMemo(() => {
    const y = Number(currentYear.slice(0, 4));
    return [`${y - 1}-${y}`, currentYear, `${y + 1}-${y + 2}`, `${y + 2}-${y + 3}`];
  }, [currentYear]);

  const { from, to } = yearBounds(year);
  const yearEvents = useMemo(
    () => events.filter((e) => e.start_date <= to && (e.end_date || e.start_date) >= from),
    [events, from, to],
  );
  const groups = useMemo(() => groupEvents(yearEvents), [yearEvents]);
  const visibleGroups = groups.filter(
    (g) =>
      (zoneFilter === "toutes" || g.rows.some((r) => r.zone === zoneFilter || r.zone === "all")) &&
      (!query.trim() || g.title.toLowerCase().includes(query.trim().toLowerCase())),
  );

  // Zones principales sans aucune vacance sur l'année affichée.
  const missingZones = MAIN_ZONES.filter(
    (z) => !yearEvents.some((e) => e.event_type === "vacances" && (e.zone === z || e.zone === "all")),
  );
  const coveredZones = new Set(yearEvents.map((e) => e.zone));
  const today = todayIso();
  const nextHoliday = groups.find((g) => g.event_type === "vacances" && (g.end_date || g.start_date) >= today);

  const reload = async () => {
    const res = await fetch("/api/admin/calendar-events");
    if (res.ok) setEvents((await res.json()).events ?? []);
  };

  const removeGroup = async (g: Group) => {
    const zones = g.rows.map((r) => getZoneLabel(r.zone)).join(", ");
    const ok = await confirm(`« ${g.title} » disparaîtra du calendrier des familles (${zones}).`, {
      title: "Supprimer cette période ?",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    const results = await Promise.all(g.rows.map((r) => fetch(`/api/admin/calendar-events/${r.id}`, { method: "DELETE" })));
    if (results.some((r) => !r.ok)) toast.error("Une partie de la suppression a échoué.");
    else toast.success("Période supprimée.");
    await reload();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Calendar}
        title="Calendrier scolaire"
        subtitle="Vacances et dates nationales affichées automatiquement dans le calendrier de chaque famille, selon sa zone."
        actions={
          <div className="flex flex-wrap gap-2">
            <GlassButton size="sm" variant="gold" onClick={() => setImportOpen(true)}>
              <Landmark className="w-4 h-4" /> Importer le calendrier officiel
            </GlassButton>
            <GlassButton size="sm" variant="navy" onClick={() => setEditor({ group: null })}>
              <Plus className="w-4 h-4" /> Nouvelle période
            </GlassButton>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Périodes sur l'année" value={String(groups.length)} />
        <Stat label="Zones renseignées" value={`${[...coveredZones].filter((z) => z !== "all").length} / ${ZONE_OPTIONS.length - 1}`} />
        <Stat label="Prochaines vacances" value={nextHoliday ? nextHoliday.title.replace(/^Vacances (de la |de |d')/i, "") : "-"} hint={nextHoliday ? rangeLabel(nextHoliday.start_date, nextHoliday.end_date) : undefined} />
        <Stat label="Importées du ministère" value={String(groups.filter((g) => g.official).length)} />
      </div>

      {missingZones.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900 flex-1">
            {missingZones.length === 1 ? "La zone" : "Les zones"} <strong>{missingZones.join(", ")}</strong> n&apos;{missingZones.length === 1 ? "a" : "ont"} aucune vacance pour {year} :
            les familles concernées voient un calendrier vide.
          </p>
          <GlassButton size="sm" variant="navy" onClick={() => setImportOpen(true)}>Importer {year}</GlassButton>
        </div>
      )}

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap gap-3 min-w-0">
          <GlassSegmentedControl size="sm" nowrap className="max-w-full" value={year} onChange={setYear} options={years.map((y) => ({ id: y, label: yearLabel(y) }))} />
          <GlassSegmentedControl size="sm" className="shrink-0" value={view} onChange={setView} options={[{ id: "timeline", label: "Frise" }, { id: "list", label: "Liste" }]} />
        </div>
        <div className="flex gap-2 lg:ml-auto shrink-0">
          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="py-2 px-3 rounded-xl text-sm" aria-label="Filtrer par zone">
            <option value="toutes">Toutes les zones</option>
            {ZONE_OPTIONS.filter((z) => z.value !== "all").map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
          <label className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="pl-9 pr-3 py-2 rounded-xl border border-[rgba(197,161,72,0.3)] text-sm w-44 outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25" />
          </label>
        </div>
      </div>

      <div key={`${year}-${view}`} className="page-enter">
        {view === "timeline" ? (
          <Timeline year={year} events={yearEvents} zoneFilter={zoneFilter} query={query} onOpen={(ev) => {
            const g = groups.find((x) => x.rows.some((r) => r.id === ev.id));
            if (g) setEditor({ group: g });
          }} />
        ) : visibleGroups.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-dashed border-[rgba(197,161,72,0.4)] p-10 text-center">
            <Emblem3D kind="calendar" size={72} className="mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">Aucune période pour {year}{zoneFilter !== "toutes" ? ` en ${getZoneLabel(zoneFilter)}` : ""}.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleGroups.map((g) => {
              const meta = getEventTypeMeta(g.event_type);
              return (
                <li key={g.key} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.22)] shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="hidden sm:block w-1.5 self-stretch rounded-full" style={{ background: meta.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[var(--greek-blue)]">{g.title}</p>
                      {g.official && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(15,30,58,0.06)] text-[var(--greek-blue)]">Officiel</span>}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] first-letter:uppercase">
                      {rangeLabel(g.start_date, g.end_date)} · {dayCount(g.start_date, g.end_date)} jour{dayCount(g.start_date, g.end_date) > 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {g.rows.map((r) => (
                        <span key={r.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-[rgba(197,161,72,0.35)] text-[var(--greek-bronze)]">{getZoneLabel(r.zone)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <GlassIconButton icon={Pencil} color="navy" size="sm" onClick={() => setEditor({ group: g })} aria-label={`Modifier ${g.title}`} />
                    <GlassIconButton icon={Copy} color="gray" size="sm" onClick={() => setEditor({ group: null, preset: g })} aria-label={`Dupliquer ${g.title}`} />
                    <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => removeGroup(g)} aria-label={`Supprimer ${g.title}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editor && (
        <PeriodEditor
          group={editor.group}
          preset={editor.preset}
          defaultDate={from > today ? from : today}
          onClose={() => setEditor(null)}
          onDelete={editor.group ? () => { const g = editor.group!; setEditor(null); removeGroup(g); } : undefined}
          onSaved={async (msg) => {
            setEditor(null);
            toast.success(msg);
            await reload();
          }}
        />
      )}
      {importOpen && (
        <ImportDialog
          initialYear={year}
          years={years}
          onClose={() => setImportOpen(false)}
          onImported={async (n) => {
            setImportOpen(false);
            toast.success(n > 0 ? `${n} période${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}.` : "Tout était déjà à jour.");
            await reload();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-4 min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--greek-bronze)]">{label}</p>
      <p className="text-xl font-bold text-[var(--greek-blue)] truncate first-letter:uppercase">{value}</p>
      {hint && <p className="text-xs text-[var(--text-muted)] truncate">{hint}</p>}
    </div>
  );
}

/** Frise de l'année scolaire (août → juillet), une ligne par zone. */
function Timeline({
  year, events, zoneFilter, query, onOpen,
}: {
  year: string; events: GlobalEvent[]; zoneFilter: string; query: string; onOpen: (ev: GlobalEvent) => void;
}) {
  const { from, to } = yearBounds(year);
  const start = fromIso(from).getTime();
  const total = fromIso(to).getTime() - start + 86_400_000;
  const pct = (iso: string) => Math.min(100, Math.max(0, ((fromIso(iso).getTime() - start) / total) * 100));
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = fromIso(from);
    d.setMonth(d.getMonth() + i);
    return { label: MONTHS_SHORT[d.getMonth()], left: pct(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`) };
  });
  const today = todayIso();
  const q = query.trim().toLowerCase();
  const zones = TIMELINE_ZONES.filter((z) => zoneFilter === "toutes" || z === zoneFilter || z === "all");

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-4 overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[130px_1fr] gap-3 mb-2">
          <span />
          <div className="relative h-5">
            {months.map((m) => (
              <span key={m.left} className="absolute text-[11px] font-bold uppercase text-[var(--greek-bronze)]" style={{ left: `${m.left}%` }}>{m.label}</span>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {zones.map((z) => {
            const rows = events.filter((e) => e.zone === z && (!q || e.title.toLowerCase().includes(q)));
            return (
              <div key={z} className="grid grid-cols-[130px_1fr] gap-3 items-center">
                <span className={`text-sm font-semibold truncate ${MAIN_ZONES.includes(z) ? "text-[var(--greek-blue)]" : "text-[var(--text-muted)]"}`}>{getZoneLabel(z)}</span>
                <div className="relative h-8 rounded-xl bg-[var(--greek-cream)]/70 border border-[rgba(197,161,72,0.15)] overflow-hidden">
                  {months.map((m) => <span key={m.left} className="absolute top-0 bottom-0 w-px bg-[rgba(197,161,72,0.18)]" style={{ left: `${m.left}%` }} />)}
                  {today >= from && today <= to && <span className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-10" style={{ left: `${pct(today)}%` }} title="Aujourd'hui" />}
                  {rows.map((ev) => {
                    const left = pct(ev.start_date);
                    const width = Math.max(0.6, pct(addDaysIso(ev.end_date || ev.start_date, 1)) - left);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onOpen(ev)}
                        title={`${ev.title} : ${rangeLabel(ev.start_date, ev.end_date)}`}
                        aria-label={`${ev.title}, ${getZoneLabel(z)}, ${rangeLabel(ev.start_date, ev.end_date)}`}
                        className="absolute top-1 bottom-1 rounded-lg text-[10px] font-semibold text-white px-1.5 truncate text-left hover:brightness-110 hover:shadow-md transition"
                        style={{ left: `${left}%`, width: `${width}%`, background: getEventTypeMeta(ev.event_type).color }}
                      >
                        {width > 4 ? ev.title.replace(/^Vacances (de la |de |d')/i, "") : ""}
                      </button>
                    );
                  })}
                  {rows.length === 0 && <span className="absolute inset-0 flex items-center pl-3 text-[11px] text-[var(--text-muted)]">Aucune période</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Création / modification d'une période, sur une ou plusieurs zones. */
function PeriodEditor({
  group, preset, defaultDate, onClose, onSaved, onDelete,
}: {
  group: Group | null;
  preset?: Partial<Group>;
  defaultDate: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const base = group ?? preset;
  const [title, setTitle] = useState(base?.title ?? "");
  const [type, setType] = useState(base?.event_type ?? "vacances");
  const [start, setStart] = useState(base?.start_date ?? defaultDate);
  const [end, setEnd] = useState(base?.end_date ?? "");
  const [description, setDescription] = useState(base?.description ?? "");
  const [zones, setZones] = useState<Set<string>>(new Set(group ? group.rows.map((r) => r.zone) : preset?.rows?.map((r) => r.zone) ?? ["all"]));
  const [saving, setSaving] = useState(false);

  const allZones = zones.has("all");
  const toggleZone = (z: string) =>
    setZones((prev) => {
      if (z === "all") return new Set(["all"]);
      const next = new Set(prev);
      next.delete("all");
      if (next.has(z)) next.delete(z);
      else next.add(z);
      return next.size ? next : new Set(["all"]);
    });

  const canSave = title.trim() && start && (!end || end >= start) && zones.size > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const payload = { title: title.trim(), description: description.trim() || null, event_type: type, start_date: start, end_date: end || null };
    const wanted = [...zones];
    try {
      const calls: Promise<Response>[] = [];
      if (group) {
        const byZone = new Map(group.rows.map((r) => [r.zone, r]));
        for (const r of group.rows) {
          calls.push(
            wanted.includes(r.zone)
              ? fetch(`/api/admin/calendar-events/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, zone: r.zone }) })
              : fetch(`/api/admin/calendar-events/${r.id}`, { method: "DELETE" }),
          );
        }
        const added = wanted.filter((z) => !byZone.has(z));
        if (added.length) calls.push(fetch("/api/admin/calendar-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, zones: added }) }));
      } else {
        calls.push(fetch("/api/admin/calendar-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, zones: wanted }) }));
      }
      const results = await Promise.all(calls);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        toast.error((await failed.json().catch(() => ({}))).error || "Enregistrement impossible");
        setSaving(false);
        return;
      }
      onSaved(group ? "Période modifiée." : "Période ajoutée.");
    } catch {
      toast.error("Enregistrement impossible");
      setSaving(false);
    }
  };

  return (
    <GlassDialog
      title={group ? "Modifier la période" : "Nouvelle période"}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {onDelete ? <GlassButton variant="danger" size="sm" onClick={onDelete}><Trash2 className="w-4 h-4" /> Supprimer</GlassButton> : <span />}
          <div className="flex gap-2">
            <GlassButton variant="ghost" size="sm" onClick={onClose}>Annuler</GlassButton>
            <GlassButton variant="navy" size="sm" onClick={save} disabled={!canSave}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {group ? "Enregistrer" : "Ajouter"}
            </GlassButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Intitulé</span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} autoFocus placeholder="Ex. Vacances de la Toussaint" className={inputCls} />
        </label>
        <div>
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Type</span>
          <div className="flex flex-wrap gap-2">
            {GLOBAL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                aria-pressed={type === t.value}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-all ${type === t.value ? "border-[var(--greek-blue)] bg-[rgba(15,30,58,0.05)] font-semibold text-[var(--greek-blue)]" : "border-[rgba(197,161,72,0.3)] text-[var(--text-muted)] hover:bg-[var(--greek-cream)]"}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: getEventTypeMeta(t.value).color }} /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Premier jour</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Dernier jour <span className="font-normal text-[var(--text-muted)]">(facultatif)</span></span>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </label>
        </div>
        {start && <p className="text-xs text-[var(--text-muted)] -mt-2">{dayCount(start, end || null)} jour{dayCount(start, end || null) > 1 ? "s" : ""}, {rangeLabel(start, end || null)}.</p>}
        <div>
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Zones concernées</span>
          <div className="flex flex-wrap gap-1.5">
            {ZONE_OPTIONS.map((z) => {
              const on = z.value === "all" ? allZones : zones.has(z.value);
              return (
                <button
                  key={z.value}
                  type="button"
                  onClick={() => toggleZone(z.value)}
                  aria-pressed={on}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${on ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "border-[rgba(197,161,72,0.35)] text-[var(--greek-blue)] hover:bg-[var(--greek-cream)]"}`}
                >
                  {z.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">« Toutes zones » s&apos;affiche chez toutes les familles, quelle que soit leur zone.</p>
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Note <span className="font-normal text-[var(--text-muted)]">(facultatif)</span></span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={2} className={inputCls} />
        </label>
      </div>
    </GlassDialog>
  );
}

/** Aperçu puis import du calendrier officiel d'une année scolaire. */
function ImportDialog({
  initialYear, years, onClose, onImported,
}: {
  initialYear: string; years: string[]; onClose: () => void; onImported: (added: number) => void;
}) {
  const toast = useToast();
  const [year, setYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState<OfficialHoliday[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (y: string) => {
    setYear(y);
    setLoading(true);
    setError(null);
    setHolidays(null);
    try {
      const res = await fetch(`/api/admin/calendar-events/import?year=${encodeURIComponent(y)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Calendrier officiel indisponible");
      setHolidays(data.holidays);
      setSelected(new Set((data.holidays as OfficialHoliday[]).filter((h) => !h.exists).map((h) => h.import_key)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Regroupe par période (même intitulé + mêmes dates) pour une lecture rapide.
  const periods = useMemo(() => {
    const map = new Map<string, { title: string; start: string; end: string; items: OfficialHoliday[] }>();
    for (const h of holidays ?? []) {
      const k = `${h.title}|${h.start_date}|${h.end_date}`;
      const p = map.get(k) ?? { title: h.title, start: h.start_date, end: h.end_date, items: [] };
      p.items.push(h);
      map.set(k, p);
    }
    return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [holidays]);

  const toggle = (keys: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = keys.every((k) => next.has(k));
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/calendar-events/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, keys: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import impossible");
      onImported(data.added ?? 0);
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };

  const missing = (holidays ?? []).filter((h) => !h.exists).length;

  return (
    <GlassDialog
      title="Importer le calendrier officiel"
      onClose={onClose}
      wide
      footer={
        holidays && missing > 0 ? (
          <>
            <GlassButton variant="ghost" size="sm" onClick={onClose}>Annuler</GlassButton>
            <GlassButton variant="navy" size="sm" onClick={submit} disabled={saving || selected.size === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Ajouter {selected.size} période{selected.size > 1 ? "s" : ""}
            </GlassButton>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">
          Source : calendrier scolaire publié par le ministère de l&apos;Éducation nationale (open data). Les périodes déjà présentes ne sont jamais ajoutées deux fois.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <GlassSegmentedControl size="sm" nowrap className="max-w-full" value={year} onChange={load} options={years.map((y) => ({ id: y, label: yearLabel(y) }))} />
          {!holidays && !loading && (
            <GlassButton size="sm" variant="navy" onClick={() => load(year)}>Voir les dates</GlassButton>
          )}
        </div>
        {loading && <p className="text-sm text-[var(--text-muted)] inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lecture du calendrier officiel…</p>}
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        {holidays && holidays.length === 0 && <p className="text-sm text-[var(--text-muted)]">Le ministère n&apos;a pas encore publié de dates pour {year}.</p>}
        {holidays && holidays.length > 0 && missing === 0 && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">Tout le calendrier officiel {year} est déjà en place.</p>
        )}
        {periods.length > 0 && (
          <ul className="space-y-2 pb-2">
            {periods.map((p) => {
              const open = p.items.filter((h) => !h.exists).map((h) => h.import_key);
              const on = open.length > 0 && open.every((k) => selected.has(k));
              return (
                <li key={`${p.title}${p.start}`} className="rounded-2xl border border-[rgba(197,161,72,0.25)] p-3 flex gap-3">
                  <button type="button" onClick={() => open.length && toggle(open)} disabled={!open.length} aria-pressed={on} aria-label={`Sélectionner ${p.title}`} className="shrink-0 disabled:opacity-40">
                    {on ? <CheckSquare className="w-5 h-5 text-[var(--greek-blue)]" /> : <Square className="w-5 h-5 text-gray-400" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--greek-blue)]">{p.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{rangeLabel(p.start, p.end)}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.items.map((h) => (
                        <button
                          key={h.import_key}
                          type="button"
                          disabled={h.exists}
                          onClick={() => toggle([h.import_key])}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                            h.exists
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                              : selected.has(h.import_key)
                                ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]"
                                : "border-[rgba(197,161,72,0.35)] text-[var(--greek-blue)]"
                          }`}
                        >
                          {getZoneLabel(h.zone)}{h.exists ? " · déjà là" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </GlassDialog>
  );
}
