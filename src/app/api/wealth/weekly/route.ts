// /api/wealth/weekly · 周报 · A · 替月报
// /复盘 默认调这个

import { NextResponse } from "next/server";
import { generateWeekly } from "@/lib/wealth/weekly";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  try {
    const r = await generateWeekly(offset);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
