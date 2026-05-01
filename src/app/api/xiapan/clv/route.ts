// /api/xiapan/clv
//
// 计算每单 CLV (closing line value) · 你下单价 vs 赛前最后报价 · sharp 标尺
// 简化版 ·
// - 已结算 · CLV = (settlement_price 100 if won/0 if lost) - fill_price → 这其实是 P/L
// - 真 CLV 用 close · 我们没存 historical close · 用当前 last_price 近似
// - open · 用 current last_price 近似 close (仍未真 close · 但表示当前漂移)

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
  market_result?: string;   // "yes" | "no" | "void"
  realized_pnl?: string;
  settled_time: string;
};
type MarketResp = {
  market?: {
    ticker?: string;
    last_price?: number;
    yes_bid?: number;
    yes_ask?: number;
    status?: string;
  };
};

const fp = (s: string | undefined) => parseFloat(s || "0");

export async function GET() {
  try {
    const [fillsResp, setResp] = await Promise.all([
      authedKalshi<{ fills?: Fill[] }>("GET", "/portfolio/fills?limit=200"),
      authedKalshi<{ settlements?: Settlement[] }>("GET", "/portfolio/settlements?limit=200"),
    ]);
    const fills = fillsResp.fills || [];
    const settlements = setResp.settlements || [];

    // 索引 settlement
    const settled = new Map<string, Settlement>();
    for (const s of settlements) settled.set(s.ticker, s);

    // 拉每个唯一 ticker 的 current price (limit 30)
    const uniqueTickers = Array.from(new Set(fills.map((f) => f.ticker))).slice(0, 60);
    const priceMap = new Map<string, number>();
    await Promise.all(
      uniqueTickers.map(async (t) => {
        try {
          const m = await authedKalshi<MarketResp>(
            "GET",
            `/markets/${encodeURIComponent(t)}`
          );
          if (m.market?.last_price !== undefined) {
            priceMap.set(t, m.market.last_price);
          }
        } catch {}
      })
    );

    // 算每单 CLV
    type CLVRow = {
      ticker: string;
      side: "yes" | "no";
      action: "buy" | "sell";
      qty: number;
      fill_price_c: number;       // ¢
      reference_price_c: number;  // ¢ · 已结算用 100/0 · 否则用 last_price
      clv_pp: number;             // pp · 你比 reference 便宜多少
      is_settled: boolean;
      result: string | null;
      ts: string;
      sport: string;
    };

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

    const rows: CLVRow[] = [];
    for (const f of fills) {
      const fillPriceDollar = fp(f.yes_price_dollars || f.no_price_dollars);
      const fillPriceC = Math.round(fillPriceDollar * 100);
      const settle = settled.get(f.ticker);
      let referenceC = priceMap.get(f.ticker) ?? fillPriceC;
      let isSettled = false;
      let result: string | null = null;
      if (settle && settle.market_result) {
        isSettled = true;
        result = settle.market_result;
        // 已结算 · settlement implied · YES wins → yes 100¢ · NO wins → yes 0¢
        if (settle.market_result === "yes") referenceC = 100;
        else if (settle.market_result === "no") referenceC = 0;
        else referenceC = 50; // void
      }
      // CLV pp · YES 视角 (你 fill 比 reference 便宜)
      // buy yes · CLV pp = reference - fill (越多越好)
      // buy no · CLV pp = (100 - reference) - (100 - fill) = fill - reference
      const sideFactor = f.side === "yes" ? 1 : -1;
      const clv_pp = (referenceC - fillPriceC) * sideFactor;

      rows.push({
        ticker: f.ticker,
        side: f.side,
        action: f.action,
        qty: fp(f.count_fp),
        fill_price_c: fillPriceC,
        reference_price_c: referenceC,
        clv_pp,
        is_settled: isSettled,
        result,
        ts: f.created_time,
        sport: sportOf(f.ticker),
      });
    }

    // 汇总
    const totalCLV = rows.reduce((s, r) => s + r.clv_pp, 0);
    const positiveCount = rows.filter((r) => r.clv_pp > 0).length;
    const meanCLV = rows.length > 0 ? totalCLV / rows.length : 0;
    const sharpRatio = rows.length > 0 ? positiveCount / rows.length : 0;

    // 按 sport 分组
    const bySport: Record<string, { count: number; mean_clv: number; positive_rate: number }> = {};
    for (const sp of new Set(rows.map((r) => r.sport))) {
      const sub = rows.filter((r) => r.sport === sp);
      const mean = sub.length > 0 ? sub.reduce((s, r) => s + r.clv_pp, 0) / sub.length : 0;
      const pos = sub.length > 0 ? sub.filter((r) => r.clv_pp > 0).length / sub.length : 0;
      bySport[sp] = {
        count: sub.length,
        mean_clv: Number(mean.toFixed(2)),
        positive_rate: Number(pos.toFixed(3)),
      };
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        total_fills: rows.length,
        mean_clv_pp: Number(meanCLV.toFixed(2)),
        positive_count: positiveCount,
        positive_rate: Number(sharpRatio.toFixed(3)),
      },
      bySport,
      rows: rows.slice(0, 100),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
