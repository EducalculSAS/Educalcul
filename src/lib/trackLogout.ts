import { loadSupabase, mayHaveSession } from "@/lib/supabaseLazy";

export async function trackLogout() {
  try {
    if (!mayHaveSession()) return;
    const supabase = await loadSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/user/track-logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch (e) {
    console.error("Failed to track logout:", e);
  }
}
