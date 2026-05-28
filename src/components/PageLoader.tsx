import Image from "next/image";

/**
 * Loader branded Educalcul — utilisé pour les états de chargement de sections/pages.
 * Remplace les `animate-spin rounded-full` spinner génériques.
 */
export default function PageLoader({ className = "h-64" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center w-full ${className}`}>
      <div className="text-center">
        <Image
          src="/logo.png"
          alt="Educalcul"
          width={48}
          height={48}
          className="w-12 h-12 mx-auto mb-3 animate-pulse opacity-60"
        />
        <div className="flex gap-1.5 justify-center">
          <span className="w-1.5 h-1.5 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-[var(--greek-gold)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-[var(--greek-blue)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
