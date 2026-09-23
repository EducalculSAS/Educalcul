import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { loadCalendar } from "@/lib/calendarServer";
import ChildCalendarClient from "@/components/child/ChildCalendarClient";

export default async function ChildCalendarPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("id, first_name, school_zone")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const ownerZone = userData.school_zone || "C";

  const { events, globalEvents } = await loadCalendar(userData.id, { childView: true, zone: ownerZone });

  return (
    <ChildCalendarClient
      meId={userData.id}
      name={userData.first_name ?? "moi"}
      initialEvents={events}
      initialGlobalEvents={globalEvents}
      initialZone={ownerZone}
    />
  );
}
