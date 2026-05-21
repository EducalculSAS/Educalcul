/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="modern-footer bg-[#3a6ea5] text-white relative overflow-hidden py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="col-span-1">
            <div className="flex items-center gap-3 font-[family-name:var(--font-display)] font-bold text-2xl mb-4 text-white">
              <img src="/logo.png" alt="logo" className="w-10 h-10 relative -top-0.5" />
              <span className="text-white">Educalcul</span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Plateforme d&apos;apprentissage des mathématiques innovante, conçue
              pour accompagner chaque enfant dans sa réussite scolaire avec des
              méthodes pédagogiques modernes et ludiques.
            </p>
            <div className="flex gap-4">
              {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[var(--greek-gold)] hover:-translate-y-1 transition-all duration-300"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h6 className="text-[var(--greek-gold)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-gold)]">
              Explorer
            </h6>
            <ul className="space-y-2">
              <li>
                <Link href="/offres" className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  Nos Offres
                </Link>
              </li>
              <li>
                <Link href="/tarifs" className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  Tarifs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="text-[var(--greek-gold)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-gold)]">
              Compte
            </h6>
            <ul className="space-y-2">
              <li>
                <Link href="/auth/connexion" className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  Se connecter
                </Link>
              </li>
              <li>
                <Link href="/auth/inscription" className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  Inscription
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="text-[var(--greek-gold)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-gold)]">
              Aide
            </h6>
            <ul className="space-y-2">
              <li>
                <Link href="/faq" className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-white/90 hover:text-[var(--greek-gold)] hover:translate-x-1 transition-all duration-300 inline-block">
                  Contact
                </Link>
              </li>
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
              ["Mentions légales", "/mentions-legales"],
              ["Politique de confidentialité", "/politique-confidentialite"],
              ["CGU", "/cgu"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="text-white/70 text-sm hover:text-[var(--greek-gold)] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
