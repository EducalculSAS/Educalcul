import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo/meta";

export const metadata: Metadata = {
  title: "Contact : Nous écrire",
  description: "Une question, un problème ou une suggestion ? Contactez l'équipe Educalcul. Nous répondons en moins de 24h.",
  alternates: { canonical: "https://educalcul.com/contact" },
  ...socialMeta({ title: "Contacter Educalcul", description: "L'équipe Educalcul vous répond en moins de 24h.", path: "/contact" }),
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
