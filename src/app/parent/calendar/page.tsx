"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Download, Sparkles, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AppAdminLoader from "@/components/AppAdminLoader";
import CalendarView, { CalendarEventItem } from "@/components/calendar/CalendarView";
import EventModal from "@/components/calendar/EventModal";
import { getEventTypeMeta, PARENT_ONLY_EVENT_TYPE_OPTIONS } from "@/lib/calendarEventTypes";
import { STUDENT_ZONE_OPTIONS } from "@/lib/calendarZones";

interface ChildOption {
  id: number;
  first_name: string;
}

export default function ParentCalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authId, setAuthId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeOwnerId, setActiveOwnerId] = useState<number | null>(null);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [globalEvents, setGlobalEvents] = useState<CalendarEventItem[]>([]);
  const [schoolZone, setSchoolZone] = useState("C");
  const [subscriptionEvent, setSubscriptionEvent] = useState<CalendarEventItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const loadEvents = useCallback(async (uid: string, oId: number) => {
    const res = await fetch(`/api/calendar/events?userId=${uid}&ownerId=${oId}`);
    const data = await res.json();
    setEvents(data.events || []);
    setGlobalEvents(data.globalEvents || []);
    setSchoolZone(data.schoolZone || "C");
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/connexion"); return; }

      const { data: userData } = await supabase.from("users").select("id, role").eq("auth_id", session.user.id).maybeSingle();
      if (!userData || userData.role !== "parent") { router.push("/dashboard"); return; }

      setAuthId(session.user.id);
      setParentId(userData.id);

      const { data: childrenData } = await supabase.from("users").select("id, first_name").eq("role", "child").eq("parent_id", userData.id).order("first_name");
      setChildren(childrenData || []);

      setActiveOwnerId(userData.id);
      await loadEvents(session.user.id, userData.id);

      const subRes = await fetch(`/api/parent/subscription-details?userId=${session.user.id}`);
      const subData = await subRes.json();
      if (subData.subscription?.current_period_end) {
        const date = subData.subscription.current_period_end.slice(0, 10);
        setSubscriptionEvent({
          id: "virtual-subscription",
          title: subData.subscription.cancel_at_period_end ? "Fin de l'abonnement" : "Renouvellement de l'abonnement",
          description: "Échéance de votre abonnement Educalcul",
          event_type: "abonnement",
          start_date: date,
          isVirtual: true,
        });
      }

      setLoading(false);
    })();
  }, [router, loadEvents]);

  const switchOwner = async (oId: number) => {
    if (!authId) return;
    setActiveOwnerId(oId);
    setLoading(true);
    await loadEvents(authId, oId);
    setLoading(false);
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
    if (!authId || !activeOwnerId) return;
    setSaving(true);
    try {
      if (selectedEvent && !selectedEvent.isVirtual) {
        await fetch(`/api/calendar/events/${selectedEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: authId, ...data }),
        });
      } else {
        await fetch(`/api/calendar/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: authId, ownerId: activeOwnerId, ...data }),
        });
      }
      await loadEvents(authId, activeOwnerId);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!authId || !activeOwnerId || !selectedEvent) return;
    setSaving(true);
    try {
      await fetch(`/api/calendar/events/${selectedEvent.id}?userId=${authId}`, { method: "DELETE" });
      await loadEvents(authId, activeOwnerId);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleZoneChange = async (zone: string) => {
    if (!authId || !activeOwnerId) return;
    setSchoolZone(zone);
    await fetch(`/api/calendar/zone`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: authId, ownerId: activeOwnerId, zone }),
    });
    await loadEvents(authId, activeOwnerId);
  };

  const handleSuggest = async () => {
    if (!authId || !activeOwnerId || activeOwnerId === parentId) return;
    setSuggesting(true);
    try {
      const res = await fetch(`/api/calendar/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: authId, childId: activeOwnerId }),
      });
      if (res.ok) await loadEvents(authId, activeOwnerId);
    } finally {
      setSuggesting(false);
    }
  };

  if (loading && events.length === 0 && !activeOwnerId) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]"><AppAdminLoader /></div>;
  }

  const isOwnCalendar = activeOwnerId === parentId;
  const displayEvents = isOwnCalendar && subscriptionEvent ? [...events, subscriptionEvent] : events;

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-10 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <Link href="/parent/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 mb-3">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </Link>
          <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <Calendar className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            CALENDRIER SCOLAIRE
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              PARENT
            </span>
            <span>Contrôles, devoirs, vacances et abonnement.</span>
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        {/* Onglets calendrier */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => switchOwner(parentId!)}
            className={`px-4 py-2 rounded-[10px] text-sm font-bold transition-colors ${
              activeOwnerId === parentId
                ? "bg-[var(--greek-blue)] text-white"
                : "bg-white border border-[rgba(197,161,72,0.3)] text-[var(--greek-blue)] hover:bg-[rgba(197,161,72,0.08)]"
            }`}
          >
            Mon calendrier
          </button>
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => switchOwner(c.id)}
              className={`px-4 py-2 rounded-[10px] text-sm font-bold transition-colors ${
                activeOwnerId === c.id
                  ? "bg-[var(--greek-blue)] text-white"
                  : "bg-white border border-[rgba(197,161,72,0.3)] text-[var(--greek-blue)] hover:bg-[rgba(197,161,72,0.08)]"
              }`}
            >
              {c.first_name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {(isOwnCalendar ? PARENT_ONLY_EVENT_TYPE_OPTIONS : PARENT_ONLY_EVENT_TYPE_OPTIONS).concat([{ value: "vacances" as any, label: "Vacances" }]).map(opt => {
              const meta = getEventTypeMeta(opt.value);
              return (
                <span key={opt.value} className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: meta.color + "20", color: meta.color === "var(--greek-gold)" ? "var(--greek-blue)" : meta.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {opt.label}
                </span>
              );
            })}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--greek-blue)]">
              Zone scolaire
              <select
                value={schoolZone}
                onChange={e => handleZoneChange(e.target.value)}
                className="px-2 py-1.5 rounded-[8px] border border-[rgba(197,161,72,0.3)] text-xs bg-white outline-none focus:ring-2 focus:ring-[var(--greek-blue)]"
              >
                {STUDENT_ZONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            {!isOwnCalendar && (
              <button
                onClick={handleSuggest}
                disabled={suggesting}
                className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-[10px] border border-[rgba(197,161,72,0.3)] text-[var(--greek-gold)] hover:bg-[rgba(197,161,72,0.08)] transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" /> {suggesting ? "Génération..." : "Suggestion IA"}
              </button>
            )}
            {authId && activeOwnerId && (
              <a
                href={`/api/calendar/export?token=${authId}&ownerId=${activeOwnerId}`}
                className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-[10px] border border-[rgba(197,161,72,0.3)] text-[var(--greek-blue)] hover:bg-[rgba(197,161,72,0.08)] transition-colors"
              >
                <Download className="w-4 h-4" /> Exporter (.ics)
              </a>
            )}
            <button
              onClick={() => { setSelectedEvent(null); setSelectedDate(new Date().toISOString().slice(0, 10)); setModalOpen(true); }}
              className="btn-primary-greek flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
        </div>

        <CalendarView events={displayEvents} globalEvents={globalEvents} onDayClick={handleDayClick} onEventClick={handleEventClick} />
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={selectedEvent && !selectedEvent.isVirtual ? handleDelete : undefined}
        initialDate={selectedDate}
        event={selectedEvent}
        isParent={true}
        saving={saving}
      />
    </div>
  );
}
