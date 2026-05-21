import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

export async function GET() {
  const groups = {
    supabase: {
      label: "Supabase",
      keys: [
        { key: "NEXT_PUBLIC_SUPABASE_URL",          label: "URL",              secret: false },
        { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",     label: "Anon Key",         secret: true },
        { key: "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE", label: "Service Role Key", secret: true },
      ],
    },
    stripe: {
      label: "Stripe",
      keys: [
        { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", label: "Publishable Key", secret: false },
        { key: "STRIPE_SECRET_KEY",                  label: "Secret Key",       secret: true },
        { key: "STRIPE_WEBHOOK_SECRET",              label: "Webhook Secret",   secret: true },
      ],
    },
    mailjet: {
      label: "Mailjet (emails)",
      keys: [
        { key: "MJ_APIKEY_PUBLIC",  label: "API Key Public",  secret: false },
        { key: "MJ_APIKEY_PRIVATE", label: "API Key Private", secret: true },
        { key: "ADMIN_EMAIL_FROM",  label: "Email expéditeur",secret: false },
        { key: "ADMIN_NAME_FROM",   label: "Nom expéditeur",  secret: false },
      ],
    },
    ai: {
      label: "Intelligence Artificielle",
      keys: [
        { key: "AI_PROVIDER",        label: "Provider (openrouter / local)", secret: false },
        { key: "OPENROUTER_API_KEY", label: "Clé API OpenRouter",            secret: true  },
        { key: "OPENROUTER_MODEL",   label: "Modèle (dev: gemini-2.5-pro-exp-03-25:free · prod: deepseek/deepseek-chat)", secret: false },
        { key: "LOCAL_AI_URL",       label: "URL Ollama local (fallback)",   secret: false },
        { key: "LOCAL_AI_MODEL",     label: "Modèle Ollama local",           secret: false },
      ],
    },
  };

  const result: Record<string, any> = {};
  for (const [groupKey, group] of Object.entries(groups)) {
    result[groupKey] = {
      label: group.label,
      keys: group.keys.map(({ key, label, secret }) => ({
        key, label, secret,
        value: process.env[key] || "",
      })),
    };
  }
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  try {
    const { key, value } = await request.json();
    if (!key || value === undefined) return NextResponse.json({ error: "key et value requis" }, { status: 400 });

    let content = "";
    try { content = fs.readFileSync(ENV_PATH, "utf8"); } catch { content = ""; }

    const lines = content.split("\n");
    const idx = lines.findIndex(l => l.startsWith(`${key}=`));
    const newLine = `${key}=${value}`;
    if (idx >= 0) lines[idx] = newLine;
    else lines.push(newLine);

    fs.writeFileSync(ENV_PATH, lines.join("\n"), "utf8");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
