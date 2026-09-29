/**
 * Mode clair / sombre. La préférence est enregistrée sur le compte
 * (users.theme_preference) pour la retrouver sur tous les appareils, et copiée
 * dans le navigateur (localStorage) : elle s'applique ainsi avant le premier
 * affichage (voir ThemeScript), sans flash de page claire, même déconnecté.
 * Les couleurs du mode sombre sont dans globals.css (html[data-theme="dark"]).
 */
export type Theme = "light" | "dark";
export const THEME_KEY = "educalcul-theme";

export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark";

export function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return isTheme(t) ? t : "light";
  } catch {
    return "light";
  }
}

/** Applique le thème à la page et le mémorise dans ce navigateur. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0a1020" : "#0f1e3a");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* navigation privée : le thème reste appliqué pour cette page */ }
}

/** Script inséré dans <head> : applique le thème mémorisé avant le premier rendu. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;
