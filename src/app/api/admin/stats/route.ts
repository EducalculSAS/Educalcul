import { NextResponse } from 'next/server';
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { requireRole } from "@/lib/apiAuth";
import { fetchAdminStats } from "@/lib/adminStats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await fetchAdminStats());
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
