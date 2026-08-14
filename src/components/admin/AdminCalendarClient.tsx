"use client";

import { useState, useCallback } from "react";
import { Calendar, Plus, Trash2, Edit } from "lucide-react";
import { getEventTypeMeta, EVENT_TYPE_OPTIONS } from "@/lib/calendarEventTypes";
import { ZONE_OPTIONS, getZoneLabel } from "@/lib/calendarZones";
import { useConfirm } from "@/components/ConfirmDialog";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

const ADMIN_EVENT_TYPE_OPTIONS = [
  ...EVENT_TYPE_OPTIONS,
  { value: "vacances" as any, label: "Vacances" },
];

interface GlobalEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  zone: string;
}

const inputCls = "w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

/** Événements globaux du calendrier : la liste initiale arrive déjà chargée
 * du serveur ; le CRUD reste un aller-retour client, comme avant. */
export default function AdminCalendarClient({
  authId,
  initialEvents,
}: {
  authId: string;
  initialEvents: GlobalEvent[];
}) {
  const confirm = useConfirm();
  const [events, setEvents] = useState<GlobalEvent[]>(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("vacances");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [zone, setZone] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");

  const loadEvents = useCallback(async () => {
    const res = await fetch(`/api/admin/calendar-events?userId=${authId}`);
    const data = await res.json();
    setEvents(data.events || []);
  }, [authId]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setEventType("vacances");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setZone("all");
    setModalOpen(true);
  };

  const openEdit = (ev: GlobalEvent) => {
    setEditing(ev);
    setTitle(ev.title);
    setDescription(ev.description || "");
    setEventType(ev.event_type);
    setStartDate(ev.start_date);
    setEndDate(ev.end_date || "");
    setZone(ev.zone || "all");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate) return;
    setSaving(true);
    try {
      const body = {
        userId: authId,
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate || null,
        zone,
      };
      if (editing) {
        await fetch(`/api/admin/calendar-events/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`/api/admin/calendar-events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      await loadEvents();
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: GlobalEvent) => {
    const ok = await confirm(`"${ev.title}" sera supprimé du calendrier de tous les utilisateurs.`, {
      title: "Supprimer l'événement ?",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/calendar-events/${ev.id}?userId=${authId}`, { method: "DELETE" });
    await loadEvents();
  };

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          icon={Calendar}
          title="Calendrier — Événements globaux"
          subtitle="Ces événements (vacances scolaires, dates importantes...) apparaissent automatiquement dans les calendriers de tous les parents et élèves, filtrés selon leur zone scolaire."
          actions={
            <GlassButton size="sm" variant="navy" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Nouvel événement
            </GlassButton>
          }
        />
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {[{ value: "all", label: "Toutes" }, ...ZONE_OPTIONS.filter(z => z.value !== "all")].map(opt => (
          <button
            key={opt.value}
            onClick={() => setZoneFilter(opt.value)}
            aria-pressed={zoneFilter === opt.value}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              zoneFilter === opt.value
                ? "bg-[var(--greek-gold)] text-[var(--greek-blue)]"
                : "bg-[rgba(197,161,72,0.1)] text-[var(--greek-blue)] hover:bg-[rgba(197,161,72,0.2)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
        {(() => {
          const filteredEvents = zoneFilter === "all" ? events : events.filter(e => e.zone === zoneFilter);
          return filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Aucun événement global pour le moment.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Titre</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Zone</th>
                <th className="text-left px-4 py-3">Début</th>
                <th className="text-left px-4 py-3">Fin</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(ev => {
                const meta = getEventTypeMeta(ev.event_type);
                return (
                  <tr key={ev.id} className="border-t border-[rgba(197,161,72,0.15)]">
                    <td className="px-4 py-3 font-semibold text-gray-800">{ev.title}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: meta.color + "20", color: meta.color === "var(--greek-gold)" ? "var(--greek-blue)" : meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{getZoneLabel(ev.zone || "all")}</td>
                    <td className="px-4 py-3 text-gray-600">{ev.start_date}</td>
                    <td className="px-4 py-3 text-gray-600">{ev.end_date || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <GlassIconButton icon={Edit} onClick={() => openEdit(ev)} color="navy" size="sm" aria-label="Modifier l'événement" />
                        <GlassIconButton icon={Trash2} onClick={() => handleDelete(ev)} color="red" size="sm" aria-label="Supprimer l'événement" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          );
        })()}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[20px] shadow-xl w-full max-w-md p-6 border border-[rgba(197,161,72,0.25)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--greek-blue)]">
                {editing ? "Modifier l'événement" : "Nouvel événement"}
              </h3>
              <GlassCloseButton onClick={() => setModalOpen(false)} />
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Titre</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Ex : Vacances de la Toussaint" />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} className={inputCls}>
                  {ADMIN_EVENT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Zone</label>
                <select value={zone} onChange={e => setZone(e.target.value)} className={inputCls}>
                  {ZONE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date de début</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Date de fin (optionnel)</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description (optionnel)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputCls} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setModalOpen(false)}>
                  Annuler
                </GlassButton>
                <GlassButton size="sm" variant="navy" onClick={handleSave} disabled={saving || !title.trim() || !startDate}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
