/**
 * Indicateur de chargement du site, en version compacte (bouton, ligne, pastille) : trois points qui rebondissent.
 * Les points extérieurs prennent la couleur du texte qui les entoure (lisibles sur un bouton bleu nuit comme sur fond
 * blanc), le point central est doré. Remplace partout les roues de chargement génériques.
 */
export default function LoaderDots({ className = "", size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const dot = size === "md" ? "w-2.5 h-2.5" : "w-1.5 h-1.5";
  return (
    <span role="status" aria-label="Chargement" className={`inline-flex gap-1 items-center align-middle ${className}`}>
      <span className={`${dot} bg-current rounded-full animate-bounce`} style={{ animationDelay: "0ms" }} />
      <span className={`${dot} bg-[var(--greek-gold)] rounded-full animate-bounce`} style={{ animationDelay: "150ms" }} />
      <span className={`${dot} bg-current rounded-full animate-bounce`} style={{ animationDelay: "300ms" }} />
    </span>
  );
}
