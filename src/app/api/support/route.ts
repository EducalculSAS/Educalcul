import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { validateEmail, validateString, isValidUUID } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { getAuthenticatedUser } from "@/lib/apiAuth";

// GET — tickets de l'utilisateur
export async function GET(req: Request) {
  try {
    // A user can only list their OWN tickets — identity from the JWT.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = me.authId;

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
    // Ticket is bound to the authenticated user; the client cannot forge user_id.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = me.authId;

    const { userEmail, userName, subject, message, priority } = await req.json();

    // ✓ HIGH PRIORITY FIX: Add rate limiting
    const rateLimitKey = userId;
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

    // Simple display field for the admin dashboard — identity is already
    // bound to the authenticated userId above, so only length-cap it (real
    // names can contain digits, e.g. "Ruben2").
    const validatedUserName = validateString(userName, 200) || "";

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
        user_name: validatedUserName,
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
