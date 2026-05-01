// /api/xiapan/intel/markets
//
// V0.60 · 真 alpha · Polymarket Gamma + Kalshi 公开 API 合并
// 按 |priceShift24h| × log(vol24h) 排 · top 30 = 当下"在动的事件"
//
// 用户 directive · "信息差就是钱差 · 必须深度研究然后接入"
// 研究结论 · 这条 endpoint 是真 alpha · RSS 聚合器都是下游
//
// 60s 缓存 · 公开免 auth

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 60;

interface IntelMarket {
  platform: "polymarket" | "kalshi";
  ticker_or_slug: string;
  title: string;
  url: string;
  vol_24h: number;
  liquidity?: number;
  best_yes_price?: number;            // 0-100 cents (Kalshi) or 0-1 (Polymarket normalized to cents)
  prev_yes_price?: number;            // 24h ago
  price_shift_pp: number;             // 当前 - 24h前 · pp · 正向上涨
  open_interest?: number;
  end_date?: string;
  category?: string;
  tags?: string[];
  score: number;                      // |shift| × log(vol)
}

// ───────── Polymarket Gamma ─────────

interface PolyEvent {
  slug: string;
  title?: string;
  description?: string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  liquidity?: number;
  volume?: number;
  volume24hr?: number;
  volume1wk?: number;
  category?: string;
  tags?: string[];
  markets?: Array<{
    slug?: string;
    question?: string;
    outcomes?: string;       // JSON array
    outcomePrices?: string;  // JSON array of strings
    bestBid?: number;
    bestAsk?: number;
    lastTradePrice?: number;
    oneDayPriceChange?: number;
    oneDayDayPriceChange?: number;
    liquidityNum?: number | string;
    volume?: number | string;
  }>;
}

async function fetchPolymarket(): Promise<IntelMarket[]> {
  try {
    const r = await fetch(
      "https://gamma-api.polymarket.com/events?limit=80&closed=false&active=true&order=volume24hr&ascending=false",
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const events = (await r.json()) as PolyEvent[];
    const out: IntelMarket[] = [];
    for (const e of events) {
      const vol24 = Number(e.volume24hr ?? 0);
      if (vol24 < 100) continue;
      const m0 = (e.markets ?? [])[0];
      if (!m0) continue;
      let yesPrice = 0;
      try {
        const prices = JSON.parse(m0.outcomePrices ?? "[]") as string[];
        yesPrice = parseFloat(prices[0] ?? "0") * 100;
      } catch {
        if (m0.lastTradePrice !== undefined) yesPrice = m0.lastTradePrice * 100;
      }
      // oneDayPriceChange 是 -1 to 1 比例 · 转成 pp
      const shiftPp = (m0.oneDayPriceChange ?? 0) * 100;
      const score = Math.abs(shiftPp) * Math.log10(Math.max(10, vol24));
      out.push({
        platform: "polymarket",
        ticker_or_slug: e.slug,
        title: e.title ?? m0.question ?? e.slug,
        url: `https://polymarket.com/event/${e.slug}`,
        vol_24h: vol24,
        liquidity: e.liquidity,
        best_yes_price: yesPrice,
        price_shift_pp: shiftPp,
        end_date: e.endDate,
        category: e.category,
        tags: e.tags,
        score,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ───────── Kalshi ─────────

interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  title?: string;
  yes_bid?: number;
  yes_ask?: number;
  last_price?: number;
  previous_yes_bid?: number;
  previous_yes_ask?: number;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  status?: string;
  category?: string;
  expected_expiration_time?: string;
}

async function fetchKalshi(): Promise<IntelMarket[]> {
  try {
    // Pull a wide sample of open markets · sort client-side
    const r = await fetch(
      "https://api.elections.kalshi.com/trade-api/v2/markets?limit=200&status=open",
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = (await r.json()) as { markets?: KalshiMarket[] };
    const ms = d.markets ?? [];
    const out: IntelMarket[] = [];
    for (const m of ms) {
      const vol24 = m.volume_24h ?? 0;
      if (vol24 < 100) continue;
      const cur = (m.yes_bid ?? 0 + (m.yes_ask ?? 0)) / 2 || m.last_price || 0;
      const prev = ((m.previous_yes_bid ?? 0) + (m.previous_yes_ask ?? 0)) / 2;
      const shiftPp = prev > 0 ? cur - prev : 0;
      const score = Math.abs(shiftPp) * Math.log10(Math.max(10, vol24));
      out.push({
        platform: "kalshi",
        ticker_or_slug: m.ticker,
        title: m.title ?? m.ticker,
        url: `https://kalshi.com/markets/${m.event_ticker?.replace(/-\d.*$/, "").toLowerCase() ?? m.ticker.toLowerCase()}`,
        vol_24h: vol24,
        best_yes_price: cur,
        prev_yes_price: prev,
        price_shift_pp: shiftPp,
        open_interest: m.open_interest,
        end_date: m.expected_expiration_time,
        category: m.category,
        score,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "30", 10));
  const platform = url.searchParams.get("platform"); // "polymarket" | "kalshi" | "all"

  try {
    const [poly, kalshi] = await Promise.all([
      platform === "kalshi" ? Promise.resolve([] as IntelMarket[]) : fetchPolymarket(),
      platform === "polymarket" ? Promise.resolve([] as IntelMarket[]) : fetchKalshi(),
    ]);
    const merged = [...poly, ...kalshi];
    merged.sort((a, b) => b.score - a.score);
    const top = merged.slice(0, limit);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        polymarket_count: poly.length,
        kalshi_count: kalshi.length,
        total: merged.length,
        returned: top.length,
        biggest_mover_pp: top[0]?.price_shift_pp ?? 0,
        biggest_mover_title: top[0]?.title ?? "",
      },
      markets: top,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
