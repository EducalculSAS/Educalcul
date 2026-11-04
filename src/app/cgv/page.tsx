import type { Metadata } from "next";
import LegalPageRenderer from "@/components/LegalPageRenderer";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Conditions générales de vente d'Educalcul : abonnements, tarifs, paiement, renouvellement, résiliation et droit de rétractation.",
  alternates: { canonical: "https://educalcul.com/cgv" },
};

export default function CGV() {
  return <LegalPageRenderer slug="cgv" />;
}
