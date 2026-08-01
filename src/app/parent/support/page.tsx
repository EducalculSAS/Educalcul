import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import SupportTickets from "@/components/parent/SupportTickets";
import SupportChatbot from "@/components/parent/SupportChatbot";

export default async function ParentSupportPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const { data: tickets } = await supabaseAdmin
    .from("support_tickets")
    .select(`*, replies:ticket_replies(*)`)
    .eq("user_id", authUser.authId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <MessageSquare className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            SUPPORT
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">MES MESSAGES</span>
            <span>Vos échanges avec l'équipe Educalcul</span>
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
        <SupportTickets initialTickets={tickets || []} />
      </div>

      <SupportChatbot />
    </div>
  );
}
