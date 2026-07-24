import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, name, description, price, billing_interval, trial_days, promo_description, features")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data || []);
}
