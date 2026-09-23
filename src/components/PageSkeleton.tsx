/**
 * Squelette affiché pendant le chargement d'une page (fichiers loading.tsx).
 *
 * Il reprend la FORME de la page qui arrive (en-tête bleu, cartes) au lieu
 * d'un écran vide avec un logo : la transition paraît continue. Il n'apparaît
 * qu'après 150 ms (classe .appear-late) — une navigation rapide passe donc
 * directement d'une page à l'autre, sans flash intermédiaire.
 *
 * Il sert aussi de limite de préchargement à Next.js : survoler un lien ne
 * précharge que ce squelette statique, jamais les données de la page.
 */
export default function PageSkeleton({ variant = "app" }: { variant?: "app" | "admin" | "viewer" }) {
  if (variant === "admin") {
    return (
      <div className="space-y-6 appear-late" aria-busy="true" aria-label="Chargement">
        <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] p-6">
          <div className="skeleton h-8 w-64 mb-3" />
          <div className="skeleton h-4 w-96 max-w-full" />
        </div>
        <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "viewer") {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-16 appear-late" aria-busy="true" aria-label="Chargement">
        <div className="skeleton h-9 w-32 rounded-full mb-6" />
        <div className="bg-white rounded-3xl border border-[rgba(197,161,72,0.25)] p-8 space-y-4">
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-11/12" />
          <div className="skeleton h-4 w-4/5" />
          <div className="skeleton h-48 w-full rounded-2xl mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] appear-late" aria-busy="true" aria-label="Chargement">
      <div className="bg-[var(--greek-blue)] pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8">
        <div className="max-w-6xl mx-auto">
          <div className="skeleton skeleton-dark h-6 w-24 rounded-full mb-4" />
          <div className="skeleton skeleton-dark h-12 w-72 max-w-full mb-3" />
          <div className="skeleton skeleton-dark h-5 w-96 max-w-full" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.22)] p-6 space-y-3">
            <div className="skeleton w-12 h-12 rounded-2xl" />
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
