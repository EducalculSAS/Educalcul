import { requireSuperAdmin } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { ipMatchesCidr } from "@/lib/adminIpAllowlist";

export async function GET(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("admin_ip_allowlist")
    .select("id, cidr, label, created_at, created_by")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ entries: data || [] });
}

/** Ajoute une IP/plage à la liste blanche. Garde-fou : refuse d'ajouter une
 * entrée qui exclurait l'IP de l'admin qui fait la requête — sinon un admin
 * distrait pourrait se bloquer lui-même (et potentiellement toute l'équipe,
 * vu que la restriction s'applique à tous dès la première entrée). */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { cidr, label } = await req.json();
    if (!cidr || typeof cidr !== "string") {
      return Response.json({ error: "IP ou plage CIDR requise" }, { status: 400 });
    }
    const trimmed = cidr.trim();
    if (!/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(trimmed)) {
      return Response.json({ error: "Format invalide (ex: 203.0.113.4 ou 203.0.113.0/24)" }, { status: 400 });
    }

    const callerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    if (callerIp && !ipMatchesCidr(callerIp, trimmed)) {
      return Response.json(
        { error: `Cette entrée exclurait votre propre IP (${callerIp}), ajout refusé pour éviter un verrouillage.` },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_ip_allowlist")
      .insert({ cidr: trimmed, label: label || null, created_by: admin.id })
      .select("id, cidr, label, created_at")
      .single();

    if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    await auditLog(
      { action: AuditAction.ADMIN_IP_ALLOWLIST_ADDED, adminId: admin.id, targetType: "admin_ip_allowlist", targetId: data.id, details: { cidr: trimmed, label } },
      req,
    );

    return Response.json({ entry: data });
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
