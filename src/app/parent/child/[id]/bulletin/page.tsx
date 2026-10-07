import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { buildBulletin } from "@/lib/bulletin";
import BulletinView from "@/components/bulletin/BulletinView";
import PrintButton from "@/components/bulletin/PrintButton";
import GlassButton from "@/components/ui/GlassButton";

export default async function BulletinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const childId = Number(id);
  const user = await getServerUser();
  if (!user) redirect("/auth/connexion");
  if (user.role !== "parent") redirect("/dashboard");

  const { data: child } = await supabaseAdmin.from("users").select("id, parent_id").eq("id", childId).maybeSingle();
  if (!child || child.parent_id !== user.id) redirect("/parent/children");

  const bulletin = await buildBulletin(childId);
  if (!bulletin) redirect("/parent/children");

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pt-24 pb-12 px-4">
      <style>{`@media print {
        body:has(.bulletin-sheet) nav, body:has(.bulletin-sheet) footer, .no-print { display: none !important; }
        body:has(.bulletin-sheet) main, body:has(.bulletin-sheet) .bulletin-page { padding-top: 0 !important; background: #fff !important; }
        .bulletin-sheet { border: none !important; box-shadow: none !important; max-width: none !important; padding: 0 !important; }
        @page { margin: 14mm; }
      }`}</style>
      <div className="bulletin-page">
        <div className="no-print max-w-[820px] mx-auto mb-4 flex items-center justify-between gap-3">
          <GlassButton href={`/parent/child/${childId}`} variant="outline" size="sm" rounded="xl">
            <ArrowLeft className="w-4 h-4" /> Retour au suivi
          </GlassButton>
          <PrintButton />
        </div>
        <BulletinView bulletin={bulletin} />
      </div>
    </div>
  );
}
