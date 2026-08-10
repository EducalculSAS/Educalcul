"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, Plus, ArrowRight } from "lucide-react";
import CalendarView, { CalendarEventItem } from "./CalendarView";
import EventModal from "./EventModal";
import { getEventTypeMeta } from "@/lib/calendarEventTypes";
import { supabase } from "@/lib/supabaseClient";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}` };
}

interface MiniCalendarWidgetProps {
  authId: string;
  ownerId: number;
  isParent: boolean;
  title?: string;
  fullCalendarHref: string;
}

export default function MiniCalendarWidget({ authId, ownerId, isParent, title = "Calendrier", fullCalendarHref }: MiniCalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [globalEvents, setGlobalEvents] = useState<CalendarEventItem[]>([]);
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

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const upcoming = events
    .filter(e => e.start_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 4);

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
    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-[var(--greek-gold)]" />
          <h2 className="text-xl font-bold text-[var(--greek-blue)]">{title}</h2>
        </div>
        <Link href={fullCalendarHref} className="text-sm text-[var(--greek-blue)] font-bold hover:underline flex items-center gap-1">
          Voir tout <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <CalendarView
          events={events}
          globalEvents={globalEvents}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
          compact
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--greek-bronze)] uppercase tracking-wide">À venir</h3>
            <button
              onClick={() => { setSelectedEvent(null); setSelectedDate(new Date().toISOString().slice(0, 10)); setModalOpen(true); }}
              className="flex items-center gap-1 text-xs font-bold text-[var(--greek-blue)] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--greek-bronze)] mt-2">Aucun événement à venir.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map(ev => {
                const meta = getEventTypeMeta(ev.event_type);
                return (
                  <button
                    key={ev.id}
                    onClick={() => handleEventClick(ev)}
                    className="flex items-center gap-3 text-left p-2 rounded-[10px] hover:bg-[rgba(197,161,72,0.08)] transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--greek-blue)] truncate">{ev.title}</p>
                      <p className="text-xs text-[var(--greek-bronze)]">
                        {new Date(ev.start_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={selectedEvent && !selectedEvent.isVirtual ? handleDelete : undefined}
        initialDate={selectedDate}
        event={selectedEvent}
        isParent={isParent}
        saving={saving}
      />
    </div>
  );
}
