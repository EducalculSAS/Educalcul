import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = new Set([
  // No SVG: can embed scripts (stored XSS when served same-origin).
  "jpg", "jpeg", "png", "gif", "webp", "avif",
  "mp4", "webm", "mp3", "wav", "ogg",
  "pdf",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const rawFolder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
    }

    // Folder: single safe path segment only — no traversal, no separators.
    const folder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, "") || "uploads";

    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueFilename = `${uuidv4()}_${filename}`;

    const publicDir = path.join(process.cwd(), "public");
    const uploadDir = path.join(publicDir, folder);

    // Defense in depth: the resolved target must stay inside public/.
    if (!uploadDir.startsWith(publicDir + path.sep)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {
      // Ignore if exists
    }

    const filePath = path.join(uploadDir, uniqueFilename);
    await writeFile(filePath, buffer);

    const url = `/${folder}/${uniqueFilename}`.replace(/\/+/g, "/");

    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
