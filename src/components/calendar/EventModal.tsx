"use client";

import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { EVENT_TYPE_OPTIONS, PARENT_ONLY_EVENT_TYPE_OPTIONS, CalendarEventType } from "@/lib/calendarEventTypes";
import { CalendarEventItem } from "./CalendarView";

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    event_type: CalendarEventType;
    start_date: string;
    end_date: string | null;
    visible_to_child: boolean;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  initialDate?: string | null;
  event?: CalendarEventItem | null;
  isParent: boolean;
  saving?: boolean;
}

export default function EventModal({ open, onClose, onSave, onDelete, initialDate, event, isParent, saving }: EventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("event");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibleToChild, setVisibleToChild] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setEventType((event.event_type as CalendarEventType) || "event");
      setStartDate(event.start_date);
      setEndDate(event.end_date || "");
      setVisibleToChild(event.visible_to_child !== false);
    } else {
      setTitle("");
      setDescription("");
      setEventType("event");
      setStartDate(initialDate || new Date().toISOString().slice(0, 10));
      setEndDate("");
      setVisibleToChild(true);
    }
  }, [open, event, initialDate]);

  if (!open) return null;

  const isVirtual = event?.isVirtual;
  const typeOptions = isParent ? PARENT_ONLY_EVENT_TYPE_OPTIONS : EVENT_TYPE_OPTIONS;

  const handleSave = async () => {
    if (!title.trim() || !startDate) return;
    await onSave({
      title: title.trim(),
      description: description.trim(),
      event_type: eventType,
      start_date: startDate,
      end_date: endDate || null,
      visible_to_child: visibleToChild,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-[20px] shadow-xl w-full max-w-md p-6 border border-[rgba(197,161,72,0.25)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--greek-blue)]">
            {isVirtual ? "Détails" : event ? "Modifier l'événement" : "Nouvel événement"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[rgba(197,161,72,0.1)]">
            <X className="w-5 h-5 text-[var(--greek-blue)]" />
          </button>
        </div>

        {isVirtual ? (
          <div className="space-y-2">
            <p className="font-semibold text-[var(--greek-blue)]">{event?.title}</p>
            {event?.description && <p className="text-sm text-gray-600">{event.description}</p>}
            <p className="text-sm text-gray-500">
              Du {event?.start_date} {event?.end_date && event.end_date !== event.start_date ? `au ${event.end_date}` : ""}
            </p>
            <p className="text-xs text-gray-400 mt-2">Cet événement est généré automatiquement et ne peut pas être modifié.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--greek-blue)] mb-1">Titre</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded-[10px] border border-[rgba(197,161,72,0.3)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-gold)]"
                placeholder="Ex : Contrôle de mathématiques"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--greek-blue)] mb-1">Type</label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value as CalendarEventType)}
                className="w-full rounded-[10px] border border-[rgba(197,161,72,0.3)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-gold)]"
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--greek-blue)] mb-1">Date de début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-[10px] border border-[rgba(197,161,72,0.3)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-gold)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--greek-blue)] mb-1">Date de fin (optionnel)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-[10px] border border-[rgba(197,161,72,0.3)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-gold)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--greek-blue)] mb-1">Description (optionnel)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] border border-[rgba(197,161,72,0.3)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-gold)]"
              />
            </div>

            {isParent && (
              <label className="flex items-center gap-2 text-sm text-[var(--greek-blue)]">
                <input
                  type="checkbox"
                  checked={visibleToChild}
                  onChange={e => setVisibleToChild(e.target.checked)}
                  className="rounded border-[rgba(197,161,72,0.3)]"
                />
                Visible par l'enfant
              </label>
            )}

            <div className="flex items-center justify-between pt-2">
              <div>
                {event && onDelete && (
                  <button
                    onClick={onDelete}
                    disabled={saving}
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-[10px] hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-[10px] text-sm font-medium text-[var(--greek-blue)] border border-[rgba(197,161,72,0.3)] hover:bg-[rgba(197,161,72,0.08)] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim() || !startDate}
                  className="btn-primary-greek px-4 py-2 rounded-[10px] text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
