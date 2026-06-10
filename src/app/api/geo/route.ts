import { NextResponse } from "next/server";
import { getIpGeo } from "@/lib/ipGeo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const geo = await getIpGeo(request);
  if (!geo.available) {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json({
    available: true,
    latitude: geo.latitude,
    longitude: geo.longitude,
    city: geo.city,
    country: geo.country,
  });
}
