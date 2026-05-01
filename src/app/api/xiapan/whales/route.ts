// /api/xiapan/whales
//
// V0.47 · Polymarket 大单 + 鲸鱼活动 feed
// 视频 n3PkwmEZ0aQ 研究 · PolyGun 收购 Polymarket Analytics 拥有 2.3M 交易者 DB
// 我们做免费版 · Polymarket data-api /trades 公开 · 抽大单
//
// 输出:
//   trades_feed[]   · 近期 $200+ 大单 · 排序时间降
//   top_traders[]   · 24h 活跃 Top N · group by wallet · 总 $vol

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 25;
export const revalidate = 60;

const POLY = "https://data-api.polymarket.com";

interface PolyTrade {
  proxyWallet?: string;
  side?: string;             // BUY / SELL
  asset?: string;
  conditionId?: string;
  size?: number;             // shares
  price?: number;            // 0-1
  timestamp?: number;
  title?: string;
  slug?: string;
  outcome?: string;
  eventSlug?: string;
  name?: string;
  pseudonym?: string;
  profileImage?: string;
  transactionHash?: string;
}

interface WhaleTrade {
  wallet: string;
  trader_name?: string;
  pseudonym?: string;
  side: string;
  size: number;
  price: number;
  dollar_value: number;
  market_title: string;
  outcome: string;
  event_slug: string;
  timestamp: number;
  age_minutes: number;
  tx_hash?: string;
}

interface TopTrader {
  wallet: string;
  trader_name?: string;
  pseudonym?: string;
  trade_count: number;
  total_volume_usd: number;
  buy_count: number;
  sell_count: number;
  recent_markets: string[];
  last_seen_minutes_ago: number;
}

async function fetchPolyTrades(limit = 500): Promise<PolyTrade[]> {
  try {
    const r = await fetch(
      `${POLY}/trades?limit=${limit}`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    return (await r.json()) as PolyTrade[];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minDollar = parseFloat(url.searchParams.get("minDollar") ?? "200");
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "30", 10));

  try {
    const trades = await fetchPolyTrades(500);
    const now = Date.now() / 1000;

    // 过滤大单
    const whaleTrades: WhaleTrade[] = trades
      .map((t) => {
        const size = t.size ?? 0;
        const price = t.price ?? 0;
        const dv = size * price;
        const ts = t.timestamp ?? now;
        return {
          wallet: t.proxyWallet ?? "",
          trader_name: t.name ? t.name : undefined,
          pseudonym: t.pseudonym,
          side: t.side ?? "?",
          size,
          price,
          dollar_value: Number(dv.toFixed(2)),
          market_title: t.title ?? t.slug ?? "?",
          outcome: t.outcome ?? "?",
          event_slug: t.eventSlug ?? "",
          timestamp: ts,
          age_minutes: Math.round((now - ts) / 60),
          tx_hash: t.transactionHash,
        };
      })
      .filter((t) => t.dollar_value >= minDollar && t.wallet !== "");

    whaleTrades.sort((a, b) => b.timestamp - a.timestamp);

    // group by wallet for top_traders
    const traderMap = new Map<string, TopTrader>();
    for (const t of trades) {
      const w = t.proxyWallet;
      if (!w) continue;
      const size = t.size ?? 0;
      const price = t.price ?? 0;
      const dv = size * price;
      if (dv < 50) continue; // 低于 $50 跳过

      const ts = t.timestamp ?? now;
      let existing = traderMap.get(w);
      if (!existing) {
        existing = {
          wallet: w,
          trader_name: t.name || undefined,
          pseudonym: t.pseudonym || undefined,
          trade_count: 0,
          total_volume_usd: 0,
          buy_count: 0,
          sell_count: 0,
          recent_markets: [],
          last_seen_minutes_ago: 9999,
        };
        traderMap.set(w, existing);
      }
      existing.trade_count++;
      existing.total_volume_usd += dv;
      if (t.side === "BUY") existing.buy_count++;
      else if (t.side === "SELL") existing.sell_count++;
      const mt = t.title ?? t.slug ?? "";
      if (mt && !existing.recent_markets.includes(mt) && existing.recent_markets.length < 3) {
        existing.recent_markets.push(mt.slice(0, 60));
      }
      const age = Math.round((now - ts) / 60);
      if (age < existing.last_seen_minutes_ago) existing.last_seen_minutes_ago = age;
    }

    const topTraders = Array.from(traderMap.values())
      .filter((t) => t.total_volume_usd >= 200)
      .sort((a, b) => b.total_volume_usd - a.total_volume_usd)
      .slice(0, 20)
      .map((t) => ({
        ...t,
        total_volume_usd: Number(t.total_volume_usd.toFixed(2)),
      }));

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        raw_trades: trades.length,
        whale_trades: whaleTrades.length,
        top_traders: topTraders.length,
        min_dollar: minDollar,
      },
      trades_feed: whaleTrades.slice(0, limit),
      top_traders: topTraders,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
