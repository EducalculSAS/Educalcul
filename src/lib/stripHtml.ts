/**
 * Retire tout HTML d'un texte utilisateur destiné à être stocké tel quel
 * (forum : les posts/commentaires sont du texte brut, pas du HTML riche —
 * contrairement aux cours/exercices, rédigés par un admin et sanitizés côté
 * client via DOMPurify avant rendu). Défense en profondeur côté serveur :
 * même si un futur affichage oublie de sanitizer, aucun tag n'est stocké.
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "");
}
