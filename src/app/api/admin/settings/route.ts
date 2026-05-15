import { NextResponse } from "next/server";

export async function GET() {
  const envVars = {
    supabase: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: maskSecret(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE: maskSecret(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE),
    },
    stripe: {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      STRIPE_SECRET_KEY: maskSecret(process.env.STRIPE_SECRET_KEY),
    },
    ai: {
      AI_PROVIDER: process.env.AI_PROVIDER || "local",
      QWEN_API_URL: process.env.QWEN_API_URL || "http://localhost:11434/api/generate",
      QWEN_MODEL: process.env.QWEN_MODEL || "qwen2.5vl:7b",
    },
    app: {
      NODE_ENV: process.env.NODE_ENV,
    }
  };

  return NextResponse.json(envVars);
}

function maskSecret(secret?: string) {
  if (!secret) return "Non défini";
  if (secret.length < 8) return "********";
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
}

export async function POST(request: Request) {
  return NextResponse.json({ message: "Modification des variables d'environnement non supportée via l'interface web." }, { status: 403 });
}
