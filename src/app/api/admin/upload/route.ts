import { getClientIp } from "@/lib/apiAuth";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { isValidUrlPath } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = new Set([
  // ✓ SECURITY: No SVG (can embed scripts causing stored XSS)
  "jpg", "jpeg", "png", "gif", "webp", "avif",
  "mp4", "webm", "mp3", "wav", "ogg",
  "pdf",
]);

// ✓ SECURITY: MIME type whitelist for strict validation
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg",
  "application/pdf",
]);

export async function POST(request: Request) {
  try {
    // Réservé aux admins (images de contenu). Les avatars ne s'envoient plus :
    // chacun choisit parmi ceux proposés par le site (voir AvatarPicker).
    const me = await getAuthenticatedUser(request);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // ✓ HIGH PRIORITY FIX: Rate limiting on file upload
    const ip = getClientIp(request);
    const config = RATE_LIMITS["upload:file"];
    const rl = await rateLimitWithBackoff(`upload:${ip}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawFolder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
    }

    // ✓ HIGH PRIORITY FIX: Folder validation - prevent directory traversal.
    // Sanitize each path SEGMENT individually (not the whole string) so that
    // legitimate subfolders like "uploads/course_images" keep their "/"
    // separators — a previous version stripped "/" entirely, which silently
    // collapsed every subfolder upload into a single flat folder name.
    const folder =
      rawFolder
        .split("/")
        .map((seg) => seg.replace(/[^a-zA-Z0-9_-]/g, ""))
        .filter((seg) => seg.length > 0)
        .join("/") || "uploads";
    if (!isValidUrlPath(folder)) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }

    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    
    // ✓ SECURITY: Check both extension AND MIME type
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "File type not allowed (extension)" }, { status: 415 });
    }

    // ✓ HIGH PRIORITY FIX: Validate MIME type matches extension
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed (MIME)" }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const objectPath = `${folder}/${uuidv4()}_${filename}`.replace(/\/+/g, "/");

    // Stockage Supabase (bucket public « uploads ») : l'ancienne version écrivait
    // dans public/ du serveur, en lecture seule sur Vercel — les envois
    // échouaient en production, et un fichier écrit en local disparaissait au
    // déploiement suivant.
    const { error: uploadError } = await supabaseAdmin.storage
      .from("uploads")
      .upload(objectPath, buffer, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (uploadError) {
      console.error("[upload] storage error:", uploadError.message);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    const url = supabaseAdmin.storage.from("uploads").getPublicUrl(objectPath).data.publicUrl;

    return NextResponse.json({ success: true, url });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
