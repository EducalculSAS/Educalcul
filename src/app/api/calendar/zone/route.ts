import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { ZONE_OPTIONS } from "@/lib/calendarZones";
import { getAuthenticatedUser } from "@/lib/apiAuth";

const ALLOWED_ZONES = new Set(ZONE_OPTIONS.filter(z => z.value !== "all").map(z => z.value));

async function resolveUser(authId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id")
    .eq("auth_id", authId)
    .maybeSingle();
  return data;
}

// PATCH: update the school zone of the requester or one of their children
export async function PATCH(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ownerId, zone } = body;
    if (!ownerId || !zone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!ALLOWED_ZONES.has(zone)) {
      return NextResponse.json({ error: "Invalid zone" }, { status: 400 });
    }

    const requester = await resolveUser(me.authId);
    if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ownerIdNum = Number(ownerId);
    let allowed = requester.id === ownerIdNum;
    if (!allowed && requester.role === "parent") {
      const { data: child } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", ownerIdNum)
        .eq("parent_id", requester.id)
        .maybeSingle();
      allowed = !!child;
    }
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("users")
      .update({ school_zone: zone })
      .eq("id", ownerIdNum);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
