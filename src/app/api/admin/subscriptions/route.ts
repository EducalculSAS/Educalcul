import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

// GET — list all plans. Subscriber details are attached only for admins;
// the public signup page only needs the plan fields themselves.
export async function GET(req: Request) {
  try {
    const { data: plans, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const admin = await requireRole(req, ["admin"]);
    if (!admin) {
      return NextResponse.json(plans || []);
    }

    // Attach subscriber count + subscriber list per plan
    const plansWithCount = await Promise.all(
      (plans || []).map(async (plan) => {
        const { data: subs } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id, status, current_period_end")
          .eq("plan_id", plan.id.toString())
          .eq("status", "active");

        // Resolve user info for each subscriber (user_id = auth_id in subscriptions)
        const subscribers = await Promise.all(
          (subs || []).map(async (s) => {
            const { data: u } = await supabaseAdmin
              .from("users")
              .select("first_name, last_name, email, avatar")
              .eq("auth_id", s.user_id)
              .maybeSingle();
            return { ...s, user: u };
          })
        );

        return { ...plan, subscriber_count: subscribers.length, subscribers };
      })
    );

    return NextResponse.json(plansWithCount);
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

// POST — create plan
export async function POST(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      name, description, price, billing_interval,
      duration_months, trial_days, promo_description,
      features, is_active, sort_order,
    } = body;

    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .insert({
        name, description,
        price: Number(price),
        billing_interval: billing_interval || "month",
        duration_months: duration_months || null,
        trial_days: trial_days || 0,
        promo_description: promo_description || null,
        features,
        is_active: is_active ?? true,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

// PUT — update plan (partial or full)
export async function PUT(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

// DELETE — remove plan (blocks if active subscribers)
export async function DELETE(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(req, ["admin"]);
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

    const { error } = await supabaseAdmin
      .from("subscription_plans")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
