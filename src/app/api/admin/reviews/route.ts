import { readJsonBody } from "@/lib/apiJson";
import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

// GET — list all reviews
export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("manual_reviews")
    .select("*")
    .order("display_order")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create review
export async function POST(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, title, review_text, rating, is_verified, country, published_at, total_reviews, display_order } = await readJsonBody(req);
  if (!name || !review_text || !rating)
    return NextResponse.json({ error: "Champs requis manquants (nom, texte, note)" }, { status: 400 });
  if (Number(rating) < 1 || Number(rating) > 5)
    return NextResponse.json({ error: "La note doit être entre 1 et 5" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("manual_reviews")
    .insert({
      name,
      title: title || null,
      review_text,
      rating,
      is_verified: is_verified ?? true,
      country: country || null,
      published_at: published_at || null,
      total_reviews: total_reviews || 1,
      display_order: display_order || 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — update review
export async function PATCH(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, title, review_text, rating, is_verified, country, published_at, total_reviews, display_order } = await readJsonBody(req);
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
  if (rating !== undefined && (Number(rating) < 1 || Number(rating) > 5))
    return NextResponse.json({ error: "La note doit être entre 1 et 5" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (title !== undefined) updates.title = title || null;
  if (review_text !== undefined) updates.review_text = review_text;
  if (rating !== undefined) updates.rating = rating;
  if (is_verified !== undefined) updates.is_verified = is_verified;
  if (country !== undefined) updates.country = country || null;
  if (published_at !== undefined) updates.published_at = published_at || null;
  if (total_reviews !== undefined) updates.total_reviews = total_reviews;
  if (display_order !== undefined) updates.display_order = display_order;

  const { data, error } = await supabaseAdmin
    .from("manual_reviews")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — remove review
export async function DELETE(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await readJsonBody(req);
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const { error } = await supabaseAdmin.from("manual_reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ success: true });
}
