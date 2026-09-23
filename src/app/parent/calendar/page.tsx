import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { loadCalendar } from "@/lib/calendarServer";
import ParentCalendarClient from "@/components/parent/ParentCalendarClient";

export default async function ParentCalendarPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("id, first_name, school_zone")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const ownerZone = userData.school_zone || "C";
  const [{ data: childrenData }, { events, globalEvents }] = await Promise.all([
    supabaseAdmin.from("users").select("id, first_name").eq("role", "child").eq("parent_id", userData.id).order("first_name"),
    loadCalendar(userData.id, { childView: false, zone: ownerZone }),
  ]);

  return (
    <ParentCalendarClient
      parentId={userData.id}
      parentName={userData.first_name || "Moi"}
      initialChildren={childrenData || []}
      initialEvents={events}
      initialGlobalEvents={globalEvents}
      initialSchoolZone={ownerZone}
    />
  );
}
