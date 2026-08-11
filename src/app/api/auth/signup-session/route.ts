import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

const COOKIE_NAME = "edu_signup_session";
const MAX_AGE = 60 * 60 * 24; // 24h — le temps de compléter l'inscription (paiement Stripe inclus).

/** État du flux d'inscription (profil, mode, plan choisi...), stocké
 * côté serveur et référencé par un cookie httpOnly — jamais accessible en JS
 * ni persisté dans sessionStorage. Pas de mot de passe ici (voir
 * pendingSignupPassword.ts). Aucune authentification requise : le cookie
 * httpOnly lui-même (imprévisible, non lisible en JS) fait office de jeton
 * d'accès, avant même qu'un compte existe. */

export async function GET() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return Response.json({});

    const { data } = await supabaseAdmin
      .from("pending_signups")
      .select("data")
      .eq("token", token)
      .maybeSingle();

    return Response.json(data?.data || {});
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const patch = await req.json();
    const store = await cookies();
    let token = store.get(COOKIE_NAME)?.value;
    let current: Record<string, any> = {};

    if (token) {
      const { data } = await supabaseAdmin
        .from("pending_signups")
        .select("data")
        .eq("token", token)
        .maybeSingle();
      if (data) current = data.data || {};
      else token = undefined;
    }

    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete current[key];
      else current[key] = value;
    }

    if (token) {
      await supabaseAdmin.from("pending_signups").update({ data: current }).eq("token", token);
    } else {
      // Purge opportuniste des inscriptions abandonnées (>48h) à chaque nouvelle session.
      supabaseAdmin
        .from("pending_signups")
        .delete()
        .lt("created_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString())
        .then(undefined, () => {});

      const { data: inserted, error } = await supabaseAdmin
        .from("pending_signups")
        .insert({ data: current })
        .select("token")
        .single();
      if (error || !inserted) {
        return Response.json({ error: "Impossible de créer la session d'inscription" }, { status: 500 });
      }
      token = inserted.token;
      store.set(COOKIE_NAME, token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: MAX_AGE,
      });
    }

    return Response.json(current);
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (token) {
      await supabaseAdmin.from("pending_signups").delete().eq("token", token);
      store.delete(COOKIE_NAME);
    }
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
