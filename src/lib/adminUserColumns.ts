/**
 * Colonnes de la LISTE des utilisateurs admin (page + rafraîchissement) :
 * uniquement ce que la liste affiche, filtre et exporte en CSV. La fiche
 * détaillée charge le reste. Avant, 45 colonnes par compte (plusieurs Mo à
 * 10 000 comptes), et `last_logout_ip` manquait : la colonne « IP
 * déconnexion » de l'export sortait toujours vide.
 */
// Un seul littéral : le client Supabase en déduit le type des lignes à partir de la chaîne.
export const ADMIN_USER_LIST_COLUMNS =
  `id, auth_id, email, child_username, first_name, last_name, role, status, grade_level, avatar, equipped_border,
   created_at, last_active_at, last_login_ip, last_logout_ip, last_login_city, last_login_country, latitude, longitude` as const;
