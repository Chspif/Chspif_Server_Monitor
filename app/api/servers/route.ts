import { NextResponse } from "next/server";
import { getServers } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getServers();
  return NextResponse.json({ success: true, data, cachedAt: new Date().toISOString() });
}
