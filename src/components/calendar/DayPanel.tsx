"use client";

import { BookOpen, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Pencil, Sparkles, Trash2 } from "lucide-react";
import GlassDialog from "@/components/ui/GlassDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { getEventTypeMeta } from "@/lib/calendarEventTypes";
import { type CalendarEventItem, addDaysIso, courseTitle, longDate, relativeDay, timeLabel } from "./calendarUtils";

/**
 * Ce qui est prévu un jour donné : cliquer sur une date ouvre CE panneau (et
 * non directement « nouvel événement »). Chaque événement se lit en entier
 * (horaire, notes, cours lié, raison du plan IA), se coche comme fait, se
 * modifie ou se supprime selon les droits ; « Ajouter un événement » part de
 * la date affichée. Flèches pour passer au jour précédent / suivant.
 */
export default function DayPanel({
  date, events, onClose, onChangeDate, onAdd, onEdit, onDelete, onToggleDone, canEdit, courseHref,
}: {
  date: string;
  events: CalendarEventItem[];
  onClose: () => void;
  onChangeDate: (iso: string) => void;
  onAdd: () => void;
  onEdit: (ev: CalendarEventItem) => void;
  onDelete: (ev: CalendarEventItem) => void;
  onToggleDone: (ev: CalendarEventItem) => void;
  canEdit: (ev: CalendarEventItem) => boolean;
  courseHref?: (courseId: number) => string | null;
}) {
  const title = longDate(date);
  const rel = relativeDay(date);
  return (
    <GlassDialog
      title={title.charAt(0).toUpperCase() + title.slice(1)}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <GlassIconButton icon={ChevronLeft} color="gray" size="sm" onClick={() => onChangeDate(addDaysIso(date, -1))} aria-label="Jour précédent" />
            <GlassIconButton icon={ChevronRight} color="gray" size="sm" onClick={() => onChangeDate(addDaysIso(date, 1))} aria-label="Jour suivant" />
          </div>
          <GlassButton variant="navy" size="sm" onClick={onAdd}>
            <CalendarPlus className="w-4 h-4" /> Ajouter un événement
          </GlassButton>
        </div>
      }
    >
      {rel !== title && <p className="text-sm text-[var(--text-muted)] mb-4 first-letter:uppercase">{rel}</p>}

      {events.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-[var(--text-muted)]">Rien de prévu ce jour-là.</p>
        </div>
      ) : (
        <ul className="space-y-3 pb-2">
          {events.map((ev) => {
            const meta = getEventTypeMeta(ev.event_type);
            const done = !!ev.completed_at;
            const course = courseTitle(ev);
            const href = ev.course_id && courseHref ? courseHref(ev.course_id) : null;
            const editable = !ev.isVirtual && canEdit(ev);
            const tickable = !ev.isVirtual && ["revision", "devoir", "event"].includes(ev.event_type);
            return (
              <li key={ev.id} className={`rounded-2xl border p-4 transition-colors ${done ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-[rgba(197,161,72,0.25)]"}`}>
                <div className="flex items-start gap-3">
                  {tickable ? (
                    <button
                      type="button"
                      onClick={() => onToggleDone(ev)}
                      aria-pressed={done}
                      aria-label={done ? "Marquer comme à faire" : "Marquer comme fait"}
                      className="mt-0.5 shrink-0 transition-transform active:scale-90"
                    >
                      {done ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <Circle className="w-6 h-6 text-gray-300 hover:text-emerald-500" />}
                    </button>
                  ) : (
                    <span className="mt-1.5 w-3 h-3 rounded-full shrink-0" style={{ background: meta.color }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color.startsWith("var") ? "var(--greek-blue)" : meta.color }}>
                        {meta.label}
                      </span>
                      {ev.source === "ai" && (
                        <span className="text-[11px] font-semibold inline-flex items-center gap-1 text-[var(--greek-bronze)]"><Sparkles className="w-3 h-3" /> Plan IA</span>
                      )}
                      {ev.ownerName && <span className="text-[11px] font-semibold text-[var(--text-muted)]">{ev.ownerName}</span>}
                    </div>
                    <p className={`font-semibold text-[var(--greek-blue)] mt-1 ${done ? "line-through opacity-60" : ""}`}>{ev.title}</p>
                    <p className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {timeLabel(ev)}
                      {ev.end_date && ev.end_date !== ev.start_date && <> · jusqu&apos;au {longDate(ev.end_date)}</>}
                    </p>
                    {ev.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{ev.description}</p>}
                    {ev.reason && <p className="text-xs text-[var(--greek-bronze)] mt-2 italic">Pourquoi : {ev.reason}</p>}
                    {course && (
                      href ? (
                        <div className="mt-3">
                          <GlassButton href={href} variant="outline" size="sm">
                            <BookOpen className="w-4 h-4" /> Ouvrir le cours : {course}
                          </GlassButton>
                        </div>
                      ) : (
                        <p className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--greek-blue)]"><BookOpen className="w-4 h-4 text-[var(--greek-gold)]" /> {course}</p>
                      )
                    )}
                    {!ev.isVirtual && !editable && ev.created_by_role === "parent" && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-2">Ajouté par ton parent.</p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <GlassIconButton icon={Pencil} color="navy" size="sm" onClick={() => onEdit(ev)} aria-label={`Modifier ${ev.title}`} />
                      <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => onDelete(ev)} aria-label={`Supprimer ${ev.title}`} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassDialog>
  );
}
