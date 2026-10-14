import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit le cookie de session Supabase à chaque navigation (appelé
 * depuis src/proxy.ts, le middleware de l'app). Sans ça, un access token
 * expiré ne serait jamais renouvelé côté cookie et un Server Component
 * verrait un utilisateur "déconnecté" alors que sa session est valide.
 */
export async function updateSession(
  request: NextRequest,
  /** Pages sensibles (admin) : l'identité est confirmée auprès du serveur Auth (révocation de session détectée). */
  options: { strict?: boolean } = {},
): Promise<{ response: NextResponse; authId: string | null }> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() : vérifie la signature du jeton en local (clés ES256 du projet, JWKS en cache), sans aller-retour réseau
  // à chaque page, et rafraîchit le jeton s'il est expiré (le cookie est alors réécrit via setAll).
  // Limite connue : un jeton non expiré reste accepté après une révocation de session, jusqu'à son expiration ;
  // le statut banni/inactif est, lui, relu en base (getRole / getServerUser). Les pages admin demandent la
  // vérification stricte auprès du serveur Auth (options.strict).
  if (options.strict) {
    const { data } = await supabase.auth.getUser();
    return { response: supabaseResponse, authId: data?.user?.id ?? null };
  }
  const { data } = await supabase.auth.getClaims();
  return { response: supabaseResponse, authId: data?.claims?.sub ?? null };
}
