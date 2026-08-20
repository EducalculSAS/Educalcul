/** Identifie un appareil de façon stable entre deux connexions, pour que
 * "Appareils connectés" (voir UserSessionsList.tsx) affiche une seule ligne
 * par machine physique au lieu d'une nouvelle ligne à chaque nouvelle session
 * Supabase (auth.sessions crée une ligne par connexion, jamais par appareil).
 * Le cookie est le seul lien stable entre deux connexions du même navigateur
 * — ni l'IP (change), ni le user-agent (partagé par tous les appareils du
 * même modèle/OS/navigateur) ne suffisent seuls. */
export const DEVICE_ID_COOKIE_NAME = "edu_device_id";
export const DEVICE_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 jours (max navigateurs), tant que non supprimé

export function getDeviceIdFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|; )${DEVICE_ID_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Étiquette lisible "OS • Navigateur" à partir du user-agent — plus précise
 * que l'ancien classement brut (juste "Mac"/"Ordinateur"), sans dépendance
 * externe. Ne prétend pas distinguer deux machines identiques (même OS +
 * même navigateur) : c'est le cookie device_id, pas le libellé, qui évite
 * les doublons dans la liste. */
export function summarizeDeviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Appareil inconnu";

  let os = "Ordinateur";
  if (/ipad/i.test(ua)) os = "iPad";
  else if (/iphone/i.test(ua)) os = "iPhone";
  else if (/android/i.test(ua)) os = "Android";
  else if (/macintosh|mac os x/i.test(ua)) os = "Mac";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/crios\//i.test(ua)) browser = "Chrome";
  else if (/fxios\//i.test(ua)) browser = "Firefox";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";

  return browser ? `${os} • ${browser}` : os;
}

/** Session Supabase courante (auth.sessions.id), lue directement dans le
 * payload du JWT — même technique déjà utilisée par /api/user/sessions pour
 * marquer "cet appareil". Permet de retrouver et révoquer la BONNE session
 * sous-jacente au moment de la suppression d'un appareil, sans dépendre
 * d'un aller-retour réseau vers Supabase. */
export function decodeSessionIdFromAuthHeader(req: Request): string | null {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.session_id || null;
  } catch {
    return null;
  }
}
