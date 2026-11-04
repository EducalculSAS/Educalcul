import type { Metadata } from "next";
import LegalPageRenderer from "@/components/LegalPageRenderer";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  alternates: { canonical: "https://educalcul.com/cgv" },
};

export default function CGV() {
  return <LegalPageRenderer slug="cgv" />;
}
