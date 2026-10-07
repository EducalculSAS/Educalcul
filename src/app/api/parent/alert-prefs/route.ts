import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { getUserData, setUserData } from "@/lib/userData";
import { DEFAULT_ALERT_PREFS, type ParentAlertPrefs } from "@/lib/parentAlerts";
import { sanitizeErrorMessage } from "@/lib/safeError";

async function parentOnly(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (me.role !== "parent") return { error: NextResponse.json({ error: "Réservé aux parents." }, { status: 403 }) };
  return { me };
}

export async function GET(req: Request) {
  const auth = await parentOnly(req);
  if (auth.error) return auth.error;
  return NextResponse.json(await getUserData<ParentAlertPrefs>(auth.me.id, "alertprefs", DEFAULT_ALERT_PREFS));
}

export async function PATCH(req: Request) {
  try {
    const auth = await parentOnly(req);
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => ({}));
    const current = await getUserData<ParentAlertPrefs>(auth.me.id, "alertprefs", DEFAULT_ALERT_PREFS);
    const next: ParentAlertPrefs = { ...current };
    for (const k of ["inactivity", "chapter", "goals", "email"] as const) if (typeof body[k] === "boolean") next[k] = body[k];
    if (body.inactivityDays !== undefined) {
      const d = Math.round(Number(body.inactivityDays));
      if (!Number.isFinite(d) || d < 2 || d > 30) return NextResponse.json({ error: "Seuil d'inactivité : 2 à 30 jours." }, { status: 400 });
      next.inactivityDays = d;
    }
    await setUserData(auth.me.id, "alertprefs", next);
    return NextResponse.json(next);
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}
