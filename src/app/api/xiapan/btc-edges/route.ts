// /api/xiapan/btc-edges
//
// V0.72 · 百川 W1 · 第一个真信号源
// BS 二元期权公允价 vs Kalshi BTC 实价 · 输出 Signal[] 给 fusion.ts
//
// 覆盖 Kalshi BTC series ·
//   KXBTCD       daily close (今日 UTC 收盘)
//   KXBTCW       weekly close
//   KXBTCMM      monthly close
//   KXBTCH       hourly close
//   KXBTCMAXY    年内最高
//   KXBTCMAXMM   月内最高
//
// 不覆盖 ·
//   KXBTC15M     已有专 endpoint · 短期波动率特殊
//   KXBTCMINH    分钟级 · 噪声大

import { NextResponse } from "next/server";
import { binaryCallFairP, adaptiveVol } from "@/lib/xiapan/百川/options-pricing";
import type { Signal } from "@/lib/xiapan/百川/fusion";
import { findPolyBtcMatches, type KalshiBtcLite } from "@/lib/xiapan/百川/polymarket";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  title?: string;
  status?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_ask_dollars?: string;
  volume_24h_fp?: string;
  open_interest_fp?: string;
  expected_expiration_time?: string;
  open_time?: string;
  cap_strike?: string;          // 部分上限
  floor_strike?: string;        // 部分下限
}

interface BtcEdge {
  ticker: string;
  event_ticker?: string;
  title?: string;
  series: string;               // KXBTCD / KXBTCW / ...
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

// ─────────────── 数据拉取 ───────────────

async function fetchSpot(): Promise<number | null> {
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
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

async function fetchHistoricalCloses(days: number): Promise<number[]> {
  // Coinbase exchange · 日 candles · 公开 endpoint
  try {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400_000);
    const url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${start.toISOString()}&end=${end.toISOString()}`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const data = (await r.json()) as Array<[number, number, number, number, number, number]>;
    // [time, low, high, open, close, volume]
    return data.map((c) => c[4]).reverse();        // 旧到新
  } catch {
    return [];
  }
}

async function fetchKalshiBtcSeries(seriesTicker: string): Promise<KalshiMarket[]> {
  try {
    const evR = await fetch(
      `${KALSHI_API}/events?series_ticker=${seriesTicker}&limit=20&status=open`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!evR.ok) return [];
    const evD = await evR.json();
    const events = (evD.events || []) as Array<{ event_ticker: string; title?: string }>;
    if (events.length === 0) return [];

    // 拉每个 event 的 markets · 并行限 5 个
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

// ─────────────── ticker 解析 ───────────────

interface ParsedTicker {
  series: string;
  strike: number;
  side: "above" | "below" | "range";
  expire_at: Date | null;
}

function parseBtcTicker(m: KalshiMarket): ParsedTicker | null {
  const t = m.ticker;
  // KXBTCD-26MAY02-T68000  (above 68000)
  // KXBTCD-26MAY02-B68000  (below)
  // 复杂 · 我们只解析 strike 数字
  // 优先用 cap_strike / floor_strike 字段
  const seriesMatch = t.match(/^(KXBTC[A-Z]{1,3})/);
  if (!seriesMatch) return null;
  const series = seriesMatch[1];

  // strike 数字 · 从 cap/floor 字段或 ticker 抓
  let strike = 0;
  let side: "above" | "below" | "range" = "above";
  if (m.cap_strike) {
    strike = parseFloat(m.cap_strike);
    side = "below";
  } else if (m.floor_strike) {
    strike = parseFloat(m.floor_strike);
    side = "above";
  } else {
    // 从 ticker 末尾抓数字 · "T68000" / "B68000"
    const numMatch = t.match(/[TB](\d+)$/);
    if (numMatch) {
      strike = parseInt(numMatch[1]);
      side = t.includes("-T") ? "above" : "below";
    }
  }
  if (strike <= 0) return null;

  let expire_at: Date | null = null;
  if (m.expected_expiration_time) {
    expire_at = new Date(m.expected_expiration_time);
  }
  return { series, strike, side, expire_at };
}

// ─────────────── 主入口 ───────────────

const SERIES_TO_SCAN = ["KXBTCD", "KXBTCW", "KXBTCMM", "KXBTCH"];

export async function GET() {
  const [spot, history30, history7] = await Promise.all([
    fetchSpot(),
    fetchHistoricalCloses(30),
    fetchHistoricalCloses(7),
  ]);

  if (!spot || history30.length < 10) {
    return NextResponse.json(
      { ok: false, error: "spot or history unavailable", spot, history_n: history30.length },
      { status: 200 }
    );
  }

  const sigma = adaptiveVol({ prices_30d: history30, prices_7d: history7.length >= 4 ? history7 : undefined });

  const allMarkets: KalshiMarket[] = (
    await Promise.all(SERIES_TO_SCAN.map((s) => fetchKalshiBtcSeries(s)))
  ).flat();

  const edges: BtcEdge[] = [];

  for (const m of allMarkets) {
    const parsed = parseBtcTicker(m);
    if (!parsed || !parsed.expire_at) continue;

    const T_ms = parsed.expire_at.getTime() - Date.now();
    if (T_ms <= 0) continue;
    const T_years = T_ms / (365 * 86400_000);
    const T_hours = T_ms / 3_600_000;

    const fair_p_above = binaryCallFairP({
      spot,
      strike: parsed.strike,
      T_years,
      sigma_annual: sigma,
    });

    let fair_p: number;
    if (parsed.side === "above") fair_p = fair_p_above;
    else if (parsed.side === "below") fair_p = 1 - fair_p_above;
    else fair_p = 0.5;            // range 暂跳

    const yes_ask_c = parseFloat(m.yes_ask_dollars || "0") * 100;
    const yes_bid_c = parseFloat(m.yes_bid_dollars || "0") * 100;
    const market_p = yes_ask_c / 100;
    if (yes_ask_c <= 0 || yes_ask_c >= 100) continue;

    const edge_pp = (fair_p - market_p) * 100;
    const vol_24 = parseFloat(m.volume_24h_fp || "0");
    const spread_c = yes_ask_c - yes_bid_c;

    let signal: Signal | null = null;
    if (Math.abs(edge_pp) >= 5 && vol_24 >= 200) {
      const side: 1 | -1 = edge_pp >= 0 ? 1 : -1;
      signal = {
        source: "btc-bs",
        ticker: m.ticker,
        direction: side,
        predicted_p: fair_p,
        confidence: 0.60,           // 初始 · 待 Brier 校准
        reason: `BS fair=${(fair_p * 100).toFixed(1)}% vs market=${(market_p * 100).toFixed(0)}% · σ=${(sigma * 100).toFixed(0)}% · T=${T_hours.toFixed(1)}h`,
        ts: new Date().toISOString(),
        data: {
          spot,
          strike: parsed.strike,
          T_years,
          sigma,
          edge_pp,
          vol_24,
          spread_c,
        },
      };
    }

    edges.push({
      ticker: m.ticker,
      event_ticker: m.event_ticker,
      title: m.title,
      series: parsed.series,
      strike: parsed.strike,
      side: parsed.side,
      T_years,
      T_hours,
      spot,
      sigma_used: sigma,
      fair_p,
      market_p,
      edge_pp,
      vol_24,
      spread_c,
      signal,
    });
  }

  // ─────────────── 跨期限套利信号 (第二 BTC 信源) ───────────────
  //
  // 数学约束 · 同 strike · T 越长 P(yes) 越接近 0.5 (vol 加大)
  //   if (sigma > 0): T1 < T2 ∧ K > spot → fairP(T1) < fairP(T2) (call OTM 单调)
  //                   T1 < T2 ∧ K < spot → fairP(T1) > fairP(T2) (call ITM)
  //   市场违约 · 套利
  //
  // 简化版 · 找同 strike 不同到期 · 检查 fair 跟市场单调性是否对齐
  const crossTenorSignals: Signal[] = [];
  const byStrike = new Map<string, BtcEdge[]>();
  for (const e of edges) {
    if (e.side !== "above") continue;       // 仅处理 above
    const k = `${e.strike}-${e.side}`;
    const arr = byStrike.get(k) ?? [];
    arr.push(e);
    byStrike.set(k, arr);
  }

  for (const [, group] of byStrike) {
    if (group.length < 2) continue;
    // 按 T 排序
    group.sort((a, b) => a.T_years - b.T_years);
    // 检查市场 P 单调性
    for (let i = 1; i < group.length; i++) {
      const a = group[i - 1];
      const b = group[i];
      const isOTM = a.strike > spot;
      const expectedMonotone = isOTM ? "ascending" : "descending";
      const violated =
        (expectedMonotone === "ascending" && a.market_p > b.market_p + 0.03) ||
        (expectedMonotone === "descending" && a.market_p < b.market_p - 0.03);
      if (!violated) continue;
      // 哪头被错价 · 公允价反推
      const buyTarget = expectedMonotone === "ascending" ? b : a; // 应贵的一边便宜
      const direction: 1 | -1 = buyTarget.market_p < buyTarget.fair_p ? 1 : -1;
      crossTenorSignals.push({
        source: "btc-cross-tenor",
        ticker: buyTarget.ticker,
        direction,
        predicted_p: buyTarget.fair_p,
        confidence: 0.62,
        reason: `跨期限错配 · ${a.series} ${a.market_p.toFixed(2)} vs ${b.series} ${b.market_p.toFixed(2)} 同 strike $${a.strike}`,
        ts: new Date().toISOString(),
        data: {
          partner_ticker: (buyTarget === a ? b : a).ticker,
          spot,
          strike: a.strike,
        },
      });
    }
  }

  // ─────────────── 跨平台套利信号 (Polymarket vs Kalshi) ───────────────
  // 同事件 · 双平台不同价 · 直接套利
  const kalshiLite: KalshiBtcLite[] = edges
    .filter((e) => e.side !== "range")
    .map((e) => ({
      ticker: e.ticker,
      strike: e.strike,
      expire_at: new Date(Date.now() + e.T_years * 365 * 86400_000),
      side: e.side as "above" | "below",
      market_p: e.market_p,
    }));

  const crossPlatformSignals: Signal[] = [];
  try {
    const matches = await findPolyBtcMatches(kalshiLite);
    for (const m of matches) {
      if (Math.abs(m.diff_pp) < 4) continue;        // 套利门 4pp+
      // diff > 0 · Polymarket 押 yes 更贵 → Kalshi yes 便宜 · 买 Kalshi yes
      const direction: 1 | -1 = m.diff_pp > 0 ? 1 : -1;
      const predicted_p = (m.kalshi.market_p + m.poly_yes_p) / 2;        // 中位
      crossPlatformSignals.push({
        source: "btc-cross-platform",
        ticker: m.kalshi.ticker,
        direction,
        predicted_p,
        confidence: 0.68,
        reason: `Polymarket vs Kalshi ${m.diff_pp.toFixed(1)}pp (poly ${(m.poly_yes_p * 100).toFixed(0)}% vs kalshi ${(m.kalshi.market_p * 100).toFixed(0)}%)`,
        ts: new Date().toISOString(),
        data: {
          poly_market_id: m.poly.id,
          poly_question: m.poly.question,
          poly_p: m.poly_yes_p,
          kalshi_p: m.kalshi.market_p,
        },
      });
    }
  } catch { /* 静默 · poly api 偶尔挂 */ }

  // 排序 · |edge_pp| 降
  edges.sort((a, b) => Math.abs(b.edge_pp) - Math.abs(a.edge_pp));

  const allSignals = [
    ...edges.filter((e) => e.signal !== null).map((e) => e.signal!),
    ...crossTenorSignals,
    ...crossPlatformSignals,
  ];

  const signalCount = allSignals.length;

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      spot,
      sigma_30d: sigma,
      total_markets: edges.length,
      signal_count: signalCount,
      bs_signals: edges.filter((e) => e.signal !== null).length,
      cross_tenor_signals: crossTenorSignals.length,
      cross_platform_signals: crossPlatformSignals.length,
    },
    edges: edges.slice(0, 30),
    signals: allSignals,
  });
}
