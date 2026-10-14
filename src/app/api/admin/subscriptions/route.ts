import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isValidPeriodId, ONE_TIME } from "@/lib/billingPeriods";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { fetchAdminSubscriptionPlans } from "@/lib/adminSubscriptionPlans";
import { syncPlanToStripe, removePlanFromStripe } from "@/lib/stripeCatalog";

// GET — list all plans. Subscriber details are attached only for admins;
// the public signup page only needs the plan fields themselves.
export async function GET(req: Request) {
  try {
    const { data: plans, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true }).order("id", { ascending: true });

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const admin = await requireSuperAdmin(req);
    if (!admin) {
      // Un plan masqué (is_active=false) ne doit pas fuiter vers le public.
      return NextResponse.json((plans || []).filter((p) => p.is_active !== false));
    }

    const plansWithCount = await fetchAdminSubscriptionPlans();
    return NextResponse.json(plansWithCount);
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

// POST — create plan
export async function POST(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    if (body.billing_interval && body.billing_interval !== ONE_TIME && !isValidPeriodId(String(body.billing_interval))) {
      return NextResponse.json({ error: "Période de facturation inconnue." }, { status: 400 });
    }
    const {
      name, description, price, billing_interval,
      trial_days, promo_description,
      features, is_active, sort_order,
    } = body;

    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .insert({
        name, description,
        price: Number(price),
        billing_interval: billing_interval || "month",
        trial_days: trial_days || 0,
        promo_description: promo_description || null,
        features,
        is_active: is_active ?? true,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    // Stripe suit : produit et prix créés/mis à jour (un échec Stripe n'empêche pas l'enregistrement).
    const stripeSync = await syncPlanToStripe(data.id);
    revalidatePath("/tarifs");
    return NextResponse.json({ ...data, stripe_sync: stripeSync }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

// PUT — update plan (partial or full)
export async function PUT(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Nouvel ordre d'affichage : une seule requête pour toute la liste, sans toucher à Stripe (l'ordre n'y est pour rien).
    if (Array.isArray(body.order)) {
      const rows = (body.order as { id: number | string; sort_order: number }[])
        .filter((r) => r && r.id != null && Number.isFinite(Number(r.sort_order)))
        .slice(0, 200);
      const results = await Promise.all(
        rows.map((r) => supabaseAdmin.from("subscription_plans").update({ sort_order: Math.round(Number(r.sort_order)) }).eq("id", r.id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) return NextResponse.json({ error: sanitizeErrorMessage(failed.error.message) }, { status: 500 });
      revalidatePath("/tarifs");
      return NextResponse.json({ success: true });
    }

    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    // Colonne supprimée (elle ne servait à rien) : un ancien onglet d'admin qui l'enverrait encore ne doit pas faire échouer l'enregistrement.
    delete (fields as Record<string, unknown>).duration_months;
    if (fields.billing_interval && fields.billing_interval !== ONE_TIME && !isValidPeriodId(String(fields.billing_interval))) {
      return NextResponse.json({ error: "Période de facturation inconnue." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    const stripeSync = await syncPlanToStripe(data.id);
    revalidatePath("/tarifs");
    return NextResponse.json({ ...data, stripe_sync: stripeSync });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

// DELETE — remove plan (blocks if active subscribers)
export async function DELETE(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { count } = await supabaseAdmin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", id)
      .eq("status", "active");

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${count} abonné(s) actif(s) sur ce plan.` },
        { status: 400 }
      );
    }

    const { data: doomed } = await supabaseAdmin.from("subscription_plans").select("name").eq("id", id).maybeSingle();
    const { error } = await supabaseAdmin
      .from("subscription_plans")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    const stripeSync = await removePlanFromStripe(id, doomed?.name);
    revalidatePath("/tarifs");
    return NextResponse.json({ success: true, stripe_sync: stripeSync });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
