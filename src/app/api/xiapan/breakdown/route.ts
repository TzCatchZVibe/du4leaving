// /api/xiapan/breakdown
//
// ROI 拆解 · 按 sport / 时段 / 买方 (yes/no) 分组 · 给"时间旅行 backtest" 替代方案
// 用户问 "如果只下 ★ STRONG 上月会赚多少" · 但我们没存 historical edge ·
// 所以做 "你过去 fill 在不同维度的 ROI" 替代分析
//
// 这是 "你应该在哪些场景多下 / 少下" 的诚实数据

import { NextResponse } from "next/server";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 60;

type Fill = {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count_fp: string;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  fee_cost?: string;
  created_time: string;
};
type Settlement = {
  ticker: string;
  market_result?: string;
  realized_pnl?: string;
  settled_time: string;
};

const fp = (s: string | undefined) => parseFloat(s || "0");

export async function GET() {
  try {
    const [fillsResp, setResp] = await Promise.all([
      authedKalshi<{ fills?: Fill[] }>("GET", "/portfolio/fills?limit=500"),
      authedKalshi<{ settlements?: Settlement[] }>("GET", "/portfolio/settlements?limit=500"),
    ]);
    const fills = fillsResp.fills || [];
    const settlements = setResp.settlements || [];

    // 索引 settlement
    const sett = new Map<string, Settlement>();
    for (const s of settlements) sett.set(s.ticker, s);

    const sportOf = (t: string): string => {
      const u = t.toUpperCase();
      if (u.includes("LOL")) return "lol";
      if (u.includes("NBA")) return "nba";
      if (u.includes("MLB")) return "mlb";
      if (u.includes("NFL")) return "nfl";
      if (u.includes("NHL")) return "nhl";
      if (u.includes("ITF") || u.includes("ATP") || u.includes("WTA")) return "tennis";
      if (u.includes("EPL") || u.includes("UCL") || u.includes("MLS")) return "soccer";
      if (u.includes("BTC") || u.includes("ETH") || u.includes("SOL")) return "crypto";
      return "other";
    };

    type Bucket = { count: number; pnl: number; cost: number; fee: number };
    const sportBucket: Record<string, Bucket> = {};
    const hourBucket: Record<number, Bucket> = {};
    const sideBucket: Record<string, Bucket> = {};
    const dowBucket: Record<number, Bucket> = {};

    for (const f of fills) {
      const sp = sportOf(f.ticker);
      const date = new Date(f.created_time);
      const hour = date.getHours();
      const dow = date.getDay();
      const fillPriceDollar = fp(f.yes_price_dollars || f.no_price_dollars);
      const cost = fp(f.count_fp) * fillPriceDollar;
      const fee = fp(f.fee_cost);
      const settle = sett.get(f.ticker);
      let pnl = 0;
      if (settle) {
        // 简化 · 单 fill 占 ticker total 比例 → settlement.realized_pnl 平摊
        // 不够精确但提供方向
        pnl = fp(settle.realized_pnl);
      }

      sportBucket[sp] = sportBucket[sp] || { count: 0, pnl: 0, cost: 0, fee: 0 };
      sportBucket[sp].count++;
      sportBucket[sp].pnl += pnl / Math.max(1, fills.filter((x) => x.ticker === f.ticker).length);
      sportBucket[sp].cost += cost;
      sportBucket[sp].fee += fee;

      hourBucket[hour] = hourBucket[hour] || { count: 0, pnl: 0, cost: 0, fee: 0 };
      hourBucket[hour].count++;
      hourBucket[hour].pnl += pnl / Math.max(1, fills.filter((x) => x.ticker === f.ticker).length);
      hourBucket[hour].cost += cost;
      hourBucket[hour].fee += fee;

      sideBucket[f.side] = sideBucket[f.side] || { count: 0, pnl: 0, cost: 0, fee: 0 };
      sideBucket[f.side].count++;
      sideBucket[f.side].pnl += pnl / Math.max(1, fills.filter((x) => x.ticker === f.ticker).length);
      sideBucket[f.side].cost += cost;
      sideBucket[f.side].fee += fee;

      dowBucket[dow] = dowBucket[dow] || { count: 0, pnl: 0, cost: 0, fee: 0 };
      dowBucket[dow].count++;
      dowBucket[dow].pnl += pnl / Math.max(1, fills.filter((x) => x.ticker === f.ticker).length);
      dowBucket[dow].cost += cost;
      dowBucket[dow].fee += fee;
    }

    const summarize = (b: Bucket) => ({
      count: b.count,
      pnl: Number(b.pnl.toFixed(2)),
      cost: Number(b.cost.toFixed(2)),
      fee: Number(b.fee.toFixed(2)),
      net_pnl: Number((b.pnl - b.fee).toFixed(2)),
      roi:
        b.cost > 0 ? Number(((b.pnl - b.fee) / b.cost).toFixed(3)) : 0,
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      bySport: Object.fromEntries(Object.entries(sportBucket).map(([k, v]) => [k, summarize(v)])),
      byHour: Object.fromEntries(Object.entries(hourBucket).map(([k, v]) => [k, summarize(v)])),
      bySide: Object.fromEntries(Object.entries(sideBucket).map(([k, v]) => [k, summarize(v)])),
      byDayOfWeek: Object.fromEntries(Object.entries(dowBucket).map(([k, v]) => [k, summarize(v)])),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
