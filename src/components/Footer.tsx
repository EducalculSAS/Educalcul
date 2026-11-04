"use client";

import Image from "next/image";
import { Mail } from "lucide-react";
import { Facebook, Twitter, Instagram, Youtube } from "@/components/ui/BrandIcons";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassButton from "@/components/ui/GlassButton";

const SOCIALS = [
  { icon: Facebook, label: "Facebook" },
  { icon: Twitter, label: "Twitter" },
  { icon: Instagram, label: "Instagram" },
  { icon: Youtube, label: "YouTube" },
];

const NAV_COLS = [
  {
    title: "Explorer",
    links: [
      { label: "Nos Offres", href: "/offres" },
      { label: "Tarifs", href: "/tarifs" },
      { label: "Programmes", href: "/programmes" },
      { label: "Calia, tuteur IA", href: "/calia-tuteur-ia-maths" },
      { label: "Méthode pédagogique", href: "/methode-pedagogique" },
      { label: "À propos", href: "/a-propos" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Compte",
    links: [
      { label: "Se connecter", href: "/auth/connexion" },
      { label: "Créer un compte", href: "/auth/inscription" },
    ],
  },
  {
    title: "Aide",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Confidentialité", href: "/politique-confidentialite" },
      { label: "CGU", href: "/cgu" },
      { label: "CGV", href: "/cgv" },
    ],
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ background: "var(--greek-blue)" }} className="text-white mt-auto">
      <div className="container mx-auto px-6 py-16 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="md:col-span-1">
            <Image src="/logo.png" alt="Educalcul" width={84} height={48} className="h-12 w-auto object-contain mb-5" />
            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>
              Plateforme d&apos;apprentissage des mathématiques, du CP à la Terminale.
              IA pédagogique, progression gamifiée, suivi parents.
            </p>
            <a href="mailto:contact@educalcul.com"
              className="flex items-center gap-2 text-sm mb-5 transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <Mail className="w-4 h-4 shrink-0" />
              contact@educalcul.com
            </a>
            <div className="flex gap-3">
              {SOCIALS.map((s) => (
                <GlassIconButton key={s.label} icon={s.icon} href="#" color="white" aria-label={s.label} />
              ))}
            </div>
          </div>

          {/* Nav cols */}
          {NAV_COLS.map((col) => (
            <div key={col.title}>
              <p
                className="text-xs font-bold tracking-widest uppercase mb-4 text-center font-[family-name:var(--font-display)]"
                style={{ color: "var(--greek-gold)" }}
              >
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <GlassButton
                      href={l.href}
                      size="sm"
                      fullWidth
                      className="text-sm"
                      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}
                    >
                      {l.label}
                    </GlassButton>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-10 h-px" style={{ background: "rgba(197,161,72,0.2)" }} />

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            &copy; {currentYear} Educalcul. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
