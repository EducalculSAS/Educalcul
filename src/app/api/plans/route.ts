import { NextResponse } from "next/server";
import { fetchActivePlans } from "@/lib/plans";

export async function GET() {
  const plans = await fetchActivePlans();
  return NextResponse.json(plans);
}
