import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { getChildPrefs, isQuietNow } from "@/lib/studentStats";

/** L'élève est-il dans une plage de repos fixée par son parent ? (interrogé régulièrement par QuietGuard) */
export async function GET(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me || me.role !== "child") return NextResponse.json({ quiet: false });
  const prefs = await getChildPrefs(me.id);
  return NextResponse.json({ quiet: isQuietNow(prefs) });
}
