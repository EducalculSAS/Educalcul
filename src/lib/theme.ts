/**
 * Mode clair / sombre. La préférence est enregistrée sur le compte
 * (users.theme_preference) pour la retrouver sur tous les appareils, et copiée
 * dans le navigateur (localStorage) : elle s'applique ainsi avant le premier
 * affichage (voir THEME_INIT_SCRIPT), sans flash de page claire.
 * Les couleurs du mode sombre sont dans globals.css (html[data-theme="dark"]).
 *
 * Le mode sombre ne concerne que les espaces connectés (parent, élève, admin) :
 * les pages publiques (accueil, offres, tarifs, FAQ, CGV, connexion…) restent
 * toujours en clair, même si la préférence est « sombre ».
 */
export type Theme = "light" | "dark";
export const THEME_KEY = "educalcul-theme";
export const DARK_MODE_PREFIXES = ["/parent", "/child", "/admin", "/dashboard"] as const;

export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark";

/** Cette page a-t-elle droit au mode sombre (espace connecté) ? */
export const isDarkModePath = (pathname: string | null | undefined) =>
  !!pathname && DARK_MODE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return isTheme(t) ? t : "light";
  } catch {
    return "light";
  }
}

/** Thème réellement affiché sur cette page : la préférence, mais clair hors espaces connectés. */
export function syncThemeToPath(pathname: string = window.location.pathname) {
  const dark = readStoredTheme() === "dark" && isDarkModePath(pathname);
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0a1020" : "#0f1e3a");
}

/** Mémorise la préférence dans ce navigateur puis l'applique à la page courante. */
export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* navigation privée : la préférence vaut pour cette page seulement */ }
  syncThemeToPath();
}

/** Script inséré dans <head> : applique le thème mémorisé avant le premier rendu. */
export const THEME_INIT_SCRIPT =
  `try{var p=location.pathname;if(localStorage.getItem("${THEME_KEY}")==="dark"&&/^\\/(parent|child|admin|dashboard)(\\/|$)/.test(p))document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;
