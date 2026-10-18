import { supabaseAdmin } from "@/lib/supabaseClient";
import LegalPageView from "@/components/LegalPageView";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LegalSection {
  id: string;
  icon: string;
  title: string;
  content: string;
}

export interface LegalPageData {
  slug: string;
  title: string;
  subtitle: string;
  sections: LegalSection[];
  updated_at: string;
}

/**
 * Page juridique (CGV, CGU, mentions légales, confidentialité) : le texte est lu en base côté serveur, dans le HTML de
 * la page (régénéré toutes les 24 h par les pages, et à chaque modification depuis l'admin). Avant, il était chargé par
 * le navigateur après coup : squelette gris, puis texte, puis apparition section par section.
 */
export default async function LegalPageRenderer({ slug }: { slug: string }) {
  const { data } = await supabaseAdmin.from("legal_pages").select("*").eq("slug", slug).single();
  return <LegalPageView data={(data as LegalPageData | null) ?? null} />;
}
