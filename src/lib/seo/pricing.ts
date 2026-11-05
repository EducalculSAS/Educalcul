import type { Plan } from "@/lib/plans";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Prix publiés pour les moteurs de recherche (données structurées et description de /tarifs), lus dans les MÊMES formules
 * que la page : jamais recopiés à la main (des prix écrits en dur avaient fini par différer de ceux que le site vend vraiment).
 */
const ISO_DURATION: Record<string, string> = { month: "P1M", quarter: "P3M", semester: "P6M", year: "P1Y" };

/** « Solo - 1 an » → « Solo ». */
export const planFamily = (name: string) => name.split(" - ")[0].trim();

const euros = (n: number) => String(Number(n.toFixed(2))).replace(".", ",");

export function offersSchema(plans: Plan[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Formules Educalcul",
    url: `${SITE_URL}/tarifs`,
    itemListElement: plans.map((p, i) => {
      const price = String(Number(p.price));
      const duration = ISO_DURATION[p.billing_interval];
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Offer",
          name: p.name,
          ...(p.description ? { description: p.description } : {}),
          price,
          priceCurrency: "EUR",
          ...(Number(p.price) > 0 && duration ? { priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency: "EUR", billingDuration: duration } } : {}),
          availability: "https://schema.org/InStock",
          url: `${SITE_URL}/auth/inscription`,
          seller: { "@type": "Organization", name: "Educalcul" },
        },
      };
    }),
  };
}

/** Description de la page : le prix mensuel le plus bas de chaque formule payante, ou un texte neutre si les formules sont indisponibles. */
export function pricingDescription(plans: Plan[]): string {
  const tail = "7 jours d'essai sans engagement, sans carte bancaire.";
  const free = plans.find((p) => Number(p.price) === 0);
  const monthly = new Map<string, number>();
  for (const p of plans) {
    if (Number(p.price) > 0 && p.billing_interval === "month") {
      const fam = planFamily(p.name);
      monthly.set(fam, Math.min(monthly.get(fam) ?? Infinity, Number(p.price)));
    }
  }
  if (!free && monthly.size === 0) return `Formules Educalcul : cours de maths, exercices et tuteur IA du CP à la Terminale. ${tail}`;
  const parts = [free ? `${planFamily(free.name)} (gratuite)` : null, ...[...monthly].map(([name, price]) => `${name} dès ${euros(price)} €/mois`)].filter(Boolean);
  return `Formules Educalcul : ${parts.join(", ")}. ${tail}`;
}

export interface PriceTable {
  /** Périodes présentes (dans l'ordre demandé), avec leur libellé. */
  columns: { id: string; label: string }[];
  rows: { name: string; maxChildren: number | null; prices: Record<string, number> }[];
  /** Formule gratuite, si elle existe. */
  free: { name: string; maxChildren: number | null } | null;
}

const maxChildrenOf = (p: Plan): number | null => (typeof p.features?.max_children === "number" ? (p.features.max_children as number) : null);

/** Tous les prix en un tableau (formule × période), lu dans les formules actives : le texte de la page ne montre plus un seul tarif. */
export function priceTable(plans: Plan[], periods: { id: string; label: string }[]): PriceTable {
  const paid = plans.filter((p) => Number(p.price) > 0);
  const present = new Set(paid.map((p) => p.billing_interval));
  const columns = periods.filter((c) => present.has(c.id));
  const byFamily = new Map<string, PriceTable["rows"][number]>();
  for (const p of paid) {
    const fam = planFamily(p.name);
    const row = byFamily.get(fam) ?? { name: fam, maxChildren: maxChildrenOf(p), prices: {} };
    row.prices[p.billing_interval] = Number(p.price);
    byFamily.set(fam, row);
  }
  const free = plans.find((p) => Number(p.price) === 0);
  return { columns, rows: [...byFamily.values()], free: free ? { name: planFamily(free.name), maxChildren: maxChildrenOf(free) } : null };
}

export const formatEuros = euros;
