import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
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
      <PageHero
        icon={MessageSquare}
        title="Support"
        badge="Mes messages"
        subtitle="Vos échanges avec l'équipe Educalcul."
        width="4xl"
      />

      <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
        <SupportTickets initialTickets={tickets || []} />
      </div>

      <SupportChatbot />
    </div>
  );
}
