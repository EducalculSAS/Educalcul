"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Download, Calendar } from "lucide-react";
import CalendarView, { type CalendarEventItem } from "@/components/calendar/CalendarView";
import EventModal from "@/components/calendar/EventModal";
import { getEventTypeMeta, EVENT_TYPE_OPTIONS } from "@/lib/calendarEventTypes";
import { supabase } from "@/lib/supabaseClient";
import GlassButton from "@/components/ui/GlassButton";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}` };
}

/** Calendrier (CRUD événements) : entièrement mutations + état de modale,
 * isolé en client island. Les événements initiaux arrivent déjà chargés du
 * serveur (plus de spinner au montage). */
export default function ChildCalendarClient({
  authId, ownerId, initialEvents, initialGlobalEvents,
}: {
  authId: string;
  ownerId: number;
  initialEvents: CalendarEventItem[];
  initialGlobalEvents: CalendarEventItem[];
}) {
  const [events, setEvents] = useState<CalendarEventItem[]>(initialEvents);
  const [globalEvents, setGlobalEvents] = useState<CalendarEventItem[]>(initialGlobalEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    const res = await fetch(`/api/calendar/events?userId=${authId}&ownerId=${ownerId}`, { headers: await authHeaders() });
    const data = await res.json();
    setEvents(data.events || []);
    setGlobalEvents(data.globalEvents || []);
  }, [authId, ownerId]);

  const exportIcs = async () => {
    try {
      const res = await fetch(`/api/calendar/export?ownerId=${ownerId}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "educalcul-calendrier.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  const handleDayClick = (date: string) => {
    setSelectedEvent(null);
    setSelectedDate(date);
    setModalOpen(true);
  };

  const handleEventClick = (event: CalendarEventItem) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      if (selectedEvent && !selectedEvent.isVirtual) {
        await fetch(`/api/calendar/events/${selectedEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ userId: authId, ...data }),
        });
      } else {
        await fetch(`/api/calendar/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ userId: authId, ownerId, ...data }),
        });
      }
      await loadEvents();
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await fetch(`/api/calendar/events/${selectedEvent.id}?userId=${authId}`, { method: "DELETE", headers: await authHeaders() });
      await loadEvents();
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-10 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <Link href="/child/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 mb-3">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </Link>
          <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <Calendar className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            MON CALENDRIER
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              ÉLÈVE
            </span>
            <span>Tes contrôles, devoirs et vacances scolaires.</span>
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPE_OPTIONS.concat([{ value: "vacances" as any, label: "Vacances" }]).map((opt) => {
              const meta = getEventTypeMeta(opt.value);
              return (
                <span key={opt.value} className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: meta.color + "20", color: meta.color === "var(--greek-gold)" ? "var(--greek-blue)" : meta.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {opt.label}
                </span>
              );
            })}
          </div>
          <div className="flex gap-2">
            <GlassButton onClick={exportIcs} variant="outline" size="sm">
              <Download className="w-4 h-4" /> Exporter (.ics)
            </GlassButton>
            <GlassButton
              onClick={() => { setSelectedEvent(null); setSelectedDate(new Date().toISOString().slice(0, 10)); setModalOpen(true); }}
              variant="navy" size="sm"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </GlassButton>
          </div>
        </div>

        <CalendarView events={events} globalEvents={globalEvents} onDayClick={handleDayClick} onEventClick={handleEventClick} />
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={selectedEvent && !selectedEvent.isVirtual ? handleDelete : undefined}
        initialDate={selectedDate}
        event={selectedEvent}
        isParent={false}
        saving={saving}
      />
    </div>
  );
}
