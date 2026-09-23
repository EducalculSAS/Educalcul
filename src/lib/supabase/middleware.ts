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

  // getUser() (pas getSession()) : contacte le serveur Auth et déclenche le
  // rafraîchissement du token si besoin, ce qui réécrit le cookie via setAll.
  // L'identité vérifiée est renvoyée au proxy : la garde des pages admin s'en
  // sert sans refaire d'appel au serveur Auth.
  const { data } = await supabase.auth.getUser();

  return { response: supabaseResponse, authId: data?.user?.id ?? null };
}
