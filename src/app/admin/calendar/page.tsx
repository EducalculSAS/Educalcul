import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminCalendarClient from "@/components/admin/AdminCalendarClient";

export default async function AdminCalendarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: events } = await supabaseAdmin
    .from("global_calendar_events")
    .select("*")
    .order("start_date", { ascending: true });

  return <AdminCalendarClient authId={session?.user.id || ""} initialEvents={events || []} />;
}
