import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { A11Y_INIT_SCRIPT } from "@/lib/a11y";
import { SEASON_INIT_SCRIPT } from "@/lib/season";

/**
 * Script d'initialisation lu en tout début de <head> : applique le thème (clair/sombre) et le confort de lecture mémorisés AVANT le
 * premier affichage, sans clignotement. Servi comme fichier (et non écrit en ligne dans la page) pour que la CSP puisse interdire
 * les scripts en ligne sans nonce. Contenu identique pour tous : mis en cache.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(`${THEME_INIT_SCRIPT}\n${A11Y_INIT_SCRIPT}\n${SEASON_INIT_SCRIPT}\n`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
