/** État du flux d'inscription multi-étapes (profil, mode google/email, plan
 * choisi, id auth en attente...), gardé côté serveur (table pending_signups)
 * et référencé par un cookie httpOnly — jamais dans sessionStorage. Le mot de
 * passe choisi ne transite jamais ici : voir pendingSignupPassword.ts. */

export async function getSignupSession(): Promise<Record<string, any>> {
  try {
    const res = await fetch("/api/auth/signup-session");
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function patchSignupSession(patch: Record<string, any>): Promise<Record<string, any>> {
  try {
    const res = await fetch("/api/auth/signup-session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function clearSignupSession(): Promise<void> {
  try {
    await fetch("/api/auth/signup-session", { method: "DELETE" });
  } catch {
    // ignore
  }
}
