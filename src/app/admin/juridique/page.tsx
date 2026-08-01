import { supabaseAdmin } from "@/lib/supabaseClient";
import type { LegalPageData } from "@/components/LegalPageRenderer";
import AdminJuridiqueClient from "@/components/admin/AdminJuridiqueClient";

export default async function AdminJuridique() {
  const { data } = await supabaseAdmin.from("legal_pages").select("*").order("slug");
  const map: Record<string, LegalPageData> = {};
  (data || []).forEach((p: any) => { map[p.slug] = { ...p, sections: p.sections ?? [] }; });
  return <AdminJuridiqueClient initialPages={map} />;
}
