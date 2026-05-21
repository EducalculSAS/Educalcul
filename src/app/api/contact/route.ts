import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

const SUBJECTS = [
  "Question sur les abonnements",
  "Problème technique",
  "Problème de compte",
  "Question pédagogique",
  "Demande de partenariat",
  "Signaler un contenu",
  "Suggestion d'amélioration",
  "Autre",
];

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Tous les champs sont obligatoires." }, { status: 400 });
    }
    if (!SUBJECTS.includes(subject)) {
      return NextResponse.json({ error: "Sujet invalide." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: null,
        user_email: email,
        user_name: name,
        subject,
        message,
        priority: "normal",
        status: "Ouvert",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
