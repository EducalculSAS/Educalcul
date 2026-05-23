/* Copie exacte du Footer du site — adapté SPA (Link → button pour nav interne) */
import type { View } from "./Navbar";

interface FooterProps {
  onNavigate?: (view: View) => void;
}

const SITE_URL = "https://educalcul.fr";

export default function Footer({ onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const nav = (view: View) => {
    onNavigate?.(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderSocialIcon = (label: string) => {
    switch (label) {
      case "Facebook":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
            <path d="M13.5 9H16V6h-2.5C11.57 6 10 7.57 10 9.5V11H8v3h2v6h3v-6h2.5l.5-3H13v-1.5c0-.28.22-.5.5-.5Z" />
          </svg>
        );
      case "Twitter":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
            <path d="M18.9 7.3c.01.17.01.34.01.5C18.91 13.2 14.98 19 7.8 19c-2.26 0-4.36-.66-6.13-1.8.31.04.62.06.94.06 1.88 0 3.61-.64 4.98-1.72a3.27 3.27 0 0 1-3.05-2.27c.2.03.4.05.61.05.29 0 .57-.04.83-.11a3.27 3.27 0 0 1-2.62-3.2v-.04c.44.25.95.4 1.49.42a3.27 3.27 0 0 1-1.01-4.37 9.28 9.28 0 0 0 6.74 3.42 3.27 3.27 0 0 1 5.57-2.98c.72-.14 1.41-.4 2.03-.77a3.28 3.28 0 0 1-1.44 1.81c.66-.08 1.29-.25 1.88-.51-.44.67-1 1.26-1.64 1.74Z" />
          </svg>
        );
      case "Instagram":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
            <path d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Zm0 2A2.5 2.5 0 0 0 5 7.5v9A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 16.5 5h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-.9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" />
          </svg>
        );
      case "Youtube":
      default:
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
            <path d="M21.6 8.2a3 3 0 0 0-2.1-2.1C17.7 5.6 12 5.6 12 5.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 8.2 31.7 31.7 0 0 0 2 12a31.7 31.7 0 0 0 .4 3.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 22 12a31.7 31.7 0 0 0-.4-3.8ZM10.5 14.6V9.4L15 12l-4.5 2.6Z" />
          </svg>
        );
    }
  };

  const navBtn = (view: View, label: string) => (
    <li>
      <button
        onClick={() => nav(view)}
        className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block bg-transparent border-none cursor-pointer p-0"
      >
        {label}
      </button>
    </li>
  );

  return (
    <footer className="bg-[#3a6ea5] text-white relative overflow-hidden py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="col-span-1">
            <div className="flex items-center gap-3 font-[family-name:var(--font-display)] font-bold text-2xl mb-4 text-white">
              <img src="/logo.png" alt="logo" className="w-10 h-10 relative -top-0.5" onError={e => (e.currentTarget.style.display = 'none')} />
              <span className="text-white">Educalcul</span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Plateforme d'apprentissage des mathématiques innovante, conçue
              pour accompagner chaque enfant dans sa réussite scolaire avec des
              méthodes pédagogiques modernes et ludiques.
            </p>
            <div className="flex gap-4">
              {(["Facebook", "Twitter", "Instagram", "Youtube"] as const).map((label, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[var(--greek-gold)] hover:-translate-y-1 transition-all duration-300"
                >
                  {renderSocialIcon(label)}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h6 className="text-[var(--greek-gold)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-gold)]">
              Explorer
            </h6>
            <ul className="space-y-2">
              {navBtn("offres", "Nos Offres")}
              {navBtn("tarifs", "Tarifs")}
            </ul>
          </div>

          <div>
            <h6 className="text-[var(--greek-gold)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-gold)]">
              Compte
            </h6>
            <ul className="space-y-2">
              <li>
                <a href={`${SITE_URL}/auth/connexion`} className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  Se connecter
                </a>
              </li>
              <li>
                <a href={`${SITE_URL}/auth/inscription`} className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  Inscription
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="text-[var(--greek-gold)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-gold)]">
              Aide
            </h6>
            <ul className="space-y-2">
              {navBtn("faq", "FAQ")}
              {navBtn("contact", "Contact")}
            </ul>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[rgba(197,161,72,0.5)] to-transparent my-8"></div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/70 text-sm">
            &copy; {currentYear} Educalcul. Tous droits réservés.
          </p>
          <div className="flex gap-6">
            {[
              ["Mentions légales", `${SITE_URL}/mentions-legales`],
              ["Politique de confidentialité", `${SITE_URL}/politique-confidentialite`],
              ["CGU", `${SITE_URL}/cgu`],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-white/70 text-sm hover:text-[var(--greek-gold)] transition-colors">
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
