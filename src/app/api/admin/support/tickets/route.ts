import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { requireRole } from "@/lib/apiAuth";
import { fetchSupportTickets } from "@/lib/supportTicketsQuery";

export async function GET(request: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const viewMode = (searchParams.get('view_mode') || 'active') as "active" | "archived";

    const data = await fetchSupportTickets(viewMode);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
