import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import type { AuthenticatedUser } from "@/lib/apiAuth";
import type { ForumAudience, ForumAuthor } from "@/lib/forumTypes";

/**
 * Règles du forum, communes à toutes ses routes — une seule définition de
 * « qui voit quoi » et « qui peut faire quoi ».
 */

export const TITLE_MIN = 5;
export const TITLE_MAX = 150;
export const CONTENT_MAX = 5000;
export const COMMENT_MAX = 3000;
export const PAGE_SIZE = 20;

/** Colonnes publiques d'un auteur (vue user_public_profiles). */
export const AUTHOR_COLUMNS =
  "id, first_name, last_name, child_username, avatar, role, equipped_border, name_color, featured_badges";

/** Publics qu'un rôle a le droit de voir. Un élève ne voit jamais l'espace
 * parents, un parent jamais l'espace élèves ; l'admin voit tout. */
export function audiencesFor(role: string): ForumAudience[] {
  if (role === "admin") return ["tous", "eleves", "parents"];
  if (role === "child") return ["tous", "eleves"];
  return ["tous", "parents"];
}

export function canSeeAudience(role: string, audience: string | null | undefined): boolean {
  return audiencesFor(role).includes((audience || "tous") as ForumAudience);
}

/**
 * Auteur tel qu'il s'affiche à un AUTRE utilisateur. Un élève n'apparaît
 * jamais sous son nom de famille : pseudo, sinon prénom seul. Un adulte :
 * prénom + initiale.
 */
export function publicAuthor(row: Record<string, unknown> | null | undefined): ForumAuthor | null {
  if (!row) return null;
  const role = String(row.role || "");
  const first = String(row.first_name || "").trim();
  const last = String(row.last_name || "").trim();
  const username = String(row.child_username || "").trim();
  const displayName =
    role === "child"
      ? username || first || "Élève"
      : role === "admin"
        ? username || "Équipe Educalcul"
        : [first, last ? `${last[0].toUpperCase()}.` : ""].filter(Boolean).join(" ") || "Parent";
  return {
    id: Number(row.id),
    displayName,
    role: role as ForumAuthor["role"],
    avatar: (row.avatar as string) || null,
    equippedBorder: (row.equipped_border as string) || null,
    nameColor: (row.name_color as string) || null,
    featuredBadges: Array.isArray(row.featured_badges) ? (row.featured_badges as number[]) : [],
  };
}

/** Texte saisi : on le garde tel quel (le rendu l'échappe toujours), sans
 * caractères de contrôle ni espaces superflus. Surtout PAS de suppression des
 * « <...> » : sur un forum de maths, « x < 3 et y > 2 » perdait son milieu. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

/** Échappe les jokers d'un motif ILIKE et les séparateurs du filtre `or()`. */
export function ilikePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ")}%`;
}

export interface LoadedPost {
  id: number;
  author_id: number | null;
  category_id: number;
  is_locked: boolean;
  solved_comment_id: number | null;
  category: { id: number; audience: string; admin_only: boolean } | null;
}

/** Sujet + sa catégorie, SI l'utilisateur a le droit de le voir. */
export async function loadVisiblePost(me: AuthenticatedUser, postId: number): Promise<LoadedPost | null> {
  if (!Number.isInteger(postId) || postId <= 0) return null;
  const { data } = await supabaseAdmin
    .from("forum_posts")
    .select("id, author_id, category_id, is_locked, solved_comment_id, category:forum_categories!category_id(id, audience, admin_only)")
    .eq("id", postId)
    .maybeSingle<LoadedPost>();
  if (!data) return null;
  const post = data;
  if (!canSeeAudience(me.role, post.category?.audience)) return null;
  return post;
}

/** Lien vers un sujet dans l'espace du destinataire (notifications). */
export function threadLink(role: string, postId: number): string {
  const base = role === "child" ? "/child/forum" : role === "admin" ? "/admin/forum" : "/parent/forum";
  return `${base}?t=${postId}`;
}

export function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const AUDIENCES: ForumAudience[] = ["tous", "eleves", "parents"];

/** Validation commune à la création et à la modification (admin). */
export function parseCategoryBody(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name, 60);
    if (name.length < 2) return { error: "Nom trop court" } as const;
    patch.name = name;
  }
  if (body.description !== undefined) patch.description = cleanText(body.description, 200) || null;
  if (body.icon !== undefined) patch.icon = cleanText(body.icon, 40) || "MessageSquare";
  if (body.color !== undefined) {
    const color = typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : null;
    patch.color = color;
  }
  if (body.audience !== undefined) {
    if (!AUDIENCES.includes(body.audience as ForumAudience)) return { error: "Public invalide" } as const;
    patch.audience = body.audience;
  }
  if (body.admin_only !== undefined) patch.admin_only = body.admin_only === true;
  const order = body.order_index ?? body.orderIndex;
  if (order !== undefined && Number.isFinite(Number(order))) patch.order_index = Math.trunc(Number(order));
  return { patch } as const;
}
