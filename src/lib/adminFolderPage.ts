import { cookies } from "next/headers";

/**
 * Chargement initial des pages admin à dossiers (cours, exercices, quiz).
 *
 * La page ne précharge plus TOUT le contenu (7 560 exercices en 8 requêtes
 * paginées avant le premier affichage) mais seulement celui du dossier que
 * l'admin va voir : le dernier ouvert, mémorisé dans un cookie de session par
 * useSessionFolderId. Lire ce cookie ici fait aussi coïncider le rendu serveur
 * avec ce que le navigateur affiche.
 */
export async function readFolderCookie(key: string): Promise<number | null> {
  const raw = (await cookies()).get(key)?.value;
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}
