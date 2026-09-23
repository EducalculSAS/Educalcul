import { redirect } from "next/navigation";
import { selectAllPages } from "@/lib/selectAllPages";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ParentCalendarClient from "@/components/parent/ParentCalendarClient";

export default async function ParentCalendarPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("id, school_zone")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const ownerZone = userData.school_zone || "C";
  const [{ data: childrenData }, events, globalEvents] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, first_name")
      .eq("role", "child")
      .eq("parent_id", userData.id)
      .order("first_name"),
    selectAllPages<any>((from, to) =>
      supabaseAdmin
        .from("calendar_events")
        .select("*")
        .eq("owner_id", userData.id)
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    ),
    selectAllPages<any>((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select("*")
        .or(`zone.eq.all,zone.eq.${ownerZone}`)
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    ),
  ]);

  return (
    <ParentCalendarClient
      authId={authUser.authId}
      parentId={userData.id}
      initialChildren={childrenData || []}
      initialEvents={events || []}
      initialGlobalEvents={globalEvents || []}
      initialSchoolZone={ownerZone}
    />
  );
}
