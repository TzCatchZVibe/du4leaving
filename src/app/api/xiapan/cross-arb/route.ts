// /api/xiapan/cross-arb
//
// 跨平台价差扫描 · Kalshi × Polymarket 同事件 · 模糊匹配 · 价差打分
//
// 用户 directive · "要参考这个人的 kalshi 攻略" (zAEFF6qDSLk) ·
// 视频教 cross-platform arbitrage · 我们做信号版 · 不是真套利:
//   真套利 = 双腿同时下 · 锁定 1-2¢ · 需要 Polygon wallet · 留 v2
//   信号版 = 哪些事件两边价差 ≥ 4pp · 那 4pp 就是你的 picks 信号
//
// 输出 · pairs[] 含两边 quote + 价差 + 哪边便宜 + 套利可行 (理论)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface KalshiMarket {
  ticker: string;
  title?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume_24h?: number;
  open_interest?: number;
  status?: string;
  expected_expiration_time?: string;
}

interface KalshiEvent {
  event_ticker: string;
  series_ticker?: string;
  title?: string;
  category?: string;
  markets?: KalshiMarket[];
}

interface PolyMarket {
  question?: string;
  slug?: string;
  outcomes?: string;          // JSON-encoded ["Yes","No"]
  outcomePrices?: string;     // JSON-encoded ["0.42","0.58"]
  volume24hr?: number | string;
  liquidityNum?: number | string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  conditionId?: string;
  category?: string;
  marketSlug?: string;
}

interface ArbPair {
  event_label: string;
  k_ticker: string;
  k_title?: string;
  k_yes_ask: number;          // cents
  k_yes_bid: number;
  k_no_ask: number;
  k_no_bid: number;
  k_vol_24: number;
  poly_slug?: string;
  poly_question?: string;
  poly_yes_price: number;     // cents (0-100)
  poly_no_price: number;
  poly_vol_24: number;
  // 分歧计算
  yes_divergence_pp: number;        // (poly_yes - kalshi_yes_mid) · pp
  arb_buy_k_yes_poly_no: number;    // 1 - (k_yes_ask + poly_no) · 正数=可套
  arb_buy_k_no_poly_yes: number;    // 1 - (k_no_ask + poly_yes)
  signal: string;                   // "kalshi_cheap_yes" | "kalshi_cheap_no" | "polymarket_cheap" | "neutral"
  edge_pp: number;                  // 你该走哪边 · 多少 pp
}

const SPORT_SERIES = ["KXLOLGAME", "KXNBAGAME", "KXMLBGAME", "KXNFLGAME", "KXNHLGAME", "KXATPMATCH", "KXWTAMATCH", "KXEPLGAME", "KXUCLGAME"];

async function fetchKalshiActiveMarkets(): Promise<KalshiMarket[]> {
  const all: KalshiMarket[] = [];
  for (const s of SPORT_SERIES) {
    try {
      const r = await fetch(
        `https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=${s}&limit=10&status=open`,
        { cache: "no-store" }
      );
      if (!r.ok) continue;
      const d = await r.json();
      const events = (d.events || []) as KalshiEvent[];
      for (const ev of events) {
        for (const m of ev.markets || []) {
          if (m.status === "active" || m.status === "open") {
            all.push({ ...m, title: m.title || ev.title });
          }
        }
      }
    } catch {}
  }
  return all;
}

async function fetchPolymarketActive(limit = 200): Promise<PolyMarket[]> {
  try {
    const r = await fetch(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&order=volume24hr&ascending=false`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d) ? d : []) as PolyMarket[];
  } catch {
    return [];
  }
}

function tokenize(s: string): Set<string> {
  const lower = s.toLowerCase();
  // 抓 2+ 字的 ASCII 词块 (英文常 hit · 中文有限) · 去停用词
  const stop = new Set(["the", "a", "an", "vs", "and", "or", "to", "in", "of", "on", "for", "win", "wins", "game", "match", "to win", "be"]);
  const words = (lower.match(/[a-z][a-z0-9]+/gi) || []).filter(w => w.length >= 2 && !stop.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = new Set([...a].filter(x => b.has(x)));
  const uni = new Set([...a, ...b]);
  return inter.size / uni.size;
}

function parsePolyOutcomes(m: PolyMarket): { yes: number; no: number } | null {
  try {
    const outcomes = JSON.parse(m.outcomes || "[]") as string[];
    const prices = JSON.parse(m.outcomePrices || "[]") as string[];
    if (outcomes.length !== 2 || prices.length !== 2) return null;
    let yIdx = -1, nIdx = -1;
    outcomes.forEach((o, i) => {
      const lo = o.toLowerCase();
      if (lo === "yes") yIdx = i;
      if (lo === "no") nIdx = i;
    });
    if (yIdx < 0 || nIdx < 0) return null;
    return { yes: parseFloat(prices[yIdx]), no: parseFloat(prices[nIdx]) };
  } catch {
    return null;
  }
}

function pickPair(k: KalshiMarket, p: PolyMarket): ArbPair | null {
  const polyPrices = parsePolyOutcomes(p);
  if (!polyPrices) return null;

  const k_yes_ask = k.yes_ask ?? 0;
  const k_yes_bid = k.yes_bid ?? 0;
  const k_no_ask = k.no_ask ?? 0;
  const k_no_bid = k.no_bid ?? 0;

  const k_yes_mid = (k_yes_ask + k_yes_bid) / 2;
  const poly_yes_c = polyPrices.yes * 100;
  const poly_no_c = polyPrices.no * 100;

  const yes_div_pp = poly_yes_c - k_yes_mid;

  // 套利可行 (1 dollar - 双腿成本)  · 单位 cents
  const arb_k_yes_poly_no = 100 - (k_yes_ask + poly_no_c);
  const arb_k_no_poly_yes = 100 - (k_no_ask + poly_yes_c);

  // 信号方向
  let signal = "neutral";
  let edge_pp = 0;
  if (Math.abs(yes_div_pp) >= 3) {
    if (yes_div_pp > 0) {
      // poly 更看好 yes · 比 kalshi 贵 → kalshi yes 便宜 (该买 kalshi yes)
      signal = "kalshi_cheap_yes";
      edge_pp = yes_div_pp;
    } else {
      // poly 更看好 no · kalshi yes 贵 → kalshi no 便宜
      signal = "kalshi_cheap_no";
      edge_pp = Math.abs(yes_div_pp);
    }
  }

  // 没流动性的不报
  const k_vol = k.volume_24h ?? 0;
  const poly_vol = typeof p.volume24hr === "number" ? p.volume24hr : parseFloat((p.volume24hr as string) || "0");
  if (k_vol < 100 || poly_vol < 100) return null;

  return {
    event_label: k.title || p.question || k.ticker,
    k_ticker: k.ticker,
    k_title: k.title,
    k_yes_ask, k_yes_bid, k_no_ask, k_no_bid,
    k_vol_24: k_vol,
    poly_slug: p.slug,
    poly_question: p.question,
    poly_yes_price: poly_yes_c,
    poly_no_price: poly_no_c,
    poly_vol_24: poly_vol,
    yes_divergence_pp: Number(yes_div_pp.toFixed(1)),
    arb_buy_k_yes_poly_no: Number(arb_k_yes_poly_no.toFixed(2)),
    arb_buy_k_no_poly_yes: Number(arb_k_no_poly_yes.toFixed(2)),
    signal,
    edge_pp: Number(edge_pp.toFixed(1)),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minDiv = parseFloat(url.searchParams.get("minDiv") ?? "3");
  const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10));

  try {
    const [kMarkets, pMarkets] = await Promise.all([
      fetchKalshiActiveMarkets(),
      fetchPolymarketActive(150),
    ]);

    // tokenize 一遍
    const kTokens = kMarkets.map((k) => ({ k, tokens: tokenize(k.title || "") }));
    const pTokens = pMarkets.map((p) => ({ p, tokens: tokenize(p.question || "") }));

    // 每个 kalshi 找 best polymarket match (jaccard ≥ 0.30)
    const pairs: ArbPair[] = [];
    const usedPoly = new Set<string>();
    for (const { k, tokens: kt } of kTokens) {
      let best: { p: PolyMarket; score: number } | null = null;
      for (const { p, tokens: pt } of pTokens) {
        if (p.slug && usedPoly.has(p.slug)) continue;
        const score = jaccard(kt, pt);
        if (score >= 0.30 && (!best || score > best.score)) {
          best = { p, score };
        }
      }
      if (!best) continue;
      const pair = pickPair(k, best.p);
      if (pair) {
        pairs.push(pair);
        if (best.p.slug) usedPoly.add(best.p.slug);
      }
    }

    // 排序 · edge_pp 降
    pairs.sort((a, b) => b.edge_pp - a.edge_pp);

    const filtered = pairs.filter((p) => p.edge_pp >= minDiv).slice(0, limit);
    const arb_eligible = filtered.filter((p) => p.arb_buy_k_yes_poly_no > 0.5 || p.arb_buy_k_no_poly_yes > 0.5).length;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        kalshi_count: kMarkets.length,
        poly_count: pMarkets.length,
        matched_count: pairs.length,
        signal_count: filtered.length,
        arb_eligible_count: arb_eligible,
        min_divergence_pp: minDiv,
      },
      pairs: filtered,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
