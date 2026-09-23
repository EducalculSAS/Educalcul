import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { isValidUrlPath, isAllowedFileExtension } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { getAuthenticatedUser } from "@/lib/apiAuth";

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
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
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
    const uniqueFilename = `${uuidv4()}_${filename}`;

    const publicDir = path.join(process.cwd(), "public");
    const uploadDir = path.join(publicDir, folder);

    // ✓ SECURITY: Defense in depth - verify resolved path stays inside public/
    const resolvedPath = path.resolve(uploadDir);
    const resolvedPublicDir = path.resolve(publicDir);
    if (!resolvedPath.startsWith(resolvedPublicDir + path.sep) && resolvedPath !== resolvedPublicDir) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {
      // Ignore if exists
    }

    const filePath = path.join(uploadDir, uniqueFilename);
    
    // ✓ SECURITY: Final path validation
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(resolvedPublicDir + path.sep)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    
    await writeFile(filePath, buffer);

    const url = `/${folder}/${uniqueFilename}`.replace(/\/+/g, "/");

    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
