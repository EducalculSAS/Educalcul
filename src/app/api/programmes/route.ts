import { NextResponse } from "next/server";
import { fetchProgrammePdfs } from "@/lib/programmePdfs";

export const revalidate = 86400;

export async function GET() {
  const map = await fetchProgrammePdfs();
  const data = Object.entries(map).map(([level, pdf]) => ({ level, ...pdf }));
  return NextResponse.json({ data });
}
