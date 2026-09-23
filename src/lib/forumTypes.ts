/** Types du forum partagés entre les routes serveur et l'interface. */

export type ForumRole = "admin" | "parent" | "child";
export type ForumAudience = "tous" | "eleves" | "parents";
export type ForumFilter = "all" | "following" | "mine" | "unanswered" | "solved";
export type ForumSort = "activity" | "new" | "popular";

export interface ForumAuthor {
  id: number;
  displayName: string;
  role: ForumRole;
  avatar: string | null;
  equippedBorder: string | null;
  nameColor: string | null;
  featuredBadges: number[];
}

export interface ForumCategory {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  audience: ForumAudience;
  admin_only: boolean;
  order_index: number;
  post_count: number;
}

export interface ForumPostSummary {
  id: number;
  title: string;
  excerpt: string;
  category: { id: number; name: string; color: string | null } | null;
  author: ForumAuthor | null;
  is_pinned: boolean;
  is_locked: boolean;
  solved: boolean;
  comment_count: number;
  like_count: number;
  view_count: number;
  created_at: string;
  last_activity_at: string;
}

export interface ForumComment {
  id: number;
  content: string;
  author: ForumAuthor | null;
  created_at: string;
  updated_at: string | null;
  like_count: number;
  liked: boolean;
  quoted: { id: number; excerpt: string; authorName: string } | null;
  canEdit: boolean;
}

export interface ForumThread {
  id: number;
  title: string;
  content: string;
  category: { id: number; name: string; color: string | null } | null;
  author: ForumAuthor | null;
  is_pinned: boolean;
  is_locked: boolean;
  solved_comment_id: number | null;
  like_count: number;
  view_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
  liked: boolean;
  following: boolean;
  canEdit: boolean;
  canModerate: boolean;
  canMarkSolution: boolean;
  comments: ForumComment[];
}

export const AUDIENCE_LABELS: Record<ForumAudience, string> = {
  tous: "Tout le monde",
  eleves: "Élèves",
  parents: "Parents",
};
