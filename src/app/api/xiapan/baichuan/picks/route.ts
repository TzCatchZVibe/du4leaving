// /api/xiapan/baichuan/picks · B 模式 · 每日 5 单 +EV 推荐
// V0.73 W1 D5 修 · 不调 LLM 估值 · 调 du4leaving 真信号 pipeline
//
// 调 ·
//   GET /api/xiapan/baichuan/picks?limit=5&min_ev=12

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

// du4leaving 真信号源 endpoint (相对路径 · 走 BASE)
// 每个返回 { edges: BtcEdge[], signals: Signal[] } · 我们用 edges 拿 fair_p / market_p / vol_24
const SIGNAL_SOURCES = [
  "btc-edges",        // BS 公允价 + 跨期 + 跨平台
  "eth-edges",
  "sol-edges",
  "weather-edges",    // NWS + Open-Meteo 双源
  "nba-edges",        // 538 Elo
  "fed-edges",        // 利率共识
  "fda-edges",        // 凸性策略
  "mention-edges",    // 实时名人嘴瓢 (这里 LLM 合理用)
  "contrarian-edges", // vol skew 反公众
];

interface UnifiedEdge {
  ticker: string;
  title?: string;
  source: string;             // btc-edges / weather-edges / ...
  fair_prob: number;          // 0-1 (yes 真概率)
  market_prob: number;        // 0-1
  edge_pp: number;            // (fair - market) * 100
  side: "yes" | "no";
  vol_24: number;
  spread_c: number;
  reasoning: string;
}

function getBaseUrl(req: Request): string {
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3001";
}

async function fetchSource(BASE: string, path: string): Promise<UnifiedEdge[]> {
  try {
    const r = await fetch(`${BASE}/api/xiapan/${path}`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return [];
    const d = await r.json();
    const edges = d.edges || [];
    const out: UnifiedEdge[] = [];
    for (const e of edges) {
      const fair = Number(e.fair_p ?? e.fair_prob ?? NaN);
      const mkt = Number(e.market_p ?? e.market_prob ?? NaN);
      if (isNaN(fair) || isNaN(mkt)) continue;
      if (mkt <= 0 || mkt >= 1) continue;
      const edgePp = (fair - mkt) * 100;
      out.push({
        ticker: e.ticker,
        title: e.title || "",
        source: path,
        fair_prob: fair,
        market_prob: mkt,
        edge_pp: edgePp,
        side: edgePp >= 0 ? "yes" : "no",
        vol_24: Number(e.vol_24 ?? e.volume_24h ?? 0),
        spread_c: Number(e.spread_c ?? 0),
        reasoning: e.reason || `${path} 数学公允价偏差`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const BASE = getBaseUrl(req);
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "5");
  const minEvPp = parseFloat(url.searchParams.get("min_ev") || "12");
  const minVol = parseFloat(url.searchParams.get("min_vol") || "50");
  const maxSpread = parseFloat(url.searchParams.get("max_spread") || "5");

  // 并行扫所有真信号源
  const lists = await Promise.all(SIGNAL_SOURCES.map((s) => fetchSource(BASE, s)));
  const all: UnifiedEdge[] = [];
  for (const l of lists) all.push(...l);

  // 流动性 + spread 硬过滤
  const liquid = all.filter(
    (e) => e.vol_24 >= minVol && (e.spread_c === 0 || e.spread_c <= maxSpread)
  );

  // EV 阈值过滤 (绝对值)
  const winners = liquid
    .filter((e) => Math.abs(e.edge_pp) >= minEvPp)
    .sort((a, b) => Math.abs(b.edge_pp) - Math.abs(a.edge_pp))
    .slice(0, limit);

  return NextResponse.json({
    ok: true,
    scanned: all.length,
    after_liquidity_filter: liquid.length,
    winners_count: winners.length,
    min_ev_pp: minEvPp,
    min_vol: minVol,
    max_spread_c: maxSpread,
    sources: SIGNAL_SOURCES,
    winners: winners.map((w) => ({
      ticker: w.ticker,
      title: (w.title || "").slice(0, 80),
      source: w.source,
      side: w.side,
      last_price: w.market_prob,
      fair_prob: w.fair_prob,
      ev_pct: +w.edge_pp.toFixed(1),
      reason: w.reasoning,
      vol_24: w.vol_24,
      spread_c: w.spread_c,
      kalshi_url: `https://kalshi.com/markets?q=${encodeURIComponent(w.ticker)}`,
    })),
  });
}
