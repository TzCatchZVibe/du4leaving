// /api/xiapan/combos
//
// V0.40 · Kalshi Combos (multivariate) 错价扫描
// 视频 TOCgj28XJFM 启发 (Kalshi 2025 末上线 Combos parlay)
//
// 逻辑:
//  1. 列 active multivariate collections (NBA / MLB / NFL / NHL)
//  2. 每 collection 调 /lookup_points · 拿现存 combos (用户已询价的)
//  3. 每 combo 拉自己的 market quote + 各 leg quote
//  4. 隐含价 = product(leg_yes_prices) (假设独立)
//  5. 错价 edge = combo_implied - combo_ask
//     · 正 = combo 卖得便宜 (买 combo 划算 · 等于折扣篮)
//     · 负 = combo 卖得贵 (篮子比单买贵 · 反向操作)
//
// 注 · 独立性假设是粗近似 · NBA 同场内 game/spread/total 强相关 ·
//      不同事件 (game1 + game2) 独立性较好 · 因此这扫描更适合跨场 combos

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KAL = "https://api.elections.kalshi.com/trade-api/v2";

interface AssocEvent {
  ticker: string;
  is_yes_only?: boolean;
}

interface Collection {
  collection_ticker: string;
  series_ticker: string;
  title: string;
  description?: string;
  associated_events: AssocEvent[];
  associated_event_tickers?: string[];
  open_date?: string;
  close_date?: string;
  size_min?: number;
  size_max?: number;
}

interface LookupPoint {
  event_ticker: string;
  market_ticker: string;          // combo's own market_ticker
  last_queried_ts: string;
  selected_markets: Array<{
    event_ticker: string;
    market_ticker: string;
    side: "yes" | "no";
  }>;
}

interface KalMarket {
  ticker: string;
  title?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  status?: string;
  liquidity?: number;
}

interface ComboLeg {
  market_ticker: string;
  side: "yes" | "no";
  effective_price_c: number;       // 我选 yes → yes_ask · 我选 no → no_ask (买入参考)
  yes_ask?: number;
  no_ask?: number;
  title?: string;
}

interface ComboPick {
  collection_ticker: string;
  collection_title: string;
  combo_market_ticker: string;
  combo_yes_ask: number;            // cents (要花多少买 yes)
  combo_yes_bid: number;
  combo_volume_24h: number;
  combo_open_interest: number;
  combo_status?: string;
  legs: ComboLeg[];
  implied_yes_c: number;            // product of leg effective prices · 0-100
  edge_c: number;                   // implied - ask · 正 = 便宜
  edge_pct: number;                 // edge / ask
  signal: string;                   // "buy_cheap" | "fade_expensive" | "neutral"
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${KAL}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function listCollections(seriesPrefix: string, limit = 10): Promise<Collection[]> {
  // multivariate_event_collections endpoint accepts series_ticker filter
  const r = await fetchJson<{ multivariate_contracts?: Collection[] }>(
    `/multivariate_event_collections?series_ticker=${seriesPrefix}&limit=${limit}`
  );
  return r?.multivariate_contracts ?? [];
}

async function lookupCombos(collectionTicker: string): Promise<LookupPoint[]> {
  // 24h 内被人询价过的 combos
  const r = await fetchJson<{ lookup_points?: LookupPoint[] }>(
    `/multivariate_event_collections/${collectionTicker}/lookup?lookback_seconds=86400`
  );
  return r?.lookup_points ?? [];
}

async function fetchMarket(ticker: string): Promise<KalMarket | null> {
  const r = await fetchJson<{ market?: KalMarket }>(
    `/markets/${encodeURIComponent(ticker)}`
  );
  return r?.market ?? null;
}

async function pMap<T, R>(
  items: T[],
  fn: (x: T) => Promise<R>,
  conc: number
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try { out[i] = await fn(items[i]); }
      catch { out[i] = null as unknown as R; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, worker));
  return out;
}

function effectivePrice(side: "yes" | "no", m: KalMarket | null): number {
  if (!m) return 0;
  if (side === "yes") return m.yes_ask ?? 0;
  return m.no_ask ?? 0;
}

const SERIES_PREFIXES = [
  "KXMVENBASINGLEGAME",
  "KXMVENFLSINGLEGAME",
  "KXMVEMLBSINGLEGAME",
  "KXMVENHLSINGLEGAME",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minEdge = parseFloat(url.searchParams.get("minEdge") ?? "2");
  const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10));

  try {
    // 1) 列所有相关 series 的 active collections
    const collectionsArrs = await Promise.all(
      SERIES_PREFIXES.map((p) => listCollections(p, 8))
    );
    const collections = collectionsArrs.flat();

    // 2) 每个 collection 拉 lookup_points (近 24h 询价过的 combos)
    const lookupArrs = await Promise.all(
      collections.map(async (c) => {
        const lps = await lookupCombos(c.collection_ticker);
        return { collection: c, points: lps };
      })
    );

    // 3) Flatten & dedupe combos by market_ticker
    interface ComboInput {
      collection: Collection;
      point: LookupPoint;
    }
    const combos: ComboInput[] = [];
    const seen = new Set<string>();
    for (const { collection, points } of lookupArrs) {
      for (const p of points) {
        if (seen.has(p.market_ticker)) continue;
        seen.add(p.market_ticker);
        combos.push({ collection, point: p });
      }
    }

    if (combos.length === 0) {
      return NextResponse.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        summary: { collection_count: collections.length, combo_count: 0, signal_count: 0, min_edge: minEdge },
        picks: [],
      });
    }

    // 4) 每 combo: 拉自己的 market + 每 leg 的 market (limit 50 combos · 减负载)
    const limited = combos.slice(0, 50);
    const enriched: (ComboPick | null)[] = await pMap(
      limited,
      async ({ collection, point }) => {
        const comboMarket = await fetchMarket(point.market_ticker);
        if (!comboMarket) return null;

        const legMarkets = await pMap(
          point.selected_markets,
          (sm) => fetchMarket(sm.market_ticker),
          5
        );

        const legs: ComboLeg[] = point.selected_markets.map((sm, i) => ({
          market_ticker: sm.market_ticker,
          side: sm.side,
          effective_price_c: effectivePrice(sm.side, legMarkets[i]),
          yes_ask: legMarkets[i]?.yes_ask,
          no_ask: legMarkets[i]?.no_ask,
          title: legMarkets[i]?.title,
        }));

        // 任意一条 leg 没价 → 跳过
        if (legs.some((l) => l.effective_price_c <= 0)) return null;

        // 隐含联合价 (产品 of 0-1 概率 · 转回 cents)
        const probs = legs.map((l) => l.effective_price_c / 100);
        const impliedProb = probs.reduce((a, b) => a * b, 1);
        const implied_yes_c = impliedProb * 100;

        const combo_yes_ask = comboMarket.yes_ask ?? 0;
        const combo_yes_bid = comboMarket.yes_bid ?? 0;

        if (combo_yes_ask <= 0) return null;

        const edge_c = implied_yes_c - combo_yes_ask;
        const edge_pct = combo_yes_ask > 0 ? edge_c / combo_yes_ask : 0;

        let signal = "neutral";
        if (edge_c >= 1) signal = "buy_cheap";
        else if (edge_c <= -1) signal = "fade_expensive";

        return {
          collection_ticker: collection.collection_ticker,
          collection_title: collection.title,
          combo_market_ticker: point.market_ticker,
          combo_yes_ask,
          combo_yes_bid,
          combo_volume_24h: comboMarket.volume_24h ?? 0,
          combo_open_interest: comboMarket.open_interest ?? 0,
          combo_status: comboMarket.status,
          legs,
          implied_yes_c: Number(implied_yes_c.toFixed(1)),
          edge_c: Number(edge_c.toFixed(1)),
          edge_pct: Number(edge_pct.toFixed(3)),
          signal,
        };
      },
      4
    );

    const valid = enriched.filter((p): p is ComboPick => p !== null);
    const filtered = valid
      .filter((p) => Math.abs(p.edge_c) >= minEdge)
      .sort((a, b) => Math.abs(b.edge_c) - Math.abs(a.edge_c))
      .slice(0, limit);

    const buy_count = filtered.filter((p) => p.signal === "buy_cheap").length;
    const fade_count = filtered.filter((p) => p.signal === "fade_expensive").length;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        collection_count: collections.length,
        combo_total: combos.length,
        combo_evaluated: limited.length,
        combo_valid: valid.length,
        signal_count: filtered.length,
        buy_count,
        fade_count,
        min_edge: minEdge,
      },
      picks: filtered,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
