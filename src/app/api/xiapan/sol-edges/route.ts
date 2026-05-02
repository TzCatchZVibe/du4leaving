// /api/xiapan/sol-edges
//
// V0.72 W2 Day 2 · SOL 二元期权公允价 + 跨期限 + 跨平台 (复用 BTC 引擎)
//
// 覆盖 Kalshi SOL series ·
//   KXSOLD / KXSOLW / KXSOLMM / KXSOLH

import { NextResponse } from "next/server";
import { binaryCallFairP, adaptiveVol } from "@/lib/xiapan/百川/options-pricing";
import type { Signal } from "@/lib/xiapan/百川/fusion";
import { fetchPolyMarkets, getPolyYesPrice } from "@/lib/xiapan/百川/polymarket";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  title?: string;
  status?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  volume_24h_fp?: string;
  expected_expiration_time?: string;
  cap_strike?: string;
  floor_strike?: string;
}

interface SolEdge {
  ticker: string;
  event_ticker?: string;
  series: string;
  strike: number;
  side: "above" | "below" | "range";
  T_years: number;
  T_hours: number;
  spot: number;
  sigma_used: number;
  fair_p: number;
  market_p: number;
  edge_pp: number;
  vol_24: number;
  spread_c: number;
  signal: Signal | null;
}

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

async function fetchSolSpot(): Promise<number | null> {
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return parseFloat(d?.data?.amount || "0") || null;
  } catch {
    return null;
  }
}

async function fetchSolCloses(days: number): Promise<number[]> {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400_000);
    const url = `https://api.exchange.coinbase.com/products/SOL-USD/candles?granularity=86400&start=${start.toISOString()}&end=${end.toISOString()}`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const data = (await r.json()) as Array<[number, number, number, number, number, number]>;
    return data.map((c) => c[4]).reverse();
  } catch {
    return [];
  }
}

async function fetchKalshiSolSeries(series: string): Promise<KalshiMarket[]> {
  try {
    const evR = await fetch(
      `${KALSHI_API}/events?series_ticker=${series}&limit=20&status=open`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!evR.ok) return [];
    const evD = await evR.json();
    const events = (evD.events || []) as Array<{ event_ticker: string; title?: string }>;
    if (events.length === 0) return [];

    const limited = events.slice(0, 5);
    const all: KalshiMarket[] = [];
    await Promise.all(
      limited.map(async (ev) => {
        try {
          const r = await fetch(`${KALSHI_API}/events/${ev.event_ticker}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(6000),
          });
          if (!r.ok) return;
          const d = await r.json();
          for (const m of (d.markets || []) as KalshiMarket[]) {
            if (m.status === "active" || m.status === "open") {
              m.event_ticker = ev.event_ticker;
              m.title = m.title ?? ev.title;
              all.push(m);
            }
          }
        } catch {}
      })
    );
    return all;
  } catch {
    return [];
  }
}

interface ParsedTicker {
  series: string;
  strike: number;
  side: "above" | "below" | "range";
  expire_at: Date | null;
}

function parseSolTicker(m: KalshiMarket): ParsedTicker | null {
  const seriesMatch = m.ticker.match(/^(KXSOL[A-Z]{1,3})/);
  if (!seriesMatch) return null;
  const series = seriesMatch[1];

  let strike = 0;
  let side: "above" | "below" | "range" = "above";
  if (m.cap_strike) {
    strike = parseFloat(m.cap_strike);
    side = "below";
  } else if (m.floor_strike) {
    strike = parseFloat(m.floor_strike);
    side = "above";
  } else {
    const numMatch = m.ticker.match(/[TB](\d+)$/);
    if (numMatch) {
      strike = parseInt(numMatch[1]);
      side = m.ticker.includes("-T") ? "above" : "below";
    }
  }
  if (strike <= 0) return null;

  let expire_at: Date | null = null;
  if (m.expected_expiration_time) expire_at = new Date(m.expected_expiration_time);
  return { series, strike, side, expire_at };
}

const SERIES_TO_SCAN = ["KXSOLD", "KXSOLW", "KXSOLMM", "KXSOLH"];

export async function GET() {
  const [spot, history30, history7] = await Promise.all([
    fetchSolSpot(),
    fetchSolCloses(30),
    fetchSolCloses(7),
  ]);

  if (!spot || history30.length < 10) {
    return NextResponse.json(
      { ok: false, error: "SOL spot or history unavailable", spot, history_n: history30.length },
      { status: 200 }
    );
  }

  const sigma = adaptiveVol({
    prices_30d: history30,
    prices_7d: history7.length >= 4 ? history7 : undefined,
  });

  const allMarkets = (await Promise.all(SERIES_TO_SCAN.map(fetchKalshiSolSeries))).flat();
  const edges: SolEdge[] = [];
  const bsSignals: Signal[] = [];

  for (const m of allMarkets) {
    const parsed = parseSolTicker(m);
    if (!parsed || !parsed.expire_at) continue;
    const T_ms = parsed.expire_at.getTime() - Date.now();
    if (T_ms <= 0) continue;
    const T_years = T_ms / (365 * 86400_000);
    const T_hours = T_ms / 3_600_000;

    const fair_p_above = binaryCallFairP({
      spot, strike: parsed.strike, T_years, sigma_annual: sigma,
    });
    let fair_p: number;
    if (parsed.side === "above") fair_p = fair_p_above;
    else if (parsed.side === "below") fair_p = 1 - fair_p_above;
    else fair_p = 0.5;

    const yes_ask_c = parseFloat(m.yes_ask_dollars || "0") * 100;
    const yes_bid_c = parseFloat(m.yes_bid_dollars || "0") * 100;
    if (yes_ask_c <= 0 || yes_ask_c >= 100) continue;
    const market_p = yes_ask_c / 100;
    const edge_pp = (fair_p - market_p) * 100;
    const vol_24 = parseFloat(m.volume_24h_fp || "0");
    const spread_c = yes_ask_c - yes_bid_c;

    let signal: Signal | null = null;
    if (Math.abs(edge_pp) >= 5 && vol_24 >= 200) {
      const direction: 1 | -1 = edge_pp >= 0 ? 1 : -1;
      signal = {
        source: "sol-bs",
        ticker: m.ticker,
        direction,
        predicted_p: fair_p,
        confidence: 0.60,
        reason: `BS SOL fair=${(fair_p * 100).toFixed(1)}% vs ${(market_p * 100).toFixed(0)}% · σ=${(sigma * 100).toFixed(0)}% · T=${T_hours.toFixed(1)}h`,
        ts: new Date().toISOString(),
        data: { spot, strike: parsed.strike, T_years, sigma },
      };
      bsSignals.push(signal);
    }

    edges.push({
      ticker: m.ticker,
      event_ticker: m.event_ticker,
      series: parsed.series,
      strike: parsed.strike,
      side: parsed.side,
      T_years, T_hours,
      spot, sigma_used: sigma,
      fair_p, market_p, edge_pp, vol_24, spread_c, signal,
    });
  }

  // 跨期限 (同 strike 不同 T 单调性约束)
  const crossTenorSignals: Signal[] = [];
  const byStrike = new Map<string, SolEdge[]>();
  for (const e of edges) {
    if (e.side !== "above") continue;
    const k = `${e.strike}-${e.side}`;
    const arr = byStrike.get(k) ?? [];
    arr.push(e);
    byStrike.set(k, arr);
  }
  for (const [, group] of byStrike) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.T_years - b.T_years);
    for (let i = 1; i < group.length; i++) {
      const a = group[i - 1];
      const b = group[i];
      const isOTM = a.strike > spot;
      const expectedMonotone = isOTM ? "ascending" : "descending";
      const violated =
        (expectedMonotone === "ascending" && a.market_p > b.market_p + 0.03) ||
        (expectedMonotone === "descending" && a.market_p < b.market_p - 0.03);
      if (!violated) continue;
      const buyTarget = expectedMonotone === "ascending" ? b : a;
      const direction: 1 | -1 = buyTarget.market_p < buyTarget.fair_p ? 1 : -1;
      crossTenorSignals.push({
        source: "sol-cross-tenor",
        ticker: buyTarget.ticker,
        direction,
        predicted_p: buyTarget.fair_p,
        confidence: 0.62,
        reason: `跨期限 SOL ${a.series} ${a.market_p.toFixed(2)} vs ${b.series} ${b.market_p.toFixed(2)} 同 strike $${a.strike}`,
        ts: new Date().toISOString(),
        data: { partner_ticker: (buyTarget === a ? b : a).ticker, strike: a.strike },
      });
    }
  }

  // 跨平台 · Polymarket 匹配
  const crossPlatformSignals: Signal[] = [];
  try {
    const polyAll = await fetchPolyMarkets({ search: "SOL", limit: 100 });
    const polyAll2 = await fetchPolyMarkets({ search: "Solana", limit: 100 });
    const polyMerged = [...polyAll, ...polyAll2.filter((p) => !polyAll.find((q) => q.id === p.id))];

    for (const e of edges) {
      if (e.side === "range") continue;
      for (const p of polyMerged) {
        const q = p.question?.toLowerCase() ?? "";
        if (!q.includes("solana") && !q.includes(" sol")) continue;
        const strikeMatch = q.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
        if (!strikeMatch) continue;
        const polyStrike = parseFloat(strikeMatch[1].replace(/,/g, ""));
        if (Math.abs(polyStrike - e.strike) / e.strike > 0.025) continue;
        if (!p.endDate) continue;
        const polyEnd = new Date(p.endDate);
        const expireAt = new Date(Date.now() + e.T_years * 365 * 86400_000);
        const dayDiff = Math.abs(polyEnd.getTime() - expireAt.getTime()) / 86400_000;
        if (dayDiff > 3) continue;
        const polyYes = getPolyYesPrice(p);
        if (polyYes === null) continue;
        const polyAbove = q.includes("reach") || q.includes("above") || q.includes("hit");
        let polyP = polyYes;
        if (e.side === "below" && polyAbove) polyP = 1 - polyP;
        else if (e.side === "above" && !polyAbove) polyP = 1 - polyP;
        const diff_pp = (polyP - e.market_p) * 100;
        if (Math.abs(diff_pp) < 4) continue;
        const direction: 1 | -1 = diff_pp > 0 ? 1 : -1;
        crossPlatformSignals.push({
          source: "sol-cross-platform",
          ticker: e.ticker,
          direction,
          predicted_p: (e.market_p + polyP) / 2,
          confidence: 0.68,
          reason: `Polymarket ${(polyP * 100).toFixed(0)}% vs Kalshi ${(e.market_p * 100).toFixed(0)}% · ${diff_pp.toFixed(1)}pp`,
          ts: new Date().toISOString(),
          data: { poly_id: p.id, poly_question: p.question, poly_p: polyP },
        });
      }
    }
  } catch { /* poly 偶尔挂 */ }

  edges.sort((a, b) => Math.abs(b.edge_pp) - Math.abs(a.edge_pp));

  const allSignals = [...bsSignals, ...crossTenorSignals, ...crossPlatformSignals];

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      spot,
      sigma_30d: sigma,
      total_markets: edges.length,
      bs_signals: bsSignals.length,
      cross_tenor_signals: crossTenorSignals.length,
      cross_platform_signals: crossPlatformSignals.length,
      total_signals: allSignals.length,
    },
    edges: edges.slice(0, 30),
    signals: allSignals,
  });
}
