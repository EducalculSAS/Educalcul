import { createSupabaseServerClient } from "@/lib/supabase/server";
import { selectAllPages } from "@/lib/selectAllPages";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminCalendarClient from "@/components/admin/AdminCalendarClient";

export default async function AdminCalendarPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const events = await selectAllPages((from, to) =>
    supabaseAdmin
      .from("global_calendar_events")
      .select("*")
      .order("start_date", { ascending: true })
      .order("id")
      .range(from, to),
  );

  return <AdminCalendarClient authId={user?.id || ""} initialEvents={events || []} />;
}
