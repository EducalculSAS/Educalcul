"use client";

import { useRouter } from "next/navigation";
import { useVisiblePolling } from "@/lib/useVisiblePolling";
import { supabase } from "@/lib/supabaseClient";

/** Quand la plage de repos fixée par les parents commence, la page se rafraîchit et affiche l'écran de pause. */
export default function QuietGuard({ quiet }: { quiet: boolean }) {
  const router = useRouter();
  useVisiblePolling(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/child/rest-status", { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { quiet: boolean };
    if (data.quiet !== quiet) router.refresh();
  }, 120_000);
  return null;
}
