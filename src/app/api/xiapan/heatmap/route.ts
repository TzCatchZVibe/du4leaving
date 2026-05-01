// /api/xiapan/heatmap
//
// 团购热力图 · 实时 Kalshi 资金流 · 谁在压啥 · 跟还是反
//
// 拉 · /events?status=open · 按 sport 分组 · 提取 vol_24h + last_price + yes/no flow 比例
// 算 · sentiment_yes (yes 价 / 100) · 大众压 yes 比例
// 输出 · 按 sport 分组 · top 20 hot markets

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 60;

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

type KMarket = {
  ticker: string;
  title?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  last_price?: number;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  expected_expiration_time?: string;
  status?: string;
};

type KEvent = {
  event_ticker: string;
  series_ticker?: string;
  title?: string;
  category?: string;
  markets?: KMarket[];
};

const SERIES_BY_SPORT: Record<string, { label: string; tickers: string[] }> = {
  lol:    { label: "LOL",    tickers: ["KXLOLGAME"] },
  nba:    { label: "NBA",    tickers: ["KXNBAGAME"] },
  mlb:    { label: "MLB",    tickers: ["KXMLBGAME"] },
  nfl:    { label: "NFL",    tickers: ["KXNFLGAME"] },
  nhl:    { label: "NHL",    tickers: ["KXNHLGAME"] },
  tennis: { label: "Tennis", tickers: ["KXATPMATCH", "KXWTAMATCH"] },
  soccer: { label: "Soccer", tickers: ["KXEPLGAME", "KXUCLGAME"] },
};

async function fetchSeries(seriesTicker: string): Promise<KEvent[]> {
  try {
    const r = await fetch(
      `${KALSHI}/events?series_ticker=${seriesTicker}&limit=50&status=open`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return d.events || [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sportParam = searchParams.get("sport");

  try {
    const sportsToScan = sportParam
      ? [sportParam]
      : Object.keys(SERIES_BY_SPORT);

    type HotMarket = {
      sport: string;
      sportLabel: string;
      ticker: string;
      title: string;
      yesSub: string;
      noSub: string;
      lastPrice: number;
      yesAsk: number;
      noAsk: number;
      volume24h: number;
      volumeTotal: number;
      openInterest: number;
      sentimentYes: number;       // 0-1 · 大众押 yes 比例
      heat: number;                // 综合热度 score
      expiresAt: string | null;
    };

    const hotMarkets: HotMarket[] = [];

    for (const sport of sportsToScan) {
      const conf = SERIES_BY_SPORT[sport];
      if (!conf) continue;
      const allEvents = (await Promise.all(conf.tickers.map(fetchSeries))).flat();
      for (const ev of allEvents) {
        for (const m of ev.markets || []) {
          if (m.status !== "active" && m.status !== "open") continue;
          const lastPrice = m.last_price ?? 50;
          const sentimentYes = lastPrice / 100;
          const v24 = m.volume_24h ?? 0;
          const oi = m.open_interest ?? 0;
          const heat = v24 + oi * 0.3;
          hotMarkets.push({
            sport,
            sportLabel: conf.label,
            ticker: m.ticker,
            title: ev.title || m.title || m.ticker,
            yesSub: m.yes_sub_title || "",
            noSub: m.no_sub_title || "",
            lastPrice,
            yesAsk: m.yes_ask ?? 50,
            noAsk: m.no_ask ?? 50,
            volume24h: v24,
            volumeTotal: m.volume ?? 0,
            openInterest: oi,
            sentimentYes,
            heat,
            expiresAt: m.expected_expiration_time || null,
          });
        }
      }
    }

    // 按 heat 排
    hotMarkets.sort((a, b) => b.heat - a.heat);
    const top = hotMarkets.slice(0, 30);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      count: top.length,
      markets: top,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
