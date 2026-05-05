// /api/wealth/burn · 本月 burn rate + 支出分类
// 用 SimpleFIN 真交易 · 自动分类

import { NextResponse } from "next/server";
import { summarizeMonth } from "@/lib/wealth/simplefin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const summary = await summarizeMonth(35);  // 35d 涵盖整月
    return NextResponse.json({ ok: true, ...summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
