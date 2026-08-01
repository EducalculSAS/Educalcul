import { NextResponse } from "next/server";
import { fetchProgrammePdfs } from "@/lib/programmePdfs";

export async function GET() {
  const map = await fetchProgrammePdfs();
  const data = Object.entries(map).map(([level, pdf]) => ({ level, ...pdf }));
  return NextResponse.json({ data });
}
