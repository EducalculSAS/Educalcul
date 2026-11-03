/** Relation « vers un » renvoyée par Supabase : un objet (le typage déduit de la requête l'annonce parfois comme un tableau d'un élément). */
export const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));
