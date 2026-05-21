import { NextResponse } from "next/server";

/**
 * ⚠️ ENDPOINT DÉSACTIVÉ PAR SÉCURITÉ
 * Cet endpoint exposait les clés API secrètes.
 * Les variables d'environnement doivent être gérées uniquement via Vercel Dashboard.
 * 
 * Pour la production:
 * 1. Ajoutez les variables privées dans Vercel Settings > Environment Variables
 * 2. N'exposez jamais les secrets via les APIs
 * 3. Utilisez toujours des variables sans NEXT_PUBLIC_
 */

export async function GET() {
  return NextResponse.json(
    { error: "Endpoint désactivé pour la sécurité" },
    { status: 403 }
  );
}

export async function PUT(request: Request) {
  return NextResponse.json(
    { error: "Endpoint désactivé pour la sécurité" },
    { status: 403 }
  );
}
