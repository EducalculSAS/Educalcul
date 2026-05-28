import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import CookieBanner from "@/components/CookieBanner";
import JsonLd from "@/components/JsonLd";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Educalcul",
  url: "https://educalcul.com",
  logo: "https://educalcul.com/logo.png",
  description: "Plateforme d'apprentissage des mathématiques du CP à la Terminale, avec IA pédagogique et suivi parental.",
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: "https://educalcul.com/contact" },
  sameAs: ["https://fr.trustpilot.com/review/educalcul.fr"],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Educalcul",
  url: "https://educalcul.com",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://educalcul.com/search?q={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Educalcul — La plateforme de maths du CP à la Terminale",
  description: "Educalcul accompagne vos enfants du CP à la Terminale avec des cours alignés sur le programme officiel, des exercices corrigés par IA et un suivi parental en temps réel. Essai gratuit.",
  keywords: ["mathématiques", "cours de maths", "enfants", "CP", "collège", "lycée", "IA pédagogique", "exercices", "programme officiel", "Terminale"],
  authors: [{ name: "Educalcul" }],
  metadataBase: new URL("https://educalcul.com"),
  openGraph: {
    title: "Educalcul — La plateforme de maths du CP à la Terminale",
    description: "Cours, exercices et IA pédagogique pour vos enfants, du CP à la Terminale.",
    url: "https://educalcul.com",
    siteName: "Educalcul",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Educalcul" }],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Educalcul — La plateforme de maths du CP à la Terminale",
    description: "Cours, exercices et IA pédagogique pour vos enfants, du CP à la Terminale.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen flex flex-col overflow-x-hidden">
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <ToastProvider>
          {children}
          <CookieBanner />
        </ToastProvider>
      </body>
    </html>
  );
}
