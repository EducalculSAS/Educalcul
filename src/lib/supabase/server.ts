import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseClient";

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

export interface ServerUser {
  authId: string;
  id: number;
  role: string;
  parentId: number | null;
}

/**
 * Identité + rôle de l'utilisateur connecté, pour un Server Component (ex:
 * choisir vers quel dashboard rediriger, ou n'afficher un lien qu'à un rôle
 * donné). Volontairement plus léger que getAuthenticatedUser (src/lib/apiAuth.ts) :
 * pas de vérification 2FA ici — la 2FA reste appliquée par le proxy pour les
 * API admin et par chaque route qui manipule des données sensibles. Cette
 * fonction ne sert qu'à décider quoi RENDRE, jamais à autoriser un accès.
 *
 * getUser() (pas getSession()) : identité vérifiée auprès du serveur Auth,
 * pas seulement lue depuis le cookie.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const supabase = await createSupabaseServerClient();
  // getSession() lit le JWT depuis le cookie sans requête réseau : le
  // middleware (updateSession(), src/proxy.ts) vient déjà de le
  // vérifier/rafraîchir aupres du serveur Auth sur cette même requête.
  // Un getUser() ici paierait un second aller-retour réseau redondant à
  // chaque page authentifiée (mesuré: latence perceptible sur toutes les
  // pages converties). L'autorisation des actions sensibles continue de
  // passer par getAuthenticatedUser (src/lib/apiAuth.ts), qui vérifie
  // toujours via getUser() côté API.
  const { data, error } = await supabase.auth.getSession();
  const authUser = data?.session?.user;
  if (error || !authUser) return null;

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id, status, ban_reason")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  if (!row) return null;
  // Même garde que getAuthenticatedUser : un compte banni garde un JWT
  // Supabase valide jusqu'à expiration.
  if (row.status === "inactive" || row.ban_reason) return null;

  return { authId: authUser.id, id: row.id, role: row.role, parentId: row.parent_id };
}
