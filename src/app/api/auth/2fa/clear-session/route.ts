import { NextResponse } from "next/server";
import { clearTwoFactorCookie } from "@/lib/twoFactorCookie";

/**
 * Efface uniquement le cookie httpOnly de session 2FA sur cet appareil.
 * Appelé lors d'un SIGNED_OUT Supabase afin qu'une nouvelle connexion admin
 * demande de nouveau le code TOTP au lieu de réutiliser la fenêtre de 4 h.
 * Aucune donnée sensible n'est retournée et l'opération ne peut qu'abaisser
 * les privilèges de la session courante.
 */
export async function POST() {
  await clearTwoFactorCookie();
  return NextResponse.json({ success: true });
}
