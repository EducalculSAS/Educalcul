import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { audiencesFor, parseCategoryBody } from "@/lib/forum";
import type { ForumCategory } from "@/lib/forumTypes";

/** Catégories visibles par l'utilisateur, avec leur nombre de sujets.
 * Réservé aux connectés : avant, n'importe qui lisait le forum. */
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("forum_categories")
      .select("id, name, description, icon, color, audience, admin_only, order_index, forum_posts(count)")
      .in("audience", audiencesFor(me.role))
      .order("order_index", { ascending: true });
    if (error) throw error;

    const categories: ForumCategory[] = (data ?? []).map((c) => {
      const { forum_posts, ...rest } = c as typeof c & { forum_posts: { count: number }[] };
      return { ...rest, post_count: forum_posts?.[0]?.count ?? 0 } as ForumCategory;
    });
    return NextResponse.json(categories);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me || me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = parseCategoryBody(await req.json().catch(() => ({})));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (!parsed.patch.name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("forum_categories")
      .insert({ icon: "MessageSquare", audience: "tous", order_index: 0, ...parsed.patch })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ...data, post_count: 0 });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
