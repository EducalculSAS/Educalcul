import { redirect } from "next/navigation";
import { selectAllPages } from "@/lib/selectAllPages";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ChildCalendarClient from "@/components/child/ChildCalendarClient";

export default async function ChildCalendarPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("id, school_zone")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const ownerZone = userData.school_zone || "C";

  const [events, globalEvents] = await Promise.all([
    selectAllPages<any>((from, to) =>
      supabaseAdmin
        .from("calendar_events")
        .select("id, title, description, event_type, start_date, end_date, visible_to_child")
        .eq("owner_id", userData.id)
        .eq("visible_to_child", true)
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    ),
    selectAllPages<any>((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select("id, title, description, event_type, start_date, end_date, visible_to_child")
        .or(`zone.eq.all,zone.eq.${ownerZone}`)
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    ),
  ]);

  return (
    <ChildCalendarClient
      authId={authUser.authId}
      ownerId={userData.id}
      initialEvents={events || []}
      initialGlobalEvents={globalEvents || []}
    />
  );
}
