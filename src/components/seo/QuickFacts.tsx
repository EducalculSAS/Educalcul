import { SEO_UPDATED, formatFrDate } from "@/lib/seo/site";
import { PUBLIC_CARD } from "@/components/public/PublicPage";

/**
 * « En bref » : les faits essentiels de la page en quelques lignes, en texte simple, placés avant le détail. Les moteurs
 * de recherche et les assistants IA y trouvent une réponse directe et citable ; le lecteur y trouve l'essentiel.
 * Même carte blanche que les autres pages publiques.
 */
export default function QuickFacts({ title = "En bref", facts, updated = SEO_UPDATED }: { title?: string; facts: { label: string; value: React.ReactNode }[]; updated?: string }) {
  return (
    <section className={PUBLIC_CARD} aria-label={title}>
      <h2 className="font-[family-name:var(--font-display)] font-bold text-xl mb-5" style={{ color: "var(--greek-blue)" }}>{title}</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,13rem)_1fr] gap-x-6 gap-y-3 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="font-semibold" style={{ color: "var(--greek-blue)" }}>{f.label}</dt>
            <dd className="leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs mt-5" style={{ color: "var(--text-muted)" }}>Mis à jour le <time dateTime={updated}>{formatFrDate(updated)}</time>.</p>
    </section>
  );
}
