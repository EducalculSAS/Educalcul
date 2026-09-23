"use client";

import { ArrowLeft, Calendar } from "lucide-react";
import PageHero from "@/components/PageHero";
import GlassButton from "@/components/ui/GlassButton";
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
        icon={Calendar}
        title="Mon calendrier"
        badge="Élève"
        subtitle="Tes contrôles, devoirs, révisions et vacances. Clique sur un jour pour voir ce qui est prévu."
        top={
          <GlassButton href="/child/dashboard" variant="light" size="sm">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
          </GlassButton>
        }
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
