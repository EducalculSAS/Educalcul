import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const { data: user, error } = await supabaseAdmin.from("users").select("*").eq("id", id).single();
    if (error || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [
      { count: ea }, { count: qa }, { count: cp }, { count: fp }, { count: fc },
      { data: sub }, { data: children }, { data: activity }, { data: notifs }, { data: bdg },
    ] = await Promise.all([
      supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", id),
      supabaseAdmin.from("forum_posts").select("*", { count: "exact", head: true }).eq("author_id", id),
      supabaseAdmin.from("forum_comments").select("*", { count: "exact", head: true }).eq("author_id", id),
      supabaseAdmin.from("subscriptions").select("*, plan:subscription_plans(name, price)").eq("user_id", user.auth_id).eq("status", "active").maybeSingle(),
      supabaseAdmin.from("users").select("id, first_name, last_name, grade_level, avatar").eq("parent_id", id).eq("role", "child"),
      supabaseAdmin.from("user_exercise_attempts").select("created_at, exercise:exercises(title)").eq("user_id", id).order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.from("admin_notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("user_badges").select("badge:badges(name, icon_name)").eq("user_id", id),
    ]);

    return NextResponse.json({
      user,
      stats: { exercise_attempts: ea ?? 0, quiz_attempts: qa ?? 0, course_progress: cp ?? 0, forum_posts: fp ?? 0, forum_comments: fc ?? 0 },
      subscription: sub ?? null, children: children ?? [], recent_activity: activity ?? [],
      notifications: notifs ?? [], badges: bdg ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const { first_name, last_name, email, role, status, grade_level } = await req.json();
    const { data, error } = await supabaseAdmin.from("users").update({ first_name, last_name, email, role, status, grade_level }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const { action, payload } = await req.json();
    const { data: user } = await supabaseAdmin.from("users").select("id, auth_id, email, status").eq("id", id).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "ban") {
      await supabaseAdmin.from("users").update({ status: "inactive" }).eq("id", id);
      await supabaseAdmin.from("admin_notifications").insert({ user_id: id, type: "ban", title: "Compte suspendu", content: payload?.reason || "Votre compte a ete suspendu." });
      return NextResponse.json({ success: true });
    }
    if (action === "unban") {
      await supabaseAdmin.from("users").update({ status: "active" }).eq("id", id);
      await supabaseAdmin.from("admin_notifications").insert({ user_id: id, type: "info", title: "Compte reactive", content: "Votre compte a ete reactive." });
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
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}