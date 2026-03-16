import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFilename = `${uuidv4()}_${filename}`;

    // Construct the absolute path to the public directory
    const publicDir = path.join(process.cwd(), "public");
    const uploadDir = path.join(publicDir, folder);

    // Ensure directory exists
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Ignore if exists
    }

    const filePath = path.join(uploadDir, uniqueFilename);
    await writeFile(filePath, buffer);

    // Return the relative URL
    const url = `/${folder}/${uniqueFilename}`.replace(/\/+/g, "/");

    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
