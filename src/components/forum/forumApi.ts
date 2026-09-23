import type { ForumCategory, ForumFilter, ForumPostSummary, ForumSort, ForumThread } from "@/lib/forumTypes";

/** Appels du forum (le jeton est ajouté par le fetch global, voir supabaseClient.ts). */

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Une erreur est survenue.");
  return data as T;
}

const post = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const forumApi = {
  categories: () => fetch("/api/forum/categories").then((r) => json<ForumCategory[]>(r)),

  list: (p: { category?: number | null; q?: string; filter?: ForumFilter; sort?: ForumSort; offset?: number }) => {
    const sp = new URLSearchParams();
    if (p.category) sp.set("category", String(p.category));
    if (p.q) sp.set("q", p.q);
    if (p.filter && p.filter !== "all") sp.set("filter", p.filter);
    if (p.sort && p.sort !== "activity") sp.set("sort", p.sort);
    if (p.offset) sp.set("offset", String(p.offset));
    return fetch(`/api/forum/posts?${sp}`).then((r) => json<{ items: ForumPostSummary[]; hasMore: boolean }>(r));
  },

  thread: (id: number) => fetch(`/api/forum/posts/${id}`).then((r) => json<ForumThread>(r)),
  view: (id: number) => fetch(`/api/forum/posts/${id}/view`, { method: "POST" }).catch(() => {}),

  createPost: (b: { categoryId: number; title: string; content: string }) =>
    post("/api/forum/posts", b).then((r) => json<{ id: number }>(r)),
  updatePost: (id: number, b: Record<string, unknown>) =>
    post(`/api/forum/posts/${id}`, b, "PATCH").then((r) => json<{ success: true }>(r)),
  deletePost: (id: number) => fetch(`/api/forum/posts/${id}`, { method: "DELETE" }).then((r) => json(r)),

  reply: (b: { postId: number; content: string; quotedCommentId?: number | null }) =>
    post("/api/forum/comments", b).then((r) => json<{ id: number }>(r)),
  updateComment: (id: number, content: string) =>
    post(`/api/forum/comments/${id}`, { content }, "PATCH").then((r) => json(r)),
  deleteComment: (id: number) => fetch(`/api/forum/comments/${id}`, { method: "DELETE" }).then((r) => json(r)),

  like: (b: { postId?: number; commentId?: number }) =>
    post("/api/forum/likes", b).then((r) => json<{ liked: boolean; like_count: number }>(r)),
  follow: (postId: number) => post("/api/forum/follow", { postId }).then((r) => json<{ following: boolean }>(r)),
  report: (b: { type: "post" | "comment"; targetId: number; reason: string }) =>
    post("/api/forum/reports", b).then((r) => json(r)),

  saveCategory: (id: number | null, b: Record<string, unknown>) =>
    post(id ? `/api/forum/categories/${id}` : "/api/forum/categories", b, id ? "PATCH" : "POST").then((r) => json<ForumCategory>(r)),
  deleteCategory: (id: number) => fetch(`/api/forum/categories/${id}`, { method: "DELETE" }).then((r) => json(r)),
};
