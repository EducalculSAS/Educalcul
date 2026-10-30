import "server-only";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { isNoiseError } from "@/lib/errorNoise";

/**
 * Journal d'erreurs maison (remplace Sentry) : les erreurs du serveur et des
 * navigateurs arrivent dans error_logs, regroupées par empreinte (même message
 * + même endroit du code = une seule ligne avec un compteur), visibles dans
 * Admin > Erreurs. Une erreur NOUVELLE (ou qui revient après avoir été marquée
 * résolue) prévient les admins par une notification.
 */
export interface ErrorReport {
  source: "client" | "server";
  message: string;
  stack?: string | null;
  url?: string | null;
  userAgent?: string | null;
  userId?: number | null;
}

/** Même bug = même empreinte : chiffres, identifiants et adresses retirés. */
function fingerprintOf(r: ErrorReport): string {
  const normalized = r.message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .slice(0, 300);
  const frame = (r.stack ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("at ") || l.includes("@"))
    ?.replace(/:\d+:\d+\)?$/, "")
    .replace(/\?[^)\s]*/, "")
    .slice(0, 200) ?? "";
  return createHash("sha1").update(`${r.source}|${normalized}|${frame}`).digest("hex");
}


export async function recordError(report: ErrorReport): Promise<void> {
  try {
    const message = String(report.message || "Erreur inconnue").trim();
    if (isNoiseError({ ...report, message })) return;

    const { data: isNew } = await supabaseAdmin.rpc("log_error", {
      p_fingerprint: fingerprintOf({ ...report, message }),
      p_source: report.source,
      p_message: message,
      p_stack: report.stack ?? null,
      p_url: report.url ?? null,
      p_user_agent: report.userAgent ?? null,
      p_user_id: report.userId ?? null,
    });
    if (isNew) await notifyAdmins(report.source, message);
  } catch {
    // Le journal d'erreurs ne doit jamais provoquer lui-même une erreur.
  }
}

async function notifyAdmins(source: "client" | "server", message: string) {
  const { data: admins } = await supabaseAdmin.from("users").select("auth_id").eq("role", "admin").not("auth_id", "is", null);
  if (!admins?.length) return;
  await supabaseAdmin.from("user_notifications").insert(
    admins.map((a) => ({
      user_id: a.auth_id,
      type: "error",
      title: `Nouvelle erreur ${source === "server" ? "serveur" : "navigateur"}`,
      body: message.slice(0, 180),
      link: "/admin/erreurs",
    })),
  );
}
