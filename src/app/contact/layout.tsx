import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact : Nous écrire",
  description: "Une question, un problème ou une suggestion ? Contactez l'équipe Educalcul. Nous répondons en moins de 24h.",
  openGraph: {
    title: "Contacter Educalcul",
    description: "L'équipe Educalcul vous répond en moins de 24h.",
    url: "https://educalcul.com/contact",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
