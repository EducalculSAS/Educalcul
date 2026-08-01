import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { requireRole } from "@/lib/apiAuth";
import { fetchWaitlistSignups } from "@/lib/waitlistQuery";

// GET — liste complète de la waitlist (table waitlist_signups) + stats.
// Protégé par le proxy /api/admin/* (rôle admin requis). Lecture en service-role
// car la RLS de waitlist_signups bloque anon/authenticated.
export async function GET(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await fetchWaitlistSignups());
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
