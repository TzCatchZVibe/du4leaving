// 虾盘 · 全 Kalshi 赛事 events 列表
// 用法 · /api/xiapan/all-events?sports=nba,mlb,lol
//        /api/xiapan/all-events (无 sports → 全部)

import { NextResponse } from "next/server";
import { fetchAllSportsEvents, SPORT_SERIES } from "@/lib/xiapan/kalshi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportsParam = url.searchParams.get("sports");
  const sports = sportsParam
    ? sportsParam.split(",").filter(Boolean)
    : undefined;
  const hours = Number(url.searchParams.get("hours") || "72");
  try {
    const all = await fetchAllSportsEvents(sports);
    const now = Date.now();
    const horizon = now + hours * 3600 * 1000;
    const past = now - 12 * 3600 * 1000;
    const inWindow = all.filter((r) => {
      if (!r.scheduledAt) return true;
      const t = new Date(r.scheduledAt).getTime();
      return t >= past && t <= horizon;
    });
    // 按 sport group
    const bySport: Record<string, typeof inWindow> = {};
    for (const r of inWindow) {
      if (!bySport[r.sport]) bySport[r.sport] = [];
      bySport[r.sport].push(r);
    }
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      hours,
      total: all.length,
      inWindow: inWindow.length,
      sports: Object.keys(SPORT_SERIES).map((k) => ({
        key: k,
        label: SPORT_SERIES[k].label,
        emoji: SPORT_SERIES[k].emoji,
        count: bySport[k]?.length ?? 0,
      })),
      events: inWindow.slice(0, 200),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
