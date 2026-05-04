// /api/wealth/networth · 阶段 1 #1 起床 1 屏看完所有钱
// V0.74 W1 · 跨账户净值聚合

import { NextResponse } from "next/server";
import { netWorthSummary, takeSnapshot } from "@/lib/wealth/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const snapshot = url.searchParams.get("snapshot") === "1";
  try {
    const summary = await netWorthSummary();
    if (snapshot) {
      await takeSnapshot();
    }
    return NextResponse.json({ ok: true, ...summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
