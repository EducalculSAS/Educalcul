import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminCalendarClient from "@/components/admin/AdminCalendarClient";

export default async function AdminCalendarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: events } = await supabaseAdmin
    .from("global_calendar_events")
    .select("*")
    .order("start_date", { ascending: true });

  return <AdminCalendarClient authId={user?.id || ""} initialEvents={events || []} />;
}
