// /api/xiapan/contrarian-edges
//
// V0.72 W2 Day 6 · 反公众信号 (Bill Walters / Thaler 派) · 全品类通用
//
// 原理 ·
//   Kalshi 散户交易明细公开 (trades feed)
//   计算近 100 单 yes-buy 比例 vs no-buy
//   skew > 70% 公众重押一边 → 反向押 (mean reversion · 长期 wr ~52-53%)
//
// 这是唯一在 ALL 品类工作的 alpha 源
// 目标 · 给单源市场 (没 BS / 没鲸鱼) 提供第二 signal

import { NextResponse } from "next/server";
import type { Signal } from "@/lib/xiapan/百川/fusion";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiTrade {
  ticker?: string;
  yes_price_dollars?: string;
  count_fp?: string;
  created_time?: string;
  taker_side?: string;            // "yes" | "no"
}

interface MarketLite {
  ticker: string;
  yes_ask_c: number;
  yes_bid_c: number;
  vol_24: number;
  spread_c: number;
}

async function fetchTopVolumeMarkets(limit = 30): Promise<MarketLite[]> {
  // 没全 endpoint · 走 events listing · 简化 ·
  // 实际跑 · 复用 picks 引擎里已有的 active markets list
  try {
    const r = await fetch(
      `${KALSHI_API}/markets?status=open&limit=200`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    const all = (d.markets ?? []) as Array<{
      ticker: string;
      yes_ask_dollars?: string;
      yes_bid_dollars?: string;
      volume_24h_fp?: string;
      status?: string;
    }>;
    return all
      .filter((m) => m.status === "active" || m.status === "open")
      .map((m) => ({
        ticker: m.ticker,
        yes_ask_c: parseFloat(m.yes_ask_dollars || "0") * 100,
        yes_bid_c: parseFloat(m.yes_bid_dollars || "0") * 100,
        vol_24: parseFloat(m.volume_24h_fp || "0"),
        spread_c: 0,
      }))
      .map((m) => ({ ...m, spread_c: m.yes_ask_c - m.yes_bid_c }))
      .filter((m) => m.vol_24 >= 500 && m.yes_ask_c > 5 && m.yes_ask_c < 95)
      .sort((a, b) => b.vol_24 - a.vol_24)
      .slice(0, limit);
  } catch {
    return [];
  }
}

interface SkewResult {
  ticker: string;
  yes_buy_size: number;
  no_buy_size: number;
  total: number;
  skew_pct: number;             // yes 占比 (0-1)
}

async function fetchTradesSkew(ticker: string, limit = 100): Promise<SkewResult | null> {
  try {
    const r = await fetch(
      `${KALSHI_API}/markets/trades?ticker=${ticker}&limit=${limit}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const trades = (d.trades ?? []) as KalshiTrade[];
    let yesSize = 0;
    let noSize = 0;
    for (const t of trades) {
      const cnt = parseFloat(t.count_fp || "0");
      if (cnt <= 0) continue;
      // taker_side · "yes" = 主动买 yes / "no" = 主动买 no
      if (t.taker_side === "yes") yesSize += cnt;
      else if (t.taker_side === "no") noSize += cnt;
    }
    const total = yesSize + noSize;
    if (total < 10) return null;       // 样本不够
    return {
      ticker,
      yes_buy_size: yesSize,
      no_buy_size: noSize,
      total,
      skew_pct: yesSize / total,
    };
  } catch {
    return null;
  }
}

const SKEW_HIGH = 0.70;        // 公众极度倾向
const SKEW_LOW = 0.30;          // 反向

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

  const markets = await fetchTopVolumeMarkets(limit);
  if (markets.length === 0) {
    return NextResponse.json({ ok: true, signals: [], summary: { total: 0 } });
  }

  // 并行限速 · 5 个一批
  const BATCH = 5;
  const allSkews: SkewResult[] = [];
  for (let i = 0; i < markets.length; i += BATCH) {
    const batch = markets.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((m) => fetchTradesSkew(m.ticker)));
    for (const r of results) if (r) allSkews.push(r);
    if (i + BATCH < markets.length) await new Promise((r) => setTimeout(r, 300));
  }

  const signals: Signal[] = [];
  const marketDataMap: Record<string, { vol_24: number; spread_c: number; market_p: number }> = {};

  for (const skew of allSkews) {
    const m = markets.find((x) => x.ticker === skew.ticker);
    if (!m) continue;
    const market_p = m.yes_ask_c / 100;

    // 公众极度倾向 yes → 反向押 no (信号方向 -1)
    let direction: 1 | -1 | null = null;
    let reasonExtra = "";
    if (skew.skew_pct >= SKEW_HIGH) {
      direction = -1;
      reasonExtra = `公众 ${(skew.skew_pct * 100).toFixed(0)}% 押 yes · 反向`;
    } else if (skew.skew_pct <= SKEW_LOW) {
      direction = 1;
      reasonExtra = `公众 ${((1 - skew.skew_pct) * 100).toFixed(0)}% 押 no · 反向`;
    }
    if (direction === null) continue;

    // 公允价估 · 反公众 +3pp shift (保守 · 学术长期 52-53%)
    const fair_p = direction === 1 ? Math.min(0.95, market_p + 0.03) : Math.max(0.05, market_p - 0.03);

    signals.push({
      source: "contrarian",
      ticker: skew.ticker,
      direction,
      predicted_p: fair_p,
      confidence: 0.53,           // 行业经验值
      reason: `${reasonExtra} (${skew.total.toFixed(0)} 张样本)`,
      ts: new Date().toISOString(),
      data: {
        skew_pct: skew.skew_pct,
        yes_size: skew.yes_buy_size,
        no_size: skew.no_buy_size,
      },
    });

    marketDataMap[skew.ticker] = {
      vol_24: m.vol_24,
      spread_c: m.spread_c,
      market_p,
    };
  }

  return NextResponse.json({
    ok: true,
    summary: {
      total_scanned: markets.length,
      with_skew: allSkews.length,
      signals: signals.length,
    },
    signals,
    market_data: marketDataMap,
  });
}
