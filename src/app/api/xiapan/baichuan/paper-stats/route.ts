// /api/xiapan/baichuan/paper-stats · 看 paper 战绩 · /统计 后端
// V0.73 W1 Day 5

import { NextResponse } from "next/server";
import { summary } from "@/lib/xiapan/百川/paper-picks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(30, parseInt(url.searchParams.get("days") || "7"));
  const stats = await summary(days);
  return NextResponse.json({ ok: true, ...stats });
}
