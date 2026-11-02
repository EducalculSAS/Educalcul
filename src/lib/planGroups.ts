import { monthsOfPeriod } from "@/lib/billingPeriods";

/** « Solo - 1 mois » et « Solo - 1 an » sont deux lignes de la même formule : le nom commun (« Solo ») sert à les regrouper. */
const baseName = (name: string): string => name.split(/\s+[-–—·]\s+/)[0].trim() || name;

export interface PlanGroup<T> {
  key: string;
  name: string;
  /** Les durées de la formule, de la plus courte à la plus longue. */
  plans: T[];
}

/** Regroupe les formules par nom commun (ordre d'apparition conservé) ; chaque groupe est trié par durée. */
export function groupPlans<T extends { name: string; billing_interval: string }>(plans: T[]): PlanGroup<T>[] {
  const groups = new Map<string, PlanGroup<T>>();
  for (const p of plans) {
    const name = baseName(p.name);
    const key = name.toLowerCase();
    const g = groups.get(key) ?? { key, name, plans: [] };
    g.plans.push(p);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    plans: [...g.plans].sort((a, b) => (monthsOfPeriod(a.billing_interval) ?? Infinity) - (monthsOfPeriod(b.billing_interval) ?? Infinity)),
  }));
}
