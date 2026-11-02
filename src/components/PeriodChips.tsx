"use client";

import type { Loose } from "@/types/loose";
import { Star } from "lucide-react";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { shortPeriodLabel } from "@/lib/billingPeriods";

/** Choix de la durée à l'intérieur d'une fiche (« 1 mois · 3 mois · 1 an ») ; une étoile marque la durée mise en avant. */
export default function PeriodChips<T extends { id: string | number; billing_interval: string; features?: Loose }>({
  plans, value, onChange,
}: {
  plans: T[];
  value: string | number;
  onChange: (id: string) => void;
}) {
  if (plans.length < 2) return null;
  const flagged = (p: T) => {
    try {
      const f = typeof p.features === "string" ? JSON.parse(p.features) : p.features;
      return f?.popular === true;
    } catch {
      return false;
    }
  };
  return (
    <div className="flex justify-center px-4 pt-5">
      <GlassSegmentedControl
        size="sm"
        value={String(value)}
        onChange={onChange}
        options={plans.map((p) => ({
          id: String(p.id),
          label: (
            <span className="inline-flex items-center gap-1">
              {shortPeriodLabel(p.billing_interval)}
              {flagged(p) && <Star className="w-3 h-3 fill-current text-[var(--greek-gold)]" aria-label="Populaire" />}
            </span>
          ),
        }))}
      />
    </div>
  );
}
