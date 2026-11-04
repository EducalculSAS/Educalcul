import { SEO_UPDATED, formatFrDate } from "@/lib/seo/site";

/**
 * « En bref » : les faits essentiels de la page en quelques lignes, en texte simple, placés avant le détail. Les moteurs
 * de recherche et les assistants IA y trouvent une réponse directe et citable ; le lecteur y trouve l'essentiel.
 */
export default function QuickFacts({ title = "En bref", facts, updated = SEO_UPDATED }: { title?: string; facts: { label: string; value: React.ReactNode }[]; updated?: string }) {
  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]" aria-label={title}>
      <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4">{title}</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_1fr] gap-x-6 gap-y-3 text-sm">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="font-semibold text-[var(--greek-blue)]">{f.label}</dt>
            <dd className="text-gray-600 leading-relaxed">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-400 mt-4">Mis à jour le <time dateTime={updated}>{formatFrDate(updated)}</time>.</p>
    </section>
  );
}
