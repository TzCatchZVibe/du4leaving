// /api/xiapan/live-trading
//
// 综合实时押注监控 · 一屏 ·
//   - 当前 live 比赛 (ESPN stories)
//   - 每场对应 Kalshi market 全 quote (yes/no bid/ask · vol24 · OI · last · spread)
//   - 用户当前 positions (浮动 PnL · sell 行情)
//
// 用户 directive · "kalshi 上有的信息我这里都要有"
// 用户 directive · "正在比赛监控买卖界面"

import { NextResponse } from "next/server";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 5;        // 5s ISR · 高频刷

interface KalshiMarket {
  ticker: string;
  title?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  previous_yes_bid?: number;
  previous_yes_ask?: number;
  open_interest?: number;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  expected_expiration_time?: string;
  category?: string;
  rules_primary?: string;
}

interface KalshiEvent {
  event_ticker: string;
  series_ticker?: string;
  title?: string;
  category?: string;
  markets?: KalshiMarket[];
}

interface ESPNStory {
  sport: string;
  sportLabel: string;
  team1: string;
  team2: string;
  score1: number | string;
  score2: number | string;
  phase: string;
  story: string;
  rule: string;
  kalshiHint?: string;
  lastUpdate: string;
}

interface TraderPosition {
  ticker: string;
  side: "yes" | "no";
  qty: number;
  exposure: number;
  realized_pnl: number;
  fees: number;
  title?: string;
  current_yes_bid?: number;
  current_yes_ask?: number;
  current_no_bid?: number;
  current_no_ask?: number;
  mark_value?: number;
  unrealized_pnl?: number;
  unrealized_pct?: number;
}

const SPORT_SERIES: Record<string, string[]> = {
  lol: ["KXLOLGAME"],
  nba: ["KXNBAGAME", "KXNBASERIES", "KXNBAGAMESPREAD", "KXNBAGAMETOTAL"],
  mlb: ["KXMLBGAME", "KXMLBSERIES", "KXMLBGAMERUNLINE", "KXMLBGAMETOTAL"],
  nfl: ["KXNFLGAME", "KXNFLSPREAD", "KXNFLTOTAL"],
  nhl: ["KXNHLGAME", "KXNHLSERIES", "KXNHLPUCKLINE"],
  tennis: ["KXATPMATCH", "KXWTAMATCH"],
  soccer: ["KXEPLGAME", "KXUCLGAME"],
};

async function fetchActiveMarketsForSport(sport: string): Promise<KalshiMarket[]> {
  const series = SPORT_SERIES[sport] || [];
  const all: KalshiMarket[] = [];
  for (const s of series) {
    try {
      const r = await fetch(
        `https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=${s}&limit=20&status=open`,
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

async function fetchLiveStories(): Promise<ESPNStory[]> {
  try {
    const r = await fetch("http://localhost:3001/api/xiapan/live", { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.stories || []) as ESPNStory[];
  } catch {
    return [];
  }
}

async function fetchUserPositions(): Promise<TraderPosition[]> {
  try {
    const r = await authedKalshi<{ market_positions?: Array<{
      ticker: string;
      position_fp: string;
      market_exposure_dollars: string;
      realized_pnl_dollars: string;
      fees_paid_dollars: string;
    }> }>("GET", "/portfolio/positions?limit=200");
    return (r.market_positions || [])
      .filter((p) => parseFloat(p.position_fp) !== 0)
      .map((p) => {
        const posFp = parseFloat(p.position_fp);
        const exposure = parseFloat(p.market_exposure_dollars);
        return {
          ticker: p.ticker,
          side: posFp > 0 ? ("yes" as const) : ("no" as const),
          qty: Math.abs(posFp),
          exposure,
          realized_pnl: parseFloat(p.realized_pnl_dollars),
          fees: parseFloat(p.fees_paid_dollars),
        };
      });
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sportFilter = searchParams.get("sport");

  try {
    // 并行拉 stories + positions
    const [stories, positions] = await Promise.all([
      fetchLiveStories(),
      fetchUserPositions(),
    ]);

    // 哪些 sport 有 live 比赛
    const liveSports = new Set(stories.map((s) => s.sport));
    if (sportFilter) liveSports.add(sportFilter);

    // 拉这些 sport 当前 active markets
    const markets: KalshiMarket[] = [];
    for (const sp of liveSports) {
      const m = await fetchActiveMarketsForSport(sp);
      markets.push(...m);
    }

    // 把 positions 也加进 markets · 即使 sport 没在 live (确保用户持仓全显示)
    const positionTickers = new Set(positions.map((p) => p.ticker));
    const marketsTickers = new Set(markets.map((m) => m.ticker));
    for (const p of positions) {
      if (!marketsTickers.has(p.ticker)) {
        // 拉单个 market metadata
        try {
          const r = await fetch(
            `https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(p.ticker)}`,
            { cache: "no-store" }
          );
          if (r.ok) {
            const d = await r.json();
            if (d.market) markets.push(d.market);
          }
        } catch {}
      }
    }

    // 给每个 position 富化 mark-to-market
    const enrichedPositions: TraderPosition[] = positions.map((p) => {
      const m = markets.find((x) => x.ticker === p.ticker);
      if (!m) return p;
      const yesAsk = m.yes_ask ?? 50;
      const yesBid = m.yes_bid ?? 50;
      const noAsk = m.no_ask ?? 50;
      const noBid = m.no_bid ?? 50;
      const sellPrice = p.side === "yes" ? yesBid : noBid;
      const markValue = (sellPrice * p.qty) / 100;
      const unrealizedPnl = markValue - p.exposure;
      const unrealizedPct = p.exposure > 0 ? unrealizedPnl / p.exposure : 0;
      return {
        ...p,
        title: m.title,
        current_yes_bid: yesBid,
        current_yes_ask: yesAsk,
        current_no_bid: noBid,
        current_no_ask: noAsk,
        mark_value: Number(markValue.toFixed(2)),
        unrealized_pnl: Number(unrealizedPnl.toFixed(2)),
        unrealized_pct: Number(unrealizedPct.toFixed(3)),
      };
    });

    const totalUnrealized = enrichedPositions.reduce(
      (s, p) => s + (p.unrealized_pnl ?? 0),
      0
    );

    // 排序 · 持仓的市场置顶 · 然后按 vol24 降序
    const sortedMarkets = markets
      .filter((m) => m.status === "active" || m.status === "open")
      .sort((a, b) => {
        const aHas = positionTickers.has(a.ticker) ? 1 : 0;
        const bHas = positionTickers.has(b.ticker) ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return (b.volume_24h ?? 0) - (a.volume_24h ?? 0);
      })
      .slice(0, 50);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        live_match_count: stories.length,
        position_count: enrichedPositions.length,
        market_count: sortedMarkets.length,
        total_unrealized: Number(totalUnrealized.toFixed(2)),
      },
      stories,
      markets: sortedMarkets,
      positions: enrichedPositions,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
