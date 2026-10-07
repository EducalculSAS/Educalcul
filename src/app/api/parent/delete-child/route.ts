import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, canActOnInternalId } from "@/lib/apiAuth";
import { deleteAuthUser } from "@/lib/deleteAuthUser";
import { purgeUserData } from "@/lib/userData";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Supprime UN profil enfant (compte Auth + profil public.users + données liées
 * par cascade). Avant, le bouton "corbeille" de /parent/children faisait un
 * `supabase.from("users").delete()` directement depuis le navigateur, en
 * s'appuyant uniquement sur la RLS — pas d'audit, pas de rate limit, et le
 * compte Supabase Auth restait orphelin. */
export async function DELETE(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (me.role !== "parent" && me.role !== "admin") {
      return NextResponse.json({ error: "Seul un parent peut supprimer un profil enfant" }, { status: 403 });
    }

    const { childId } = await req.json().catch(() => ({}));
    const id = Number(childId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "childId manquant ou invalide" }, { status: 400 });
    }

    const config = RATE_LIMITS["child-account:mutate"];
    const rl = await rateLimitWithBackoff(`delete-child:${me.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });
    }

    // Le demandeur doit être le parent de cet enfant (ou admin).
    if (!(await canActOnInternalId(me, id))) {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }

    const { data: child } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, role, first_name")
      .eq("id", id)
      .maybeSingle();
    if (!child) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    if (child.role !== "child") {
      return NextResponse.json({ error: "Ce profil n'est pas un compte enfant" }, { status: 400 });
    }

    // 0. Objectifs, carnet d'erreurs, alertes de l'élève (hors cascade).
    await purgeUserData([child.id]).catch(() => {});

    // 1. Profil + données liées (cascade FK).
    const { error: delError } = await supabaseAdmin.from("users").delete().eq("id", child.id);
    if (delError) {
      return NextResponse.json({ error: sanitizeErrorMessage(delError.message) }, { status: 500 });
    }

    // 2. Compte Supabase Auth (avec retry + repli).
    let authWarning: string | undefined;
    if (child.auth_id) {
      const ok = await deleteAuthUser(child.auth_id, `child ${child.auth_id}`);
      if (!ok) authWarning = "Le profil a été supprimé mais la connexion associée n'a pas pu l'être, contacte le support.";
    }

    await auditLog({
      action: AuditAction.USER_DELETED,
      adminId: me.id,
      details: { childId: child.id, method: "parent-delete-child" },
    }, req);

    return NextResponse.json({ success: true, warning: authWarning });
  } catch (err: any) {
    console.error("[delete-child] error:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}
