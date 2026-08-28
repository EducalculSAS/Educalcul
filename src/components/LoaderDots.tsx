/** Variante compacte du loader admin (AppLoader) pour un usage inline
 * (bouton, badge...) — mêmes trois points rebondissants aux couleurs du
 * thème, sans le logo ni le plein écran. */
export default function LoaderDots({ className = "" }: { className?: string }) {
  return (
    <span className={`flex gap-1 items-center ${className}`}>
      <span className="w-1.5 h-1.5 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 bg-[var(--greek-gold)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
