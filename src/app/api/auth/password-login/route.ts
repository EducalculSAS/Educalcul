import { getClientIp } from "@/lib/apiAuth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateUsername } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { auditLog, AuditAction } from "@/lib/auditLog";

/**
 * Connexion par identifiant (e-mail OU pseudo d'élève) + mot de passe, faite
 * CÔTÉ SERVEUR.
 *
 * Remplace deux routes qui fuyaient :
 *  - /api/auth/resolve-username, PUBLIQUE, renvoyait la VRAIE adresse e-mail
 *    associée à n'importe quel pseudo d'élève : on pouvait récupérer l'e-mail
 *    d'un enfant en devinant ou en listant des pseudos. Désormais l'e-mail ne
 *    quitte jamais le serveur ;
 *  - /api/auth/log-login-attempt prenait le résultat (réussi/échoué) DU
 *    CLIENT : n'importe qui pouvait inscrire de fausses entrées dans le
 *    journal d'audit de n'importe quel compte. Le serveur journalise ici le
 *    résultat réel.
 *
 * La réponse est la même quel que soit le motif d'échec (compte inexistant ou
 * mauvais mot de passe) : elle ne révèle pas si un compte existe.
 */

const INVALID = "Email/identifiant ou mot de passe incorrect.";

async function resolveEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier.toLowerCase();

  const username = validateUsername(identifier);
  if (!username) return null;

  const { data: child } = await supabaseAdmin
    .from("users")
    .select("auth_id")
    .eq("child_username", username)
    .maybeSingle();

  if (child?.auth_id) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(child.auth_id);
    if (data?.user?.email) return data.user.email;
  }
  // Même repli que l'ancien flux : les comptes élèves sans e-mail réel sont
  // enregistrés sous cette adresse technique.
  return `${username}@educalcul.user`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || !password || identifier.length > 254 || password.length > 200) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    // Deux limites : par IP (balayage de nombreux comptes depuis une même
    // machine) et par identifiant (force brute sur UN compte, même en
    // changeant d'IP).
    const ip = getClientIp(req);
    const ipCfg = RATE_LIMITS["auth:resolve-username"];
    const idCfg = RATE_LIMITS["auth:login"];
    const [byIp, byId] = await Promise.all([
      rateLimitWithBackoff(`auth:password-login:ip:${ip}`, ipCfg.maxAttempts, ipCfg.windowMs),
      rateLimitWithBackoff(`auth:password-login:id:${identifier.toLowerCase()}`, idCfg.maxAttempts, idCfg.windowMs),
    ]);
    if (!byIp.allowed || !byId.allowed) {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
    }

    const email = await resolveEmail(identifier);
    if (!email) return NextResponse.json({ error: INVALID }, { status: 401 });

    // Client anonyme éphémère : la session créée est renvoyée au navigateur,
    // qui l'installe lui-même (setSession). Rien n'est conservé ici.
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });

    // Journal d'audit avec le résultat RÉEL, uniquement pour un compte qui
    // existe (sans rien en révéler dans la réponse).
    const { data: account } = await supabaseAdmin.from("users").select("id").eq("email", email).maybeSingle();
    if (account) {
      await auditLog(
        { action: error ? AuditAction.LOGIN_FAILED : AuditAction.LOGIN_SUCCESS, adminId: account.id },
        req,
      ).catch(() => {});
    }

    if (error || !data.session) {
      const message = error?.message?.toLowerCase() ?? "";
      // Supabase ne signale « email non confirmé » qu'une fois le mot de passe
      // vérifié : ce message ne révèle donc rien à un tiers.
      if (message.includes("email not confirmed")) {
        return NextResponse.json(
          { error: "Adresse email non confirmée. Vérifiez votre boîte de réception." },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch {
    return NextResponse.json({ error: INVALID }, { status: 500 });
  }
}
