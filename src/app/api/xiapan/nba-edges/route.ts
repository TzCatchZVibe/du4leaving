// /api/xiapan/nba-edges
// V0.72 W3 Day 3 · NBA Elo 信号源 · 体育品类 (S 桶)

import { NextResponse } from "next/server";
import { expectedScoreNBA, normalizeTeam, loadElo, refreshFrom538 } from "@/lib/xiapan/百川/nba-elo";
import type { Signal } from "@/lib/xiapan/百川/fusion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  volume_24h_fp?: string;
  expected_expiration_time?: string;
}

interface NbaEdge {
  ticker: string;
  event_ticker?: string;
  team_home?: string;
  team_away?: string;
  yes_team?: string;
  market_p: number;
  fair_p: number;
  edge_pp: number;
  vol_24: number;
  spread_c: number;
  signal: Signal | null;
}

async function fetchKalshiNbaEvents(): Promise<KalshiMarket[]> {
  const out: KalshiMarket[] = [];
  // KXNBA 系列 · 主胜负在 KXNBASERIES / KXNBAGAME 等 · 拉 NBA 类
  const seriesList = ["KXNBASERIES", "KXNBAGAME"];
  await Promise.all(
    seriesList.map(async (s) => {
      try {
        const r = await fetch(
          `${KALSHI_API}/events?series_ticker=${s}&limit=20&status=open`,
          { cache: "no-store", signal: AbortSignal.timeout(8000) }
        );
        if (!r.ok) return;
        const d = await r.json();
        const events = (d.events ?? []) as Array<{ event_ticker: string; title?: string; sub_title?: string }>;
        await Promise.all(
          events.slice(0, 8).map(async (ev) => {
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
      } catch {}
    })
  );
  return out;
}

/// 从 ticker / title 提取主队 + 客队
function parseTeams(m: KalshiMarket): { home: string | null; away: string | null; yes_team: string | null } {
  // 例 · ticker = KXNBASERIES-26MAY02-LAL-DEN  (主队后写 · Kalshi 通常)
  const parts = m.ticker.split("-");
  // 找 2 个三字母连续
  let home: string | null = null;
  let away: string | null = null;
  for (let i = 0; i < parts.length - 1; i++) {
    const a = parts[i].toUpperCase();
    const b = parts[i + 1].toUpperCase();
    if (a.length === 3 && b.length === 3 && /^[A-Z]{3}$/.test(a) && /^[A-Z]{3}$/.test(b)) {
      // 用 alias 验证
      const na = normalizeTeam(a);
      const nb = normalizeTeam(b);
      if (na && nb) {
        away = na;        // Kalshi 通常前为客 · 后为主
        home = nb;
        break;
      }
    }
  }
  // yes 选 · 看 yes_sub_title
  let yes_team: string | null = null;
  if (m.yes_sub_title) {
    const norm = normalizeTeam(m.yes_sub_title);
    if (norm) yes_team = norm;
  }
  return { home, away, yes_team };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  if (refresh) {
    const r = await refreshFrom538();
    if (!r.ok) console.error("538 refresh failed:", r.error);
  }

  const { ratings, source, ts } = loadElo();
  if (Object.keys(ratings).length === 0) {
    return NextResponse.json({ ok: false, error: "no Elo data" });
  }

  const markets = await fetchKalshiNbaEvents();
  const edges: NbaEdge[] = [];
  const signals: Signal[] = [];

  for (const m of markets) {
    const { home, away, yes_team } = parseTeams(m);
    if (!home || !away || !yes_team) continue;
    const fair_home = expectedScoreNBA(home, away);
    if (fair_home === null) continue;
    const fair_p = yes_team === home ? fair_home : 1 - fair_home;

    const yes_ask_c = parseFloat(m.yes_ask_dollars || "0") * 100;
    const yes_bid_c = parseFloat(m.yes_bid_dollars || "0") * 100;
    if (yes_ask_c <= 0 || yes_ask_c >= 100) continue;
    const market_p = yes_ask_c / 100;
    const edge_pp = (fair_p - market_p) * 100;
    const vol_24 = parseFloat(m.volume_24h_fp || "0");
    const spread_c = yes_ask_c - yes_bid_c;

    let signal: Signal | null = null;
    if (Math.abs(edge_pp) >= 4 && vol_24 >= 200) {
      const direction: 1 | -1 = edge_pp >= 0 ? 1 : -1;
      signal = {
        source: "nba-elo",
        ticker: m.ticker,
        direction,
        predicted_p: fair_p,
        confidence: 0.56,           // NBA Elo 历史准 · 比 esports 高
        reason: `${away}@${home} · Elo ${Math.round(ratings[home])} vs ${Math.round(ratings[away])} · 公允 ${(fair_p * 100).toFixed(0)}% vs 市场 ${(market_p * 100).toFixed(0)}%`,
        ts: new Date().toISOString(),
        data: { home, away, yes_team, elo_home: ratings[home], elo_away: ratings[away] },
      };
      signals.push(signal);
    }

    edges.push({
      ticker: m.ticker,
      event_ticker: m.event_ticker,
      team_home: home,
      team_away: away,
      yes_team,
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
      elo_source: source,
      elo_ts: ts,
      total_teams: Object.keys(ratings).length,
      total_markets: edges.length,
      signals: signals.length,
    },
    edges: edges.slice(0, 30),
    signals,
  });
}
