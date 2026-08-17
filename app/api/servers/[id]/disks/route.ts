import { NextResponse } from "next/server";
import { getServerDisks } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getServerDisks(id);
  return NextResponse.json({ success: true, data, cachedAt: new Date().toISOString() });
}
