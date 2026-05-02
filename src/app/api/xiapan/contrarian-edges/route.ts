// /api/xiapan/contrarian-edges
//
// V0.72 W3 Day 7 重写 · 反公众信号 (Walters / Thaler 派) · 全品类通用
//
// 之前 bug · /markets?status=open 返回的前 200 个全是 vol=0 长尾市场
//            高 vol 真活跃 ticker 在 cursor 后页 · 永远扫不到
//
// 修复 · 不再硬扫 /markets · 改用其他信号源已 fetch 过的高 vol ticker
//        从 btc/eth/sol/weather/nba/fed/fda 拉过来的活跃 ticker 池里扫
//        每个被扫的 ticker · 加 contrarian 信号 (vol skew 反向)
//
// 这样 · 任何被其他源标记的 ticker 自动获得第二信号
//        n_active 从 1 升到 2 · fusion 才能触发

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
  taker_side?: string;
}

interface MarketLite {
  ticker: string;
  yes_ask_c: number;
  yes_bid_c: number;
  vol_24: number;
  spread_c: number;
  market_p: number;
}

const baseURL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

interface SourceEdge {
  ticker: string;
  market_p?: number;
  vol_24?: number;
  spread_c?: number;
  yes_ask_c?: number;
}

/// 从其他信号源已 fetch 的高 vol ticker 池
async function pullActiveTickers(): Promise<MarketLite[]> {
  const sources = ["btc-edges", "eth-edges", "sol-edges", "weather-edges", "nba-edges", "fed-edges"];
  const tickerMap = new Map<string, MarketLite>();

  await Promise.all(
    sources.map(async (s) => {
      try {
        const r = await fetch(`${URL_PREFIX}/api/xiapan/${s}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        }).then((r) => r.json());
        if (!r.ok) return;
        for (const e of (r.edges ?? []) as SourceEdge[]) {
          if (!e.ticker || tickerMap.has(e.ticker)) continue;
          if ((e.vol_24 ?? 0) < 50) continue;
          if (e.market_p === undefined) continue;
          if (e.market_p <= 0.05 || e.market_p >= 0.95) continue;       // 尾事件跳
          tickerMap.set(e.ticker, {
            ticker: e.ticker,
            yes_ask_c: Math.round((e.market_p ?? 0) * 100),
            yes_bid_c: Math.round((e.market_p ?? 0) * 100) - (e.spread_c ?? 0),
            vol_24: e.vol_24 ?? 0,
            spread_c: e.spread_c ?? 0,
            market_p: e.market_p ?? 0,
          });
        }
      } catch {}
    })
  );
  return Array.from(tickerMap.values()).sort((a, b) => b.vol_24 - a.vol_24);
}

interface SkewResult {
  ticker: string;
  yes_buy_size: number;
  no_buy_size: number;
  total: number;
  skew_pct: number;
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
      if (t.taker_side === "yes") yesSize += cnt;
      else if (t.taker_side === "no") noSize += cnt;
    }
    const total = yesSize + noSize;
    if (total < 5) return null;
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

const SKEW_HIGH = 0.65;
const SKEW_LOW = 0.35;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(80, parseInt(url.searchParams.get("limit") ?? "40", 10));

  const markets = await pullActiveTickers();
  if (markets.length === 0) {
    return NextResponse.json({
      ok: true,
      signals: [],
      summary: { total_scanned: 0, with_skew: 0, signals: 0 },
      note: "no active tickers from other sources",
    });
  }

  const top = markets.slice(0, limit);
  const BATCH = 5;
  const allSkews: SkewResult[] = [];
  for (let i = 0; i < top.length; i += BATCH) {
    const batch = top.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((m) => fetchTradesSkew(m.ticker)));
    for (const r of results) if (r) allSkews.push(r);
    if (i + BATCH < top.length) await new Promise((r) => setTimeout(r, 250));
  }

  const signals: Signal[] = [];
  const marketDataMap: Record<string, { vol_24: number; spread_c: number; market_p: number }> = {};

  for (const skew of allSkews) {
    const m = top.find((x) => x.ticker === skew.ticker);
    if (!m) continue;

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

    const fair_p = direction === 1
      ? Math.min(0.95, m.market_p + 0.03)
      : Math.max(0.05, m.market_p - 0.03);

    signals.push({
      source: "contrarian",
      ticker: skew.ticker,
      direction,
      predicted_p: fair_p,
      confidence: 0.53,
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
      market_p: m.market_p,
    };
  }

  return NextResponse.json({
    ok: true,
    summary: {
      ticker_pool_total: markets.length,
      total_scanned: top.length,
      with_skew: allSkews.length,
      signals: signals.length,
    },
    signals,
    market_data: marketDataMap,
  });
}
