import { selectAllPages } from "@/lib/selectAllPages";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { GLOBAL_EVENT_COLUMNS } from "@/lib/calendarServer";
import AdminCalendarClient from "@/components/admin/AdminCalendarClient";

export default async function AdminCalendarPage() {
  const events = await selectAllPages((from, to) =>
    supabaseAdmin
      .from("global_calendar_events")
      .select(GLOBAL_EVENT_COLUMNS)
      .order("start_date", { ascending: true })
      .order("id")
      .range(from, to),
  );

  return <AdminCalendarClient initialEvents={(events as never[]) || []} />;
}
