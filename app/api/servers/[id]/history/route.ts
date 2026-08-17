import { NextResponse } from "next/server";
import { getServerHistory } from "@/lib/prometheus";
import type { HistoryRange } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_RANGES: HistoryRange[] = ["1h", "24h", "7d"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") as HistoryRange | null;
  const range: HistoryRange =
    rangeParam && VALID_RANGES.includes(rangeParam) ? rangeParam : "1h";

  const data = await getServerHistory(id, range);
  return NextResponse.json({ success: true, data, cachedAt: new Date().toISOString() });
}
