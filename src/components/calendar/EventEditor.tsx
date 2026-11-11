"use client";

import { useState } from "react";
import LoaderDots from "@/components/LoaderDots";
import { Clock, Repeat } from "lucide-react";
import GlassDialog from "@/components/ui/GlassDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassSwitch from "@/components/ui/GlassSwitch";
import { EVENT_TYPE_OPTIONS, PARENT_ONLY_EVENT_TYPE_OPTIONS, getEventTypeMeta } from "@/lib/calendarEventTypes";
import type { CalendarEventItem } from "./calendarUtils";

export interface EventDraft {
  title: string;
  description: string;
  event_type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  visible_to_child: boolean;
  repeatWeeks: number;
  ownerId: number;
}

const inputCls =
  "w-full px-4 py-2.5 rounded-xl border border-[rgba(197,161,72,0.3)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25";

/** Création / modification d'un événement. */
export default function EventEditor({
  event, date, isParent, owners, defaultOwnerId, onClose, onSave,
}: {
  event: CalendarEventItem | null;
  date: string;
  isParent: boolean;
  /** Vue famille : pour qui est l'événement. */
  owners?: { id: number; name: string }[];
  defaultOwnerId: number;
  onClose: () => void;
  onSave: (draft: EventDraft) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [type, setType] = useState(event?.event_type ?? "event");
  const [start, setStart] = useState(event?.start_date ?? date);
  const [end, setEnd] = useState(event?.end_date ?? "");
  const [timed, setTimed] = useState(!!event?.start_time);
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? "17:00");
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) ?? "17:30");
  const [visible, setVisible] = useState(event?.visible_to_child !== false);
  const [repeat, setRepeat] = useState(1);
  const [ownerId, setOwnerId] = useState(event?.owner_id ?? defaultOwnerId);
  const [saving, setSaving] = useState(false);

  const types = isParent ? PARENT_ONLY_EVENT_TYPE_OPTIONS : EVENT_TYPE_OPTIONS;
  const invalidTimes = timed && !end && endTime <= startTime;
  const canSave = title.trim().length > 0 && !!start && (!end || end >= start) && !invalidTimes && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave({
      title: title.trim(),
      description: description.trim(),
      event_type: type,
      start_date: start,
      end_date: end || null,
      start_time: timed ? startTime : null,
      end_time: timed ? endTime : null,
      visible_to_child: visible,
      repeatWeeks: event ? 1 : repeat,
      ownerId,
    });
    if (!ok) setSaving(false);
  };

  return (
    <GlassDialog
      title={event ? "Modifier l'événement" : "Nouvel événement"}
      onClose={onClose}
      footer={
        <>
          <GlassButton variant="ghost" size="sm" onClick={onClose}>Annuler</GlassButton>
          <GlassButton variant="navy" size="sm" onClick={save} disabled={!canSave}>
            {saving && <LoaderDots />} {event ? "Enregistrer" : repeat > 1 ? `Ajouter ${repeat} événements` : "Ajouter"}
          </GlassButton>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} autoFocus placeholder="Ex. Contrôle sur les fractions" className={inputCls} />
        </label>

        <div>
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Type</span>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const meta = getEventTypeMeta(t.value);
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-all ${active ? "border-[var(--greek-blue)] bg-[rgba(15,30,58,0.05)] font-semibold text-[var(--greek-blue)]" : "border-[rgba(197,161,72,0.3)] text-[var(--text-muted)] hover:bg-[var(--greek-cream)]"}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {owners && owners.length > 1 && !event && (
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Pour</span>
            <select value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))} className="w-full py-2.5 px-3 rounded-xl text-sm">
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Date</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Jusqu&apos;au <span className="font-normal text-[var(--text-muted)]">(facultatif)</span></span>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="rounded-2xl border border-[rgba(197,161,72,0.25)] p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[var(--greek-blue)] inline-flex items-center gap-2"><Clock className="w-4 h-4" /> À une heure précise</span>
            <GlassSwitch checked={timed} onChange={setTimed} label="À une heure précise" />
          </div>
          {timed && (
            <div className="grid grid-cols-2 gap-3">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Heure de début" className={inputCls} />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Heure de fin" className={inputCls} />
            </div>
          )}
          {invalidTimes && <p className="text-xs text-red-600">L&apos;heure de fin doit être après l&apos;heure de début.</p>}
        </div>

        {!event && (
          <div className="rounded-2xl border border-[rgba(197,161,72,0.25)] p-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[var(--greek-blue)] inline-flex items-center gap-2"><Repeat className="w-4 h-4" /> Répéter chaque semaine</span>
            <select value={repeat} onChange={(e) => setRepeat(Number(e.target.value))} aria-label="Nombre de semaines" className="py-1.5 px-3 rounded-xl text-sm">
              <option value={1}>Non</option>
              {[2, 4, 6, 8, 10, 12, 16, 20].map((n) => <option key={n} value={n}>{n} semaines</option>)}
            </select>
          </div>
        )}

        <label className="block">
          <span className="block text-sm font-semibold text-[var(--greek-blue)] mb-1.5">Notes <span className="font-normal text-[var(--text-muted)]">(facultatif)</span></span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={3} placeholder="Chapitres à revoir, matériel à prévoir…" className={inputCls} />
        </label>

        {isParent && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--greek-blue)]">Visible par l&apos;enfant</span>
            <GlassSwitch checked={visible} onChange={setVisible} label="Visible par l'enfant" />
          </div>
        )}
      </div>
    </GlassDialog>
  );
}
