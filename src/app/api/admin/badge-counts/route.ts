import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Pastilles rouges du menu admin (tickets, signalements, erreurs, paiements en
 * retard). Remplace les bandeaux d'alerte du tableau de bord : le nombre à
 * traiter est visible sur chaque entrée du menu, sur toutes les pages.
 * Un admin « support » ne reçoit que ce qui touche à son travail.
 */
export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const head = { count: "exact" as const, head: true };

  const [tickets, reports] = await Promise.all([
    supabaseAdmin.from("support_tickets").select("id", head).eq("status", "Ouvert").eq("is_archived", false),
    supabaseAdmin.from("forum_reports").select("id", head).eq("status", "pending"),
  ]);
  const out: Record<string, number> = { tickets: tickets.count ?? 0, reports: reports.count ?? 0 };

  if (admin.adminLevel !== "support") {
    const [errors, pastDue] = await Promise.all([
      supabaseAdmin.from("error_logs").select("id", head).eq("resolved", false),
      supabaseAdmin.from("subscriptions").select("id", head).eq("status", "past_due"),
    ]);
    out.errors = errors.count ?? 0;
    out.pastDue = pastDue.count ?? 0;
  }
  return NextResponse.json(out);
}
