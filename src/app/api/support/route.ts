import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail, validateString, validateName, isValidUUID } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// GET — tickets de l'utilisateur
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId"); // auth_id

    // ✓ SECURITY: Validate UUID format
    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const { data: tickets, error } = await supabaseAdmin
      .from("support_tickets")
      .select(`
        id, subject, message, status, priority, created_at, updated_at,
        replies:ticket_replies(id, admin_name, reply_message, replied_at)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[support-get] Database error:", error);
      return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
    }
    return NextResponse.json(tickets || []);
  } catch (err: any) {
    console.error("[support-get] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — créer un ticket
export async function POST(req: Request) {
  try {
    const { userId, userEmail, userName, subject, message, priority } = await req.json();

    // ✓ HIGH PRIORITY FIX: Add rate limiting
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rateLimitKey = userId || ip;
    const config = RATE_LIMITS["support:ticket"];
    const rl = rateLimitWithBackoff(`support:${rateLimitKey}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many support tickets. Please wait before submitting again." },
        { status: 429 }
      );
    }

    // ✓ VALIDATION: Validate all inputs
    if (userId && !isValidUUID(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (userEmail && !validateEmail(userEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (userName) {
      const validatedName = validateName(userName);
      if (!validatedName) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
    }

    const validatedSubject = validateString(subject, 500);
    if (!validatedSubject || validatedSubject.length < 5) {
      return NextResponse.json({ error: "Subject must be 5-500 characters" }, { status: 400 });
    }

    const validatedMessage = validateString(message, 10000);
    if (!validatedMessage || validatedMessage.length < 20) {
      return NextResponse.json({ error: "Message must be at least 20 characters" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: userId || null,
        user_email: userEmail || "",
        user_name: userName || "",
        subject: validatedSubject,
        message: validatedMessage,
        priority: priority === "high" ? "high" : "normal",
        status: "Ouvert",
      })
      .select()
      .single();

    if (error) {
      console.error("[support-post] Database error:", error);
      return NextResponse.json({ error: "Failed to create support ticket" }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error("[support-post] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
