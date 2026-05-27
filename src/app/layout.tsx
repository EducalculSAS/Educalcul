import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import CookieBanner from "@/components/CookieBanner";

export const metadata: Metadata = {
  title: "Educalcul - La plateforme de maths qui motive vraiment",
  description: "Educalcul accompagne vos enfants du CE1 à la 3ème avec des cours, exercices corrigés par IA et un système de progression gamifié. Essai gratuit.",
  keywords: ["mathématiques", "cours de maths", "enfants", "CE1", "collège", "IA pédagogique", "exercices", "badges"],
  authors: [{ name: "Educalcul" }],
  metadataBase: new URL("https://educalcul.fr"),
  openGraph: {
    title: "Educalcul - La plateforme de maths qui motive vraiment",
    description: "Cours, exercices et IA pédagogique pour vos enfants du CE1 à la 3ème.",
    url: "https://educalcul.fr",
    siteName: "Educalcul",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Educalcul" }],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Educalcul - La plateforme de maths qui motive vraiment",
    description: "Cours, exercices et IA pédagogique pour vos enfants du CE1 à la 3ème.",
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
        <script
          type="text/javascript"
          src="//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
          async
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col overflow-x-hidden">
        <ToastProvider>
          {children}
          <CookieBanner />
        </ToastProvider>
      </body>
    </html>
  );
}
