import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripe } from "@/lib/stripe";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { data: user, error } = await supabaseAdmin.from("users").select("*").eq("id", id).single();
    if (error || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [
      { count: ea }, { count: qa }, { count: cp },
      { data: sub }, { data: children }, { data: notifs }, { data: bdg },
      { data: posts }, { data: comments }, { data: reports }, { data: loginHistory },
    ] = await Promise.all([
      supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("subscriptions").select("*").eq("user_id", user.auth_id).maybeSingle(),
      supabaseAdmin.from("users").select("id, first_name, last_name, grade_level, avatar").eq("parent_id", id).eq("role", "child"),
      supabaseAdmin.from("admin_notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("user_badges").select("badge:badges(name, icon)").eq("user_id", id),
      supabaseAdmin.from("forum_posts").select("id, title, content, created_at, is_locked, category:forum_categories(name)").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("forum_comments").select("id, content, created_at, post:forum_posts(title)").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("forum_reports").select("*, reporter:users!reporter_id(first_name, last_name), post:forum_posts(title), comment:forum_comments(content)").eq("reported_user_id", id).order("created_at", { ascending: false }),
      supabaseAdmin.from("user_login_history").select("*").eq("user_id", id).order("logged_at", { ascending: false }).limit(200),
    ]);

    return NextResponse.json({
      user,
      stats: { exercise_attempts: ea ?? 0, quiz_attempts: qa ?? 0, course_progress: cp ?? 0 },
      subscription: sub ?? null, children: children ?? [],
      notifications: notifs ?? [], badges: bdg ?? [],
      forum_posts: posts ?? [], forum_comments: comments ?? [], reports: reports ?? [],
      login_history: loginHistory ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { first_name, last_name, email, role, status, grade_level } = await req.json();
    const { data, error } = await supabaseAdmin.from("users").update({ first_name, last_name, email, role, status, grade_level }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { action, payload } = await req.json();
    const { data: user } = await supabaseAdmin.from("users").select("id, auth_id, email, status").eq("id", id).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "ban") {
      const banDays = payload?.banDays || null;
      const banUntil = banDays ? new Date(Date.now() + banDays * 24 * 60 * 60 * 1000).toISOString() : null;
      
      await supabaseAdmin.from("users").update({ 
        status: "inactive",
        ban_reason: payload?.reason || "Votre compte a été suspendu par un administrateur.",
        ban_until: banUntil,
      }).eq("id", id);
      
      await supabaseAdmin.from("admin_notifications").insert({ 
        user_id: id, 
        type: "ban", 
        title: "Compte suspendu", 
        content: payload?.reason || "Votre compte a été suspendu par un administrateur." 
      });
      return NextResponse.json({ success: true });
    }
    if (action === "unban") {
      await supabaseAdmin.from("users").update({ 
        status: "active",
        ban_reason: null,
        ban_until: null,
      }).eq("id", id);
      await supabaseAdmin.from("admin_notifications").insert({ user_id: id, type: "info", title: "Compte réactivé", content: "Votre compte a été réactivé." });
      return NextResponse.json({ success: true });
    }
    if (action === "send_message") {
      if (!payload?.title || !payload?.content) return NextResponse.json({ error: "title and content required" }, { status: 400 });
      await supabaseAdmin.from("admin_notifications").insert({ user_id: id, type: payload.type || "message", title: payload.title, content: payload.content });
      return NextResponse.json({ success: true });
    }
    if (action === "reset_password") {
      if (user.email) await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: user.email });
      return NextResponse.json({ success: true });
    }
    if (action === "set_plan") {
      const planId = payload?.plan_id?.toString();
      if (!planId) return NextResponse.json({ error: "plan_id required" }, { status: 400 });

      const { data: plan } = await supabaseAdmin
        .from("subscription_plans")
        .select("name, price, billing_interval")
        .eq("id", planId)
        .maybeSingle();

      const PERIOD_DAYS: Record<string, number> = {
        month: 30, quarter: 90, semester: 182, year: 365, one_time: 36500,
      };
      const periodDays = PERIOD_DAYS[plan?.billing_interval || "month"] || 30;

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
        } catch (e: any) {
          console.warn("Could not cancel previous subscription:", e.message);
        }
      }

      // Retrouve le client Stripe : celui déjà connu, sinon par email
      let stripeCustomerId = existingSub?.stripe_customer_id || null;
      if (!stripeCustomerId && user.email) {
        try {
          const found = await stripe.customers.list({ email: user.email, limit: 1 });
          if (found.data[0]) stripeCustomerId = found.data[0].id;
        } catch (e: any) {
          console.warn("Could not look up Stripe customer:", e.message);
        }
      }

      let newStripeSubId: string | null = null;
      let newPeriodEnd: string | null = null;
      if (stripeCustomerId && plan && Number(plan.price) > 0) {
        const RECURRING: Record<string, { interval: "month" | "year"; interval_count: number }> = {
          month:    { interval: "month", interval_count: 1 },
          quarter:  { interval: "month", interval_count: 3 },
          semester: { interval: "month", interval_count: 6 },
          year:     { interval: "year",  interval_count: 1 },
        };
        const recurring = RECURRING[plan.billing_interval] || RECURRING.month;
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
          newPeriodEnd = new Date((newSub as any).current_period_end * 1000).toISOString();
        } catch (e: any) {
          console.warn("Could not create new Stripe subscription:", e.message);
        }
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
      return NextResponse.json({ success: true, stripeLinked: !!newStripeSubId });
    }

    // Ajoute (ou retire) une durée gratuite sur l'abonnement actuel : payload.days peut être négatif
    if (action === "add_free_time") {
      const days = Number(payload?.days);
      if (!days) return NextResponse.json({ error: "days required" }, { status: 400 });

      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", user.auth_id)
        .maybeSingle();

      if (!existingSub) return NextResponse.json({ error: "Aucun abonnement actif. Attribue d'abord un plan." }, { status: 400 });

      const base = existingSub.current_period_end
        ? new Date(existingSub.current_period_end)
        : new Date();
      const start = base.getTime() < Date.now() ? new Date() : base;
      const newEnd = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

      await supabaseAdmin.from("subscriptions").update({
        current_period_end: newEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.auth_id);

      return NextResponse.json({ success: true, current_period_end: newEnd.toISOString() });
    }

    if (action === "delete_post") {
      await supabaseAdmin.from("forum_posts").delete().eq("id", payload.post_id);
      return NextResponse.json({ success: true });
    }
    if (action === "delete_comment") {
      await supabaseAdmin.from("forum_comments").delete().eq("id", payload.comment_id);
      return NextResponse.json({ success: true });
    }
    if (action === "dismiss_report") {
      await supabaseAdmin.from("forum_reports").update({ status: "dismissed" }).eq("id", payload.report_id);
      return NextResponse.json({ success: true });
    }
    if (action === "review_report") {
      await supabaseAdmin.from("forum_reports").update({ status: "reviewed" }).eq("id", payload.report_id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
