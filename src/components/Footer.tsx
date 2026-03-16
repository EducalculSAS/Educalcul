import Link from "next/link";
import {
  Calculator,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
} from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="modern-footer bg-[#3a6ea5] text-white relative overflow-hidden py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 text-[var(--greek-bronze)] font-[family-name:var(--font-display)] font-bold text-2xl mb-4">
              <Calculator className="w-6 h-6" />
              <span>Educalcul</span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Plateforme d'apprentissage des mathématiques innovante, conçue
              pour accompagner chaque enfant dans sa réussite scolaire avec des
              méthodes pédagogiques modernes et ludiques.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[var(--greek-bronze)] hover:-translate-y-1 transition-all duration-300"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[var(--greek-bronze)] hover:-translate-y-1 transition-all duration-300"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[var(--greek-bronze)] hover:-translate-y-1 transition-all duration-300"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-[var(--greek-bronze)] hover:-translate-y-1 transition-all duration-300"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h6 className="text-[var(--greek-bronze)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-bronze)]">
              Navigation
            </h6>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/offres"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
                  Nos Offres
                </Link>
              </li>
              <li>
                <Link
                  href="/tarifs"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
                  Formules
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h6 className="text-[var(--greek-bronze)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-bronze)]">
              Support
            </h6>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/parent/dashboard"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
                  Espace Parents
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
                  Nous contacter
                </Link>
              </li>
            </ul>
          </div>

          {/* Informations */}
          <div>
            <h6 className="text-[var(--greek-bronze)] font-[family-name:var(--font-display)] font-semibold text-lg mb-5 relative inline-block after:content-[''] after:absolute after:-bottom-1 after:left-0 after:w-8 after:h-0.5 after:bg-[var(--greek-bronze)]">
              Informations
            </h6>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/faq"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
                  Questions fréquentes
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-white/90 hover:text-[var(--greek-bronze)] hover:translate-x-1 transition-all duration-300 inline-block"
                >
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
            <Link
              href="/mentions-legales"
              className="text-white/70 text-sm hover:text-[var(--greek-bronze)] transition-colors"
            >
              Mentions légales
            </Link>
            <Link
              href="/politique-confidentialite"
              className="text-white/70 text-sm hover:text-[var(--greek-bronze)] transition-colors"
            >
              Politique de confidentialité
            </Link>
            <Link
              href="/cgu"
              className="text-white/70 text-sm hover:text-[var(--greek-bronze)] transition-colors"
            >
              CGU
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
