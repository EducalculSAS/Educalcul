import { supabaseAdmin } from "./supabaseClient";

interface NotifyParams {
  userId: string; // auth.users.id (UUID)
  type: string;
  title: string;
  body?: string;
  link?: string;
}

export async function notify({ userId, type, title, body, link }: NotifyParams) {
  const { error } = await supabaseAdmin.from("user_notifications").insert({
    user_id: userId,
    type,
    title,
    body: body || null,
    link: link || null,
  });
  if (error) console.error("[notify] error:", error.message);
}
