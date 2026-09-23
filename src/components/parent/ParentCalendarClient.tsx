"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Calendar } from "lucide-react";
import PageHero from "@/components/PageHero";
import GlassButton from "@/components/ui/GlassButton";
import CalendarApp from "@/components/calendar/CalendarApp";
import type { CalendarEventItem } from "@/components/calendar/calendarUtils";

/** Calendrier du parent : le sien, celui de chaque enfant, ou toute la
 * famille. L'échéance d'abonnement s'ajoute à son propre calendrier. */
export default function ParentCalendarClient({
  parentId, parentName, initialChildren, initialEvents, initialGlobalEvents, initialSchoolZone,
}: {
  parentId: number;
  parentName: string;
  initialChildren: { id: number; first_name: string }[];
  initialEvents: CalendarEventItem[];
  initialGlobalEvents: CalendarEventItem[];
  initialSchoolZone: string;
}) {
  const [subscriptionEvent, setSubscriptionEvent] = useState<CalendarEventItem | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/parent/subscription-details")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const sub = d?.subscription;
        if (!alive || !sub?.current_period_end) return;
        setSubscriptionEvent({
          id: "virtual-subscription",
          title: sub.cancel_at_period_end ? "Fin de l'abonnement" : "Renouvellement de l'abonnement",
          description: "Échéance de votre abonnement Educalcul.",
          event_type: "abonnement",
          start_date: String(sub.current_period_end).slice(0, 10),
          isVirtual: true,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-16">
      <PageHero
        icon={Calendar}
        title="Calendrier scolaire"
        badge="Parent"
        subtitle="Contrôles, devoirs, révisions et vacances de toute la famille. Cliquez sur un jour pour voir ce qui est prévu."
        top={
          <GlassButton href="/parent/dashboard" variant="light" size="sm">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </GlassButton>
        }
      />
      <div className="container mx-auto max-w-7xl px-4">
        <CalendarApp
          role="parent"
          meId={parentId}
          owners={[{ id: parentId, name: parentName }, ...initialChildren.map((c) => ({ id: c.id, name: c.first_name }))]}
          initialOwnerId={parentId}
          initialEvents={initialEvents}
          initialGlobalEvents={initialGlobalEvents}
          initialZone={initialSchoolZone}
          extraEvents={subscriptionEvent ? [subscriptionEvent] : []}
        />
      </div>
    </div>
  );
}
