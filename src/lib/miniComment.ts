/** Demande le mini commentaire de l'IA après une correction instantanée ; null si rien d'utile ou si l'IA est lente/indisponible. */
export async function fetchMiniComment(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch("/api/child/mini-comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { comment?: string };
    return data.comment?.trim() ? data.comment.trim() : null;
  } catch {
    return null;
  }
}
