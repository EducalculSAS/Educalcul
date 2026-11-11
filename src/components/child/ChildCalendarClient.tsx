"use client";


import PageHero from "@/components/PageHero";
import CalendarApp from "@/components/calendar/CalendarApp";
import type { CalendarEventItem } from "@/components/calendar/calendarUtils";

/** Calendrier de l'élève (données initiales chargées par le serveur). */
export default function ChildCalendarClient({
  meId, name, initialEvents, initialGlobalEvents, initialZone,
}: {
  meId: number;
  name: string;
  initialEvents: CalendarEventItem[];
  initialGlobalEvents: CalendarEventItem[];
  initialZone: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-16">
      <PageHero
        emblem="calendar"
        title="Mon calendrier"
        badge="Élève"
        subtitle="Tes contrôles, devoirs, révisions et vacances. Clique sur un jour pour voir ce qui est prévu."
        back={{ href: "/child/dashboard", label: "Tableau de bord" }}
      />
      <div className="container mx-auto max-w-7xl px-4">
        <CalendarApp
          role="child"
          meId={meId}
          owners={[{ id: meId, name }]}
          initialOwnerId={meId}
          initialEvents={initialEvents}
          initialGlobalEvents={initialGlobalEvents}
          initialZone={initialZone}
        />
      </div>
    </div>
  );
}
