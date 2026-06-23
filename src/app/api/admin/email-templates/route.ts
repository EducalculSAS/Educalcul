import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { emailTemplate } from "@/lib/emailTemplates";

// GET — list all templates
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("*")
    .order("type")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create campaign template
export async function POST(req: Request) {
  const { name, subject, body, target, schedule } = await req.json();
  if (!name || !subject || !body)
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .insert({ name, subject, body, target: target || "all", schedule: schedule || null, type: "campaign", is_deletable: true })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — update template (subject + body)
export async function PATCH(req: Request) {
  const { id, name, subject, body, target, schedule } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const updates: any = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (subject !== undefined) updates.subject = subject;
  if (body !== undefined) updates.body = body;
  if (target !== undefined) updates.target = target;
  if (schedule !== undefined) updates.schedule = schedule;

  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — only if is_deletable
export async function DELETE(req: Request) {
  const { id } = await req.json();
  const { data: tmpl } = await supabaseAdmin.from("email_templates").select("is_deletable").eq("id", id).single();
  if (!tmpl?.is_deletable)
    return NextResponse.json({ error: "Ce template système ne peut pas être supprimé" }, { status: 403 });

  const { error } = await supabaseAdmin.from("email_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

