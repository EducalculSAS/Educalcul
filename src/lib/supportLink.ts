import { supabaseAdmin } from "./supabaseClient";

/** Path to the Support page for a given auth user, based on their role (child vs everyone else). */
export async function supportLinkForAuthId(authId: string | null | undefined): Promise<string> {
  if (!authId) return "/parent/support";
  const { data } = await supabaseAdmin.from("users").select("role").eq("auth_id", authId).maybeSingle();
  return data?.role === "child" ? "/child/support" : "/parent/support";
}
