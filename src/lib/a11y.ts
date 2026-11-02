/**
 * Confort de lecture, réglé par chaque élève sur son appareil : police pour la dyslexie (OpenDyslexic), taille du texte,
 * espacement. Mémorisé dans le navigateur et appliqué avant le premier affichage (voir A11Y_INIT_SCRIPT), sans flash.
 * Les règles CSS correspondantes sont dans globals.css (html[data-a11y-...]).
 */
const A11Y_KEY = "educalcul-a11y";

export interface A11yPrefs {
  dyslexia: boolean;
  /** 0 = normal, 1 = grand, 2 = très grand. */
  size: 0 | 1 | 2;
  spacing: boolean;
}

export const DEFAULT_A11Y: A11yPrefs = { dyslexia: false, size: 0, spacing: false };

export function readA11y(): A11yPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(A11Y_KEY) || "{}");
    return {
      dyslexia: raw.dyslexia === true,
      size: raw.size === 1 || raw.size === 2 ? raw.size : 0,
      spacing: raw.spacing === true,
    };
  } catch {
    return DEFAULT_A11Y;
  }
}

export function applyA11y(prefs: A11yPrefs) {
  const html = document.documentElement;
  if (prefs.dyslexia) html.setAttribute("data-a11y-dyslexia", "1");
  else html.removeAttribute("data-a11y-dyslexia");
  if (prefs.size) html.setAttribute("data-a11y-size", String(prefs.size));
  else html.removeAttribute("data-a11y-size");
  if (prefs.spacing) html.setAttribute("data-a11y-spacing", "1");
  else html.removeAttribute("data-a11y-spacing");
}

export function saveA11y(prefs: A11yPrefs) {
  try {
    localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
  } catch {
    /* navigation privée : le réglage vaut pour cette page seulement */
  }
  applyA11y(prefs);
}

/** Script inséré dans <head> : applique les réglages mémorisés avant le premier rendu. */
export const A11Y_INIT_SCRIPT = `try{var a=JSON.parse(localStorage.getItem("${A11Y_KEY}")||"{}"),h=document.documentElement;if(a.dyslexia)h.setAttribute("data-a11y-dyslexia","1");if(a.size===1||a.size===2)h.setAttribute("data-a11y-size",String(a.size));if(a.spacing)h.setAttribute("data-a11y-spacing","1")}catch(e){}`;
