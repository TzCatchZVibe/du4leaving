// 虾盘 · 单 market 深度 · orderbook + sibling markets + recent trades
// 给 dashboard 展开 EdgeCard 时拉

import { NextRequest, NextResponse } from "next/server";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

async function call<T = unknown>(p: string): Promise<T> {
  const r = await fetch(`${KALSHI}${p}`, {
    headers: { Accept: "application/json", "User-Agent": "Xiapan/0.1" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json() as Promise<T>;
}

const fp = (s?: string) => parseFloat(s || "0");

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    // 1. market 自己 + event 下所有 sibling markets
    const m = await call<{
      market: {
        ticker: string;
        event_ticker: string;
        title?: string;
        yes_sub_title?: string;
        no_sub_title?: string;
        yes_bid_dollars?: string;
        yes_ask_dollars?: string;
        no_bid_dollars?: string;
        no_ask_dollars?: string;
        last_price_dollars?: string;
        volume_fp?: string;
        volume_24h_fp?: string;
        open_interest_fp?: string;
        previous_yes_ask_dollars?: string;
        previous_yes_bid_dollars?: string;
        yes_bid_size_fp?: string;
        yes_ask_size_fp?: string;
        rules_primary?: string;
      };
    }>(`/markets/${ticker}`);

    const eventTicker = m.market.event_ticker;
    const ev = await call<{
      event: { sub_title?: string; title?: string };
      markets: Array<{
        ticker: string;
        title?: string;
        yes_sub_title?: string;
        no_sub_title?: string;
        yes_bid_dollars?: string;
        yes_ask_dollars?: string;
        no_bid_dollars?: string;
        no_ask_dollars?: string;
        volume_24h_fp?: string;
        open_interest_fp?: string;
        status?: string;
      }>;
    }>(`/events/${eventTicker}`);

    // 2. orderbook
    let orderbook: {
      yes: [number, number][];
      no: [number, number][];
    } | null = null;
    try {
      const ob = await call<{
        orderbook?: {
          yes?: [number, number][];
          no?: [number, number][];
        };
      }>(`/markets/${ticker}/orderbook`);
      orderbook = {
        yes: ob.orderbook?.yes || [],
        no: ob.orderbook?.no || [],
      };
    } catch {
      // 静默
    }

    // 3. recent trades (event 级)
    let trades: Array<{
      ticker: string;
      yes_price: number;
      count: number;
      created_time: string;
      taker_side?: string;
    }> = [];
    try {
      const tr = await call<{
        trades?: Array<{
          ticker?: string;
          yes_price_dollars?: string;
          count_fp?: string;
          created_time?: string;
          taker_side?: string;
        }>;
      }>(`/markets/trades?ticker=${ticker}&limit=20`);
      trades = (tr.trades || []).map((t) => ({
        ticker: t.ticker || ticker,
        yes_price: Math.round(fp(t.yes_price_dollars) * 100),
        count: fp(t.count_fp),
        created_time: t.created_time || "",
        taker_side: t.taker_side,
      }));
    } catch {
      // 静默
    }

    return NextResponse.json({
      ok: true,
      market: m.market,
      event: ev.event,
      sibling_markets: ev.markets.filter((sm) => sm.ticker !== ticker),
      orderbook,
      trades,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
