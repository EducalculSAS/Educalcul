import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase pour Server Components / Route Handlers, basé sur les
 * cookies de session (posés par le middleware via updateSession()). Permet à
 * une page serveur de savoir qui est connecté sans appel client préalable.
 *
 * `setAll` peut échouer si appelé depuis un Server Component pur (lecture
 * seule) : sans conséquence, le middleware rafraîchit déjà le cookie de
 * session à chaque navigation.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : voir le commentaire ci-dessus.
          }
        },
      },
    },
  );
}
