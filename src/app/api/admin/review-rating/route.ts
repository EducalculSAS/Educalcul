import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { requireRole } from "@/lib/apiAuth";
import { fetchReviewRatingOverride, saveReviewRatingOverride } from "@/lib/reviewRatingOverride";

export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await fetchReviewRatingOverride());
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    return NextResponse.json(await saveReviewRatingOverride(body));
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
