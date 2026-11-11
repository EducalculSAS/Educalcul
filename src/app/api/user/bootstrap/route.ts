import { NextRequest, NextResponse } from "next/server";
import { GET as profileGET } from "@/app/api/user/profile/route";
import { GET as subscriptionGET } from "@/app/api/user/subscription-status/route";
import { GET as notificationsGET } from "@/app/api/notifications/route";
import { GET as adminMessagesGET } from "@/app/api/admin/notifications/route";

/**
 * Tout ce qu'une page d'un espace connecté lit à son ouverture, en UN seul appel : profil, abonnement, notifications
 * et messages de l'équipe. Avant, le navigateur faisait quatre appels séparés (quatre fonctions réveillées) à chaque
 * page. Les quatre lectures partent ici en parallèle, avec les mêmes contrôles d'accès : ce sont les routes
 * d'origine qui répondent, rien n'est dupliqué. Une lecture refusée ou en échec vaut `null`.
 */
async function read(run: () => Promise<Response>): Promise<unknown> {
  try {
    const res = await run();
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const [profile, subscription, notifications, adminMessages] = await Promise.all([
    read(() => profileGET(req)),
    read(() => subscriptionGET(req)),
    read(() => notificationsGET(req)),
    read(() => adminMessagesGET(req)),
  ]);
  if (!profile) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json({ profile, subscription, notifications, adminMessages });
}
