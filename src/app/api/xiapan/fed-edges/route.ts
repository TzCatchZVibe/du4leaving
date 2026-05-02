// /api/xiapan/fed-edges
//
// V0.72 W3 Day 4 · 经济指标 · Kalshi vs Polymarket 跨平台
// 不直接接 CME (要付费) · 改用 Polymarket FOMC/CPI/Jobs/GDP 同事件 · 套利
//
// Polymarket FOMC 市场流动性高 + 机构跟踪准 · 跟 Kalshi 偏离 = 套利

import { NextResponse } from "next/server";
import { fetchPolyMarkets, getPolyYesPrice, type PolyMarket } from "@/lib/xiapan/百川/polymarket";
import type { Signal } from "@/lib/xiapan/百川/fusion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  status?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  volume_24h_fp?: string;
  expected_expiration_time?: string;
}

interface FedEdge {
  ticker: string;
  event_ticker?: string;
  title?: string;
  category: "fomc" | "cpi" | "jobs" | "gdp" | "other";
  poly_match?: { id: string; question: string; yes_p: number };
  market_p: number;
  fair_p: number;
  edge_pp: number;
  vol_24: number;
  spread_c: number;
  signal: Signal | null;
}

// Kalshi 经济类系列前缀
const SERIES_PREFIXES = ["KXFEDDECISION", "KXFED", "KXCPIYY", "KXCPI", "KXJOBS", "KXGDP"];

// Polymarket 关键词 (按 Kalshi category 映射)
const POLY_KEYWORDS = {
  fomc: ["fomc", "fed cut", "fed hike", "rate decision", "interest rate"],
  cpi: ["cpi", "inflation", "consumer price"],
  jobs: ["nfp", "non-farm", "nonfarm", "jobs report", "unemployment"],
  gdp: ["gdp", "gross domestic"],
};

function categorize(ticker: string, title: string): FedEdge["category"] {
  const t = (ticker + " " + title).toLowerCase();
  if (t.includes("fed") || t.includes("fomc")) return "fomc";
  if (t.includes("cpi") || t.includes("inflation")) return "cpi";
  if (t.includes("jobs") || t.includes("nfp")) return "jobs";
  if (t.includes("gdp")) return "gdp";
  return "other";
}

async function fetchKalshiSeries(prefix: string): Promise<KalshiMarket[]> {
  try {
    const r = await fetch(
      `${KALSHI_API}/events?series_ticker=${prefix}&limit=20&status=open`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    const events = (d.events ?? []) as Array<{ event_ticker: string; title?: string }>;
    const out: KalshiMarket[] = [];
    await Promise.all(
      events.slice(0, 5).map(async (ev) => {
        try {
          const detail = await fetch(`${KALSHI_API}/events/${ev.event_ticker}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(6000),
          });
          if (!detail.ok) return;
          const dd = await detail.json();
          for (const m of (dd.markets ?? []) as KalshiMarket[]) {
            if (m.status === "active" || m.status === "open") {
              m.event_ticker = ev.event_ticker;
              m.title = m.title ?? ev.title;
              out.push(m);
            }
          }
        } catch {}
      })
    );
    return out;
  } catch {
    return [];
  }
}

function findPolyMatch(
  m: KalshiMarket,
  category: FedEdge["category"],
  polyAll: PolyMarket[]
): { match: PolyMarket; yes_p: number } | null {
  if (category === "other") return null;
  const keywords = POLY_KEYWORDS[category as "fomc" | "cpi" | "jobs" | "gdp"];
  const expireAt = m.expected_expiration_time ? new Date(m.expected_expiration_time) : null;

  for (const p of polyAll) {
    const q = (p.question ?? "").toLowerCase();
    if (!keywords.some((k) => q.includes(k))) continue;
    // 时间匹配 · ± 14 天 (经济事件不像比赛 · 范围宽)
    if (!p.endDate) continue;
    const polyEnd = new Date(p.endDate);
    if (expireAt) {
      const dayDiff = Math.abs(polyEnd.getTime() - expireAt.getTime()) / 86400_000;
      if (dayDiff > 14) continue;
    }
    const yesP = getPolyYesPrice(p);
    if (yesP === null) continue;
    return { match: p, yes_p: yesP };
  }
  return null;
}

export async function GET() {
  // 1. 拉 Kalshi 经济市场
  const allKalshi = (await Promise.all(SERIES_PREFIXES.map(fetchKalshiSeries))).flat();
  if (allKalshi.length === 0) {
    return NextResponse.json({ ok: true, signals: [], summary: { total: 0 } });
  }

  // 2. 拉 Polymarket 候选 (4 个关键词并)
  const polyAll = (await Promise.all([
    fetchPolyMarkets({ search: "fed", limit: 60 }),
    fetchPolyMarkets({ search: "cpi", limit: 30 }),
    fetchPolyMarkets({ search: "jobs", limit: 30 }),
    fetchPolyMarkets({ search: "gdp", limit: 30 }),
  ])).flat();
  // 去重
  const uniquePoly = Array.from(new Map(polyAll.map((p) => [p.id, p])).values());

  const edges: FedEdge[] = [];
  const signals: Signal[] = [];

  for (const m of allKalshi) {
    const yes_ask_c = parseFloat(m.yes_ask_dollars || "0") * 100;
    const yes_bid_c = parseFloat(m.yes_bid_dollars || "0") * 100;
    if (yes_ask_c <= 0 || yes_ask_c >= 100) continue;
    const market_p = yes_ask_c / 100;
    const vol_24 = parseFloat(m.volume_24h_fp || "0");
    const spread_c = yes_ask_c - yes_bid_c;

    const category = categorize(m.ticker, m.title ?? "");
    const polyMatch = findPolyMatch(m, category, uniquePoly);

    let fair_p = market_p;          // 默认 (无 poly · 无 edge)
    let edge_pp = 0;
    let signal: Signal | null = null;

    if (polyMatch) {
      // 跨平台 · 取中位作公允 (双源加权)
      fair_p = (market_p + polyMatch.yes_p) / 2;
      edge_pp = (polyMatch.yes_p - market_p) * 100;
      if (Math.abs(edge_pp) >= 4 && vol_24 >= 200) {
        const direction: 1 | -1 = edge_pp > 0 ? 1 : -1;
        signal = {
          source: "fed-cross-platform",
          ticker: m.ticker,
          direction,
          predicted_p: fair_p,
          confidence: 0.62,
          reason: `${category.toUpperCase()} · Polymarket ${(polyMatch.yes_p * 100).toFixed(0)}% vs Kalshi ${(market_p * 100).toFixed(0)}% · ${edge_pp.toFixed(1)}pp`,
          ts: new Date().toISOString(),
          data: {
            poly_id: polyMatch.match.id,
            poly_question: polyMatch.match.question,
            poly_p: polyMatch.yes_p,
            category,
          },
        };
        signals.push(signal);
      }
    }

    edges.push({
      ticker: m.ticker,
      event_ticker: m.event_ticker,
      title: m.title,
      category,
      poly_match: polyMatch
        ? { id: polyMatch.match.id, question: polyMatch.match.question ?? "", yes_p: polyMatch.yes_p }
        : undefined,
      market_p,
      fair_p,
      edge_pp,
      vol_24,
      spread_c,
      signal,
    });
  }

  edges.sort((a, b) => Math.abs(b.edge_pp) - Math.abs(a.edge_pp));

  return NextResponse.json({
    ok: true,
    summary: {
      total_kalshi: allKalshi.length,
      poly_total: uniquePoly.length,
      matched: edges.filter((e) => e.poly_match).length,
      signals: signals.length,
    },
    edges: edges.slice(0, 20),
    signals,
  });
}
