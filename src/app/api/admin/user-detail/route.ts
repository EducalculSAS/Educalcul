import { reconcileCosmeticsForFamily } from "@/lib/cosmeticEntitlements";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripe, subscriptionPeriodEnd } from "@/lib/stripe";
import { isValidNumericId, validateString } from "@/lib/validation";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { requireRole, requireSuperAdmin } from "@/lib/apiAuth";
import { fetchAdminUserDetail } from "@/lib/adminUserDetail";
import { grantOfferedSubscription } from "@/lib/adminGrantSubscription";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { hasSpecialtyChoice, sanitizeExtraLevels } from "@/lib/specialties";
import { periodDays as periodDaysOf, recurringFor } from "@/lib/billingPeriods";
import { errMessage } from "@/lib/safeError";

const VALID_GRADE_LEVELS = new Set(SCHOOL_LEVELS.map((l) => l.value));

export async function GET(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // ✓ SECURITY: Validate numeric ID format
    if (!id || !isValidNumericId(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const detail = await fetchAdminUserDetail(id);
    if (!detail) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json(detail);
  } catch (err: unknown) {
    console.error("[user-detail] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    // Édite le rôle du compte (peut promouvoir en admin) — réservé au super admin.
    const admin = await requireSuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id || !isValidNumericId(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const { first_name, last_name, email, role, admin_level, status, grade_level } = await req.json();
    if (role === "child" && !VALID_GRADE_LEVELS.has(grade_level)) {
      return NextResponse.json({ error: "Niveau scolaire invalide" }, { status: 400 });
    }
    // Classe fixée par l'admin : au lycée, elle vaut choix de spécialités
    // (l'élève n'est plus sollicité) ; elle sort des niveaux « en plus ».
    const extra: Record<string, unknown> = {};
    if (role === "child") {
      const { data: prev } = await supabaseAdmin.from("users").select("grade_level, extra_levels").eq("id", id).maybeSingle();
      if (prev && prev.grade_level !== grade_level) {
        extra.extra_levels = sanitizeExtraLevels(grade_level, prev.extra_levels);
        if (hasSpecialtyChoice(grade_level)) extra.specialties_chosen_at = new Date().toISOString();
      }
    }
    const { data, error } = await supabaseAdmin.from("users")
      .update({ first_name, last_name, email, role, admin_level: role === "admin" ? (admin_level || "super") : null, status, grade_level, ...extra })
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("[user-detail-put] Database error:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    // ✓ SECURITY: Log admin action
    await auditLog({
      action: AuditAction.USER_UPDATED,
      adminId: admin.id,
      targetUserId: Number(id),
      targetType: "user",
      targetId: id,
      details: { email, role, firstName: first_name, lastName: last_name },
    }, req);

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[user-detail-put] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Niveaux visibles en plus de la classe principale (élève) : ex. un élève de
 * Terminale qui revoit la Première spé. Attribués ici par l'admin (sur
 * demande d'un parent) — seule autre source : l'option maths expertes. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id || !isValidNumericId(id)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { data: user } = await supabaseAdmin.from("users").select("id, role, grade_level").eq("id", id).maybeSingle();
    if (!user || user.role !== "child") return NextResponse.json({ error: "Réservé aux comptes élève" }, { status: 400 });

    const extra_levels = sanitizeExtraLevels(user.grade_level, body?.extra_levels);
    const { error } = await supabaseAdmin.from("users").update({ extra_levels }).eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to update user" }, { status: 500 });

    await auditLog({
      action: AuditAction.USER_UPDATED,
      adminId: admin.id,
      targetUserId: Number(id),
      targetType: "user",
      targetId: id,
      details: { extra_levels },
    }, req);
    return NextResponse.json({ extra_levels });
  } catch (err: unknown) {
    console.error("[user-detail-patch] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Bannir/débannir/supprimer/agir sur un compte — réservé au super admin.
    const admin = await requireSuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id || !isValidNumericId(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const { action, payload } = await req.json();
    const { data: user } = await supabaseAdmin.from("users")
      .select("id, auth_id, email, status, role, two_factor_enabled")
      .eq("id", id)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "toggle_2fa") {
      // Réservé parent/enfant — les admins passent exclusivement par le TOTP
      // (voir /api/auth/2fa/totp/*), pas par ce commutateur email.
      if (user.role === "admin") {
        return NextResponse.json({ error: "Les comptes admin utilisent le TOTP, pas ce commutateur." }, { status: 400 });
      }
      const enabled = !user.two_factor_enabled;
      await supabaseAdmin.from("users").update({ two_factor_enabled: enabled }).eq("id", id);

      await auditLog({
        action: AuditAction.TWO_FACTOR_TOGGLED_BY_ADMIN,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "user",
        targetId: String(id),
        details: { enabled },
      }, req);

      return NextResponse.json({ success: true, enabled });
    }
    if (action === "ban") {
      const banDays = payload?.banDays || null;
      const banUntil = banDays ? new Date(Date.now() + banDays * 24 * 60 * 60 * 1000).toISOString() : null;
      
      await supabaseAdmin.from("users").update({ 
        status: "inactive",
        ban_reason: validateString(payload?.reason, 500) || "Account suspended by admin",
        ban_until: banUntil,
      }).eq("id", id);
      
      await supabaseAdmin.from("admin_notifications").insert({ 
        user_id: id, 
        type: "ban", 
        title: "Compte suspendu", 
        content: payload?.reason || "Votre compte a été suspendu par un administrateur." 
      });

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.USER_BANNED,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "user",
        targetId: String(id),
        details: { reason: payload?.reason, banDays },
      }, req);

      return NextResponse.json({ success: true });
    }
    if (action === "unban") {
      await supabaseAdmin.from("users").update({ 
        status: "active",
        ban_reason: null,
        ban_until: null,
      }).eq("id", id);
      await supabaseAdmin.from("admin_notifications").insert({ 
        user_id: id, 
        type: "info", 
        title: "Compte réactivé", 
        content: "Votre compte a été réactivé." 
      });

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.USER_UNBANNED,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "user",
        targetId: String(id),
      }, req);

      return NextResponse.json({ success: true });
    }
    if (action === "send_message") {
      const title = validateString(payload?.title, 500);
      const content = validateString(payload?.content, 10000);
      if (!title || !content) {
        return NextResponse.json({ error: "Invalid title or content" }, { status: 400 });
      }
      await supabaseAdmin.from("admin_notifications").insert({ 
        user_id: id, 
        type: payload.type || "message", 
        title, 
        content 
      });

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.ADMIN_MESSAGE,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "user",
        targetId: String(id),
        details: { title, messageLength: content.length },
      }, req);

      return NextResponse.json({ success: true });
    }
    if (action === "reset_password") {
      if (user.email) {
        await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: user.email });
      }

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.PASSWORD_RESET,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "user",
        targetId: String(id),
        details: { email: user.email },
      }, req);

      return NextResponse.json({ success: true });
    }
    if (action === "set_plan") {
      const planId = payload?.plan_id?.toString();
      if (!planId || !isValidNumericId(planId)) {
        return NextResponse.json({ error: "Invalid plan_id" }, { status: 400 });
      }

      // Mode "offert" : l'admin attribue volontairement le plan sans aucune
      // facturation (compte de test, partenariat, élève sans parent payeur).
      // Distinct du mode par défaut "stripe" ci-dessous, qui exige une vraie
      // facturation et refuse plutôt que de simuler un abonnement actif.
      if (payload?.billing_mode === "offert") {
        const granted = await grantOfferedSubscription({
          authId: user.auth_id,
          planId,
          days: Number(payload?.days) > 0 ? Number(payload.days) : null,
        });
        if (!granted.ok) {
          return NextResponse.json({ error: granted.error }, { status: 400 });
        }

        await auditLog({
          action: AuditAction.SUBSCRIPTION_CHANGED,
          adminId: admin.id,
          targetUserId: user.id,
          targetType: "subscription",
          targetId: planId,
          details: { planId, planName: granted.planName, billingMode: "offert", stripeLinked: false },
        }, req);

        return NextResponse.json({ success: true, stripeLinked: false, offered: true });
      }

      const { data: plan } = await supabaseAdmin
        .from("subscription_plans")
        .select("name, price, billing_interval")
        .eq("id", planId)
        .maybeSingle();

      const periodDays = periodDaysOf(plan?.billing_interval);

      // Annule l'éventuel abonnement Stripe en cours, puis recrée un abonnement Stripe
      // correspondant au nouveau plan sur le client existant (réparation manuelle d'un
      // abonnement déjà payé par l'utilisateur).
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .eq("user_id", user.auth_id)
        .maybeSingle();

      if (existingSub?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(existingSub.stripe_subscription_id);
        } catch (e: unknown) {
          console.warn("Could not cancel previous subscription:", errMessage(e));
        }
      }

      // Retrouve le client Stripe : celui déjà connu, sinon par email
      let stripeCustomerId = existingSub?.stripe_customer_id || null;
      if (!stripeCustomerId && user.email) {
        try {
          const found = await stripe.customers.list({ email: user.email, limit: 1 });
          if (found.data[0]) stripeCustomerId = found.data[0].id;
        } catch (e: unknown) {
          console.warn("Could not look up Stripe customer:", errMessage(e));
        }
      }

      let newStripeSubId: string | null = null;
      let newPeriodEnd: string | null = null;
      const isPaidPlan = plan && Number(plan.price) > 0;
      if (stripeCustomerId && isPaidPlan) {
        const recurring = recurringFor(plan.billing_interval);
        try {
          const product = await stripe.products.create({ name: plan.name });
          const newSub = await stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: [{
              price_data: {
                currency: "eur",
                product: product.id,
                unit_amount: Math.round(Number(plan.price) * 100),
                recurring,
              },
            }],
          });
          newStripeSubId = newSub.id;
          newPeriodEnd = subscriptionPeriodEnd(newSub);
        } catch (e: unknown) {
          // ✓ SECURITY / INTEGRITE : ne JAMAIS marquer l'abonnement "active"
          // en base si Stripe n'a pas reellement pu creer la facturation
          // (ex: carte retiree entre-temps) -- sinon l'admin croit avoir
          // repare l'abonnement (aucune erreur affichee) alors que le client
          // garde un acces payant complet sans jamais etre facture (bug
          // constate en test : stripe_subscription_id reste null, mais
          // status="active" ecrit quand meme).
          console.error("Could not create new Stripe subscription:", errMessage(e));
          return NextResponse.json(
            { error: `Impossible de créer l'abonnement Stripe : ${errMessage(e)}. Le plan n'a pas été modifié.` },
            { status: 400 }
          );
        }
      }
      if (isPaidPlan && !stripeCustomerId) {
        return NextResponse.json(
          { error: "Aucun client Stripe trouvé pour cet utilisateur : impossible de créer un abonnement payant réel." },
          { status: 400 }
        );
      }

      await supabaseAdmin.from("subscriptions").upsert({
        user_id: user.auth_id,
        plan_id: planId,
        status: "active",
        stripe_subscription_id: newStripeSubId,
        stripe_customer_id: stripeCustomerId,
        cancel_at_period_end: false,
        current_period_start: new Date().toISOString(),
        current_period_end: newPeriodEnd || new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      await reconcileCosmeticsForFamily(user.auth_id).catch((e) => console.error("[admin/user-detail] cosmétiques non mis à jour", (e as Error).message));

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.SUBSCRIPTION_CHANGED,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "subscription",
        targetId: planId,
        details: { planId, planName: plan?.name, stripeLinked: !!newStripeSubId },
      }, req);

      return NextResponse.json({ success: true, stripeLinked: !!newStripeSubId });
    }

    // Ajoute (ou retire) une durée gratuite sur l'abonnement actuel
    if (action === "add_free_time") {
      const days = Number(payload?.days);
      if (!days || isNaN(days) || !Number.isInteger(days) || Math.abs(days) > 3650) {
        return NextResponse.json({ error: "Invalid days value" }, { status: 400 });
      }

      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", user.auth_id)
        .maybeSingle();

      if (!existingSub) {
        return NextResponse.json({ error: "No active subscription" }, { status: 400 });
      }

      const base = existingSub.current_period_end
        ? new Date(existingSub.current_period_end)
        : new Date();
      const start = base.getTime() < Date.now() ? new Date() : base;
      const newEnd = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

      await supabaseAdmin.from("subscriptions").update({
        current_period_end: newEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.auth_id);

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.SUBSCRIPTION_CHANGED,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "subscription",
        targetId: String(id),
        details: { daysAdded: days, newEndDate: newEnd.toISOString() },
      }, req);

      return NextResponse.json({ success: true, current_period_end: newEnd.toISOString() });
    }

    if (action === "delete_post") {
      const postId = payload?.post_id;
      if (!postId || !isValidNumericId(postId)) {
        return NextResponse.json({ error: "Invalid post_id" }, { status: 400 });
      }
      await supabaseAdmin.from("forum_posts").delete().eq("id", postId);

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.FORUM_POST_DELETED,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "post",
        targetId: postId,
      }, req);

      return NextResponse.json({ success: true });
    }
    if (action === "delete_comment") {
      const commentId = payload?.comment_id;
      if (!commentId || !isValidNumericId(commentId)) {
        return NextResponse.json({ error: "Invalid comment_id" }, { status: 400 });
      }
      await supabaseAdmin.from("forum_comments").delete().eq("id", commentId);

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.FORUM_COMMENT_DELETED,
        adminId: admin.id,
        targetUserId: user.id,
        targetType: "comment",
        targetId: commentId,
      }, req);

      return NextResponse.json({ success: true });
    }
    if (action === "dismiss_report") {
      const reportId = payload?.report_id;
      if (!reportId || !isValidNumericId(reportId)) {
        return NextResponse.json({ error: "Invalid report_id" }, { status: 400 });
      }
      await supabaseAdmin.from("forum_reports").update({ status: "dismissed" }).eq("id", reportId);

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.REPORT_DISMISSED,
        adminId: admin.id,
        targetType: "report",
        targetId: reportId,
      }, req);

      return NextResponse.json({ success: true });
    }
    if (action === "review_report") {
      const reportId = payload?.report_id;
      if (!reportId || !isValidNumericId(reportId)) {
        return NextResponse.json({ error: "Invalid report_id" }, { status: 400 });
      }
      await supabaseAdmin.from("forum_reports").update({ status: "reviewed" }).eq("id", reportId);

      // ✓ SECURITY: Log admin action
      await auditLog({
        action: AuditAction.REPORT_DISMISSED,
        adminId: admin.id,
        targetType: "report",
        targetId: reportId,
        details: { action: "reviewed" },
      }, req);

      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[user-detail-post] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}