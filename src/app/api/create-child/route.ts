import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { validatePassword } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const requester = await requireRole(request, ["parent", "admin"]);
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, password, user_metadata } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    // Child accounts only live on the internal username domain.
    if (!/^[a-zA-Z0-9._-]+@educalcul\.user$/.test(email)) {
      return NextResponse.json({ error: "Invalid child email" }, { status: 400 });
    }

    // Create user — role is always forced to "child", whatever the client sent.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...user_metadata,
        role: "child",
      },
    });

    if (error) {
      console.error("Error creating user:", error);
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    return NextResponse.json({ user: data.user }, { status: 200 });
  } catch (error: any) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
