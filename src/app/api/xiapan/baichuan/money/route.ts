// /api/xiapan/baichuan/money
// V0.72 W3 Day 8 · /钱 · 一屏看完 30 秒
// ADHD 友好 · 紧凑 · 不分页

import { NextResponse } from "next/server";
import { readPools } from "@/lib/xiapan/百川/pools";
import { readAllLessons } from "@/lib/xiapan/百川/lessons";
import { liveStatus } from "@/lib/xiapan/百川/kalshi-live";

export const dynamic = "force-dynamic";

export async function GET() {
  const pools = readPools();
  if (!pools) {
    return NextResponse.json({
      ok: true,
      initialized: false,
      message: "百川未启动 · 发 /pools_init 50 注入 $50 起步",
    });
  }
  const lessons = readAllLessons();
  const today = new Date().toISOString().slice(0, 10);
  const todayLessons = lessons.filter((l) => l.ts.startsWith(today));
  const todayClosed = todayLessons.filter((l) => l.actual !== undefined && l.actual !== null);
  const todayPnL = todayClosed.reduce((s, l) => s + (l.pnl ?? 0), 0);
  const openLessons = lessons.filter((l) => l.actual === undefined || l.actual === null);
  const recent5 = lessons.slice(-5).reverse();
  const live = liveStatus();
  const total = pools.S.balance + pools.C.balance;
  const redLine = pools.P0 * 0.85;

  return NextResponse.json({
    ok: true,
    initialized: true,
    pools: {
      P0: pools.P0,
      red_line: redLine,
      S: pools.S.balance,
      C: pools.C.balance,
      total,
      total_vs_P0_pct: ((total - pools.P0) / pools.P0) * 100,
      circuit: pools.circuit_state,
    },
    today: {
      placed: todayLessons.length,
      closed: todayClosed.length,
      pnl: todayPnL,
      open: openLessons.length,
    },
    live: {
      enabled: live.enabled,
      reason: live.reason,
    },
    recent_5: recent5.map((l) => ({
      ts: l.ts.slice(11, 16),                              // HH:MM
      ticker: l.ticker.slice(0, 30),
      side: l.side,
      bucket: l.bucket,
      stake: l.stake,
      pnl: l.pnl,
      status: l.actual !== undefined && l.actual !== null
        ? (l.actual === 1 ? "✓" : "✗")
        : "·",
    })),
    lifetime: {
      cashout: pools.lifetime.total_cashout,
      reinvest: pools.lifetime.total_reinvest,
    },
  });
}
