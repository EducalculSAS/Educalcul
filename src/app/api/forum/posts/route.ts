import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import {
  AUTHOR_COLUMNS, CONTENT_MAX, PAGE_SIZE, TITLE_MAX, TITLE_MIN,
  audiencesFor, canSeeAudience, cleanText, ilikePattern, parseId, publicAuthor,
} from "@/lib/forum";
import type { ForumFilter, ForumPostSummary, ForumSort } from "@/lib/forumTypes";

const FILTERS: ForumFilter[] = ["all", "following", "mine", "unanswered", "solved"];
const SORTS: ForumSort[] = ["activity", "new", "popular"];

/**
 * Liste des sujets, filtrée côté serveur et paginée : catégorie, recherche,
 * filtre (suivis, mes sujets, sans réponse, résolus), tri. Uniquement les
 * catégories que l'utilisateur a le droit de voir.
 */
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const categoryId = parseId(sp.get("category"));
    const filter = (FILTERS.includes(sp.get("filter") as ForumFilter) ? sp.get("filter") : "all") as ForumFilter;
    const sort = (SORTS.includes(sp.get("sort") as ForumSort) ? sp.get("sort") : "activity") as ForumSort;
    const q = cleanText(sp.get("q"), 80);
    const offset = Math.max(0, Math.min(5000, Number(sp.get("offset")) || 0));

    let query = supabaseAdmin
      .from("forum_posts")
      .select(
        `id, title, content, is_pinned, is_locked, solved_comment_id, comment_count, like_count, view_count, created_at, last_activity_at,
         category:forum_categories!category_id!inner(id, name, color, audience),
         author:user_public_profiles!author_id(${AUTHOR_COLUMNS})`,
      )
      .in("category.audience", audiencesFor(me.role));

    if (categoryId) query = query.eq("category_id", categoryId);
    if (q.length >= 2) {
      const pattern = ilikePattern(q);
      query = query.or(`title.ilike."${pattern}",content.ilike."${pattern}"`);
    }
    if (filter === "mine") query = query.eq("author_id", me.id);
    if (filter === "unanswered") query = query.eq("comment_count", 0);
    if (filter === "solved") query = query.not("solved_comment_id", "is", null);
    if (filter === "following") {
      const { data: follows } = await supabaseAdmin
        .from("forum_follows")
        .select("post_id")
        .eq("user_id", me.id)
        .limit(1000);
      const ids = (follows ?? []).map((f) => f.post_id);
      if (ids.length === 0) return NextResponse.json({ items: [], hasMore: false });
      query = query.in("id", ids);
    }

    // Les sujets épinglés restent en tête, sauf en recherche.
    if (q.length < 2) query = query.order("is_pinned", { ascending: false });
    if (sort === "new") query = query.order("created_at", { ascending: false });
    else if (sort === "popular") {
      query = query
        .order("like_count", { ascending: false })
        .order("comment_count", { ascending: false })
        .order("view_count", { ascending: false });
    } else query = query.order("last_activity_at", { ascending: false });
    query = query.order("id", { ascending: false });

    // Un de plus que la page pour savoir s'il en reste.
    const { data, error } = await query.range(offset, offset + PAGE_SIZE);
    if (error) throw error;

    const rows = data ?? [];
    const items: ForumPostSummary[] = rows.slice(0, PAGE_SIZE).map((p: any) => ({
      id: p.id,
      title: p.title,
      excerpt: String(p.content || "").replace(/\s+/g, " ").slice(0, 220),
      category: p.category ? { id: p.category.id, name: p.category.name, color: p.category.color } : null,
      author: publicAuthor(p.author),
      is_pinned: !!p.is_pinned,
      is_locked: !!p.is_locked,
      solved: p.solved_comment_id != null,
      comment_count: p.comment_count ?? 0,
      like_count: p.like_count ?? 0,
      view_count: p.view_count ?? 0,
      created_at: p.created_at,
      last_activity_at: p.last_activity_at,
    }));
    return NextResponse.json({ items, hasMore: rows.length > PAGE_SIZE });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const config = RATE_LIMITS["forum:post"];
    const rl = await rateLimitWithBackoff(`forum:post:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de sujets créés, réessaie plus tard." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const title = cleanText(body.title, TITLE_MAX).replace(/\n+/g, " ");
    const content = cleanText(body.content, CONTENT_MAX);
    const categoryId = parseId(body.categoryId);

    if (title.length < TITLE_MIN) {
      return NextResponse.json({ error: `Le titre doit faire au moins ${TITLE_MIN} caractères.` }, { status: 400 });
    }
    if (content.length < 2) return NextResponse.json({ error: "Écris ton message." }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: "Choisis une catégorie." }, { status: 400 });

    // La catégorie doit être visible par l'auteur, et ouverte à la
    // publication (les Annonces sont réservées à l'équipe).
    const { data: category } = await supabaseAdmin
      .from("forum_categories")
      .select("id, audience, admin_only")
      .eq("id", categoryId)
      .maybeSingle();
    if (!category || !canSeeAudience(me.role, category.audience)) {
      return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
    }
    if (category.admin_only && me.role !== "admin") {
      return NextResponse.json({ error: "Seule l'équipe peut publier dans cette catégorie." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("forum_posts")
      .insert({ title, content, category_id: categoryId, author_id: me.id })
      .select("id")
      .single();
    if (error) throw error;

    // L'auteur suit son sujet : il est prévenu des réponses.
    await supabaseAdmin.from("forum_follows").insert({ user_id: me.id, post_id: data.id });

    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
