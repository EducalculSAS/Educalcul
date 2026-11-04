import type { Metadata, Viewport } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css";

// Auto-hébergée au build par Next (fini le <link> Google Fonts qui bloquait
// le premier rendu le temps d'un aller-retour réseau vers fonts.googleapis.com
// + fonts.gstatic.com) et servie avec font-display: swap dès le départ.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-display",
  display: "swap",
});
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import CookieBanner from "@/components/CookieBanner";
import SessionStillHereModal from "@/components/SessionStillHereModal";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import JsonLd from "@/components/JsonLd";
import ThemeSync from "@/components/ThemeSync";
import AnimationGovernor from "@/components/AnimationGovernor";
import SeasonalDecor from "@/components/SeasonalDecor";
import PasswordRecoveryRedirect from "@/components/PasswordRecoveryRedirect";
import JsxFigureEnhancer from "@/components/JsxFigureEnhancer";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/opendyslexic/700.css";
import NavProgress from "@/components/NavProgress";

const BASE = "https://educalcul.com";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Educalcul",
  alternateName: "EC",
  url: BASE,
  logo: {
    "@type": "ImageObject",
    url: `${BASE}/logo.png`,
    width: 192,
    height: 110,
  },
  description: "Plateforme d'apprentissage des mathématiques du CP à la Terminale, cours, exercices, quiz et IA pédagogique Calia. Aligné sur les programmes officiels de l'Éducation Nationale.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${BASE}/contact`,
    availableLanguage: "French",
    areaServed: ["FR", "BE", "CH", "CA", "MA", "DZ", "TN"],
  },
  areaServed: { "@type": "Country", name: "France" },
  sameAs: [
    "https://fr.trustpilot.com/review/educalcul.com",
  ],
  foundingDate: "2025",
  knowsAbout: ["Mathématiques", "Éducation", "Intelligence Artificielle pédagogique", "Programme scolaire français"],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Educalcul",
  url: BASE,
  inLanguage: "fr-FR",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${BASE}/programmes?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
  publisher: { "@type": "Organization", name: "Educalcul", url: BASE },
};

const educationalOrgSchema = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "Educalcul",
  url: BASE,
  description: "Plateforme SaaS d'apprentissage des mathématiques du CP à la Terminale, avec IA pédagogique et suivi parental.",
  educationalCredentialAwarded: "Maîtrise des mathématiques du CP à la Terminale",
  // Prix/noms alignés sur la table `subscription_plans` (plans mensuels actifs) —
  // à resynchroniser manuellement si les tarifs changent, voir aussi
  // src/app/tarifs/layout.tsx (offersSchema) qui doit rester identique.
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Plans Educalcul",
    itemListElement: [
      { "@type": "Offer", name: "Plan Gratuit", price: "0", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Plan Solo", price: "9.99", priceCurrency: "EUR", billingDuration: "P1M" },
      { "@type": "Offer", name: "Plan Family", price: "16.99", priceCurrency: "EUR", billingDuration: "P1M" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f1e3a",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  // Safari transforme les suites de chiffres en liens téléphone : le HTML du navigateur ne correspond alors plus à celui du serveur (erreur React #418).
  formatDetection: { telephone: false, email: false, address: false },
  title: {
    default: "Educalcul : Cours de maths du CP à la Terminale avec IA",
    template: "%s | Educalcul",
  },
  description: "Educalcul accompagne vos enfants du CP à la Terminale avec des cours alignés sur le programme officiel, des exercices corrigés, une IA pédagogique (Calia) et un suivi parental en temps réel. Essai gratuit 7 jours.",
  keywords: [
    "cours de mathématiques", "exercices de maths", "programme officiel maths",
    "IA pédagogique mathématiques", "soutien scolaire maths", "mathématiques en ligne",
    "cours maths CP CE1 CE2 CM1 CM2", "cours maths collège lycée",
    "exercices maths terminale", "programme maths brevet bac",
    "Calia", "Educalcul", "plateforme maths enfants",
    "maths primaire", "maths collège", "maths lycée",
  ],
  authors: [{ name: "Educalcul", url: BASE }],
  creator: "Educalcul",
  publisher: "Educalcul",
  alternates: {
    canonical: BASE,
    languages: {
      "fr-FR": BASE,
      "fr-BE": BASE,
      "fr-CH": BASE,
      "fr-CA": BASE,
      "fr-MA": BASE,
      "fr-DZ": BASE,
      "fr-TN": BASE,
    },
  },
  openGraph: {
    title: "Educalcul : Cours de maths du CP à la Terminale avec IA",
    description: "Cours, exercices et IA pédagogique pour vos enfants, du CP à la Terminale. Aligné sur le programme officiel de l'Éducation Nationale.",
    url: BASE,
    siteName: "Educalcul",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Educalcul : La plateforme de maths du CP à la Terminale" },
    ],
    locale: "fr_FR",
    alternateLocale: ["fr_BE", "fr_CH", "fr_CA"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Educalcul : Cours de maths du CP à la Terminale avec IA",
    description: "Cours, exercices et IA pédagogique pour vos enfants, du CP à la Terminale.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "dncjn01vvZtOV9fLHpx3AmMD7rpxdAfkJ-KztiDGIrM",
  },
  category: "education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" dir="ltr" className={cinzel.variable} suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        {/* Thème sombre mémorisé : appliqué avant le premier rendu (pas de flash clair). */}
        {/* Thème + confort de lecture appliqués avant le premier rendu. Fichier externe (et non script en ligne) pour que la CSP stricte
            avec nonce n'ait rien à autoriser ici ; contenu : src/app/api/boot-script/route.ts */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- volontairement bloquant : le thème doit être posé avant le premier rendu (sinon flash de page claire) */}
        <script src="/api/boot-script" />
        {/* Geo meta tags */}
        <meta name="geo.region" content="FR" />
        <meta name="geo.country" content="FR" />
        <meta name="language" content="French" />
        <meta name="content-language" content="fr" />
      </head>
      <body className="antialiased min-h-screen flex flex-col overflow-x-hidden">
        {/* Filtre de la flamme du nom « Flamme » : fait onduler les lettres comme du feu (voir .name-flame dans globals.css) */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <filter id="fx-fire" x="-10%" y="-20%" width="120%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves="2" seed="3" result="n">
              <animate attributeName="baseFrequency" dur="1.6s" values="0.02 0.09;0.03 0.12;0.02 0.09" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <JsonLd data={educationalOrgSchema} />
        <ToastProvider>
          <ConfirmProvider>
            <ImpersonationBanner />
            {children}
            <CookieBanner />
            <SessionStillHereModal />
            <ThemeSync />
            <AnimationGovernor />
            <SeasonalDecor />
        <PasswordRecoveryRedirect />
            <JsxFigureEnhancer />
            <NavProgress />
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
