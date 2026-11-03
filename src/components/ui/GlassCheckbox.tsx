import type { InputHTMLAttributes } from "react";

/**
 * Case à cocher « verre liquide » — la seule du site, avec GlassSwitch pour les oui/non.
 * C'est un vrai `<input type="checkbox">` (clavier, formulaires, `<label>` cliquable, lecteurs d'écran) dont l'apparence est dessinée
 * par la pastille voisine : verre translucide au repos, dégradé bleu nuit et coche blanche une fois cochée.
 * Accepte les mêmes props qu'un input (checked, onChange, disabled, required, aria-label…).
 */
export default function GlassCheckbox({ className = "", large = false, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & { large?: boolean }) {
  return (
    <span className={`glass-check ${large ? "glass-check-lg" : ""} relative inline-flex shrink-0 ${className}`}>
      <input type="checkbox" className="glass-check-input peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" {...props} />
      <span aria-hidden="true" className="glass-check-box">
        <svg viewBox="0 0 16 16" className="glass-check-mark" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    </span>
  );
}
