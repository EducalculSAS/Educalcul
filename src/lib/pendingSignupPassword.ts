/**
 * Mot de passe choisi à l'étape "Sécurité" de l'inscription, gardé en mémoire
 * JS uniquement (jamais dans localStorage/sessionStorage) le temps de la
 * navigation client-side vers /auth/inscription/select-plan, où il est
 * envoyé une seule fois pour créer le compte Supabase Auth. Contrairement à
 * Web Storage, il ne survit pas à un rechargement de page ni à la fermeture
 * de l'onglet, et n'est jamais écrit sur disque.
 */
let pendingPassword: string | null = null;

export function setPendingSignupPassword(password: string) {
  pendingPassword = password;
}

export function getPendingSignupPassword(): string | null {
  return pendingPassword;
}

export function clearPendingSignupPassword() {
  pendingPassword = null;
}
