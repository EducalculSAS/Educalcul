import type { Metadata } from "next";
import { socialMeta } from "@/lib/seo/meta";

export const metadata: Metadata = {
  title: "Contact : Nous écrire",
  description: "Une question, un problème ou une suggestion ? Écrivez à Educalcul : les fondateurs lisent chaque message et y répondent.",
  alternates: { canonical: "https://educalcul.com/contact" },
  ...socialMeta({ title: "Contacter Educalcul", description: "Les fondateurs lisent chaque message et y répondent.", path: "/contact" }),
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
