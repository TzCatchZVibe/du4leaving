// /api/wealth/wrapped · 月度复盘 · 故事化
// /api/wealth/wrapped?offset=-1   → 上月 (默认)
// /api/wealth/wrapped?offset=0    → 本月 (进行中)
// /api/wealth/wrapped?offset=-2   → 上上月

import { NextResponse } from "next/server";
import { generateWrapped } from "@/lib/wealth/wrapped";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") || "-1");
  try {
    const report = await generateWrapped(offset);
    return NextResponse.json({ ok: true, ...report });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
