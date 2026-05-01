// /api/xiapan/intel/whales-top
//
// V0.61 · top trader 钱包 · 按 24h vol 排 · 拉每人当前 positions
// 用户研究 · "Polymarket whale 钱包追踪 · top-50 PnL · 真 smart money"
//
// 现在版本 · 用 /api/xiapan/whales 已有的 top_traders + 每人调 Polymarket
//          /positions?user=<wallet> 拉当前持仓
// 60s 缓存

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 60;

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

const POLY = "https://data-api.polymarket.com";

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

interface PolyPosition {
  asset?: string;
  conditionId?: string;
  size?: number;
  avgPrice?: number;
  initialValue?: number;
  currentValue?: number;
  cashPnl?: number;
  percentPnl?: number;
  curPrice?: number;
  title?: string;
  outcome?: string;
  endDate?: string;
}

interface WhalePositionView {
  market: string;
  outcome: string;
  size: number;
  avg_price: number;       // 0-1
  cur_price: number;       // 0-1
  current_value: number;
  pnl_usd: number;
  pnl_pct: number;
  end_date?: string;
}

interface WhaleTopEntry {
  wallet: string;
  display_name: string;
  trader_name?: string;
  pseudonym?: string;
  vol_24h_usd: number;
  trade_count_24h: number;
  buy_sell_ratio: number;        // buys / total
  positions_count: number;
  total_position_value: number;
  total_position_pnl: number;
  top_positions: WhalePositionView[];
  last_seen_minutes_ago: number;
  url: string;                   // polymarket 主页 URL
}

async function fetchTopTraders(): Promise<TopTrader[]> {
  try {
    const r = await fetch(
      `${URL_PREFIX}/api/xiapan/whales?minDollar=300&limit=10`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json() as { top_traders?: TopTrader[] };
    return d.top_traders ?? [];
  } catch {
    return [];
  }
}

async function fetchPositions(wallet: string): Promise<PolyPosition[]> {
  try {
    const r = await fetch(
      `${POLY}/positions?user=${wallet}&limit=20&sortBy=CURRENT&sortDirection=DESC`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    return (await r.json()) as PolyPosition[];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(15, parseInt(url.searchParams.get("limit") ?? "8", 10));

  try {
    const traders = await fetchTopTraders();
    const top = traders.slice(0, limit);

    const enriched: WhaleTopEntry[] = await Promise.all(
      top.map(async (t) => {
        const positions = await fetchPositions(t.wallet);
        const positionViews: WhalePositionView[] = positions
          .filter((p) => (p.size ?? 0) > 0 && (p.title ?? "").length > 0)
          .map((p) => ({
            market: p.title ?? "?",
            outcome: p.outcome ?? "?",
            size: p.size ?? 0,
            avg_price: p.avgPrice ?? 0,
            cur_price: p.curPrice ?? 0,
            current_value: p.currentValue ?? 0,
            pnl_usd: p.cashPnl ?? 0,
            pnl_pct: p.percentPnl ?? 0,
            end_date: p.endDate,
          }))
          .sort((a, b) => b.current_value - a.current_value);

        const totalValue = positionViews.reduce((s, p) => s + p.current_value, 0);
        const totalPnl = positionViews.reduce((s, p) => s + p.pnl_usd, 0);
        const total = t.buy_count + t.sell_count;
        const display = t.trader_name || t.pseudonym || t.wallet.slice(0, 10) + "…";

        return {
          wallet: t.wallet,
          display_name: display,
          trader_name: t.trader_name,
          pseudonym: t.pseudonym,
          vol_24h_usd: t.total_volume_usd,
          trade_count_24h: t.trade_count,
          buy_sell_ratio: total > 0 ? t.buy_count / total : 0.5,
          positions_count: positionViews.length,
          total_position_value: Number(totalValue.toFixed(2)),
          total_position_pnl: Number(totalPnl.toFixed(2)),
          top_positions: positionViews.slice(0, 5),
          last_seen_minutes_ago: t.last_seen_minutes_ago,
          url: `https://polymarket.com/profile/${t.wallet}`,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        traders: enriched.length,
        total_positions: enriched.reduce((s, e) => s + e.positions_count, 0),
        combined_position_value: enriched.reduce((s, e) => s + e.total_position_value, 0),
        combined_24h_vol: enriched.reduce((s, e) => s + e.vol_24h_usd, 0),
      },
      whales: enriched,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
