// /api/xiapan/weather-edges
//
// V0.72 · 百川 W1 Day 5 · 第二品类信号源 · 天气
// NWS + Open-Meteo 双源独立 · 满足 fusion n_active ≥ 2
//
// 扫 Kalshi KXHIGH* / KXLOW* / KXPRECIP* 系列
// 每个 ticker 出 ≤ 2 个独立信号 (NWS / Open-Meteo)

import { NextResponse } from "next/server";
import {
  parseWeatherTicker,
  fairPFromNWS,
  fairPFromOpenMeteo,
  KALSHI_CITY_MAP,
  type KalshiWeatherTicker,
} from "@/lib/xiapan/百川/weather";
import type { Signal } from "@/lib/xiapan/百川/fusion";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiMarket {
  ticker: string;
  event_ticker?: string;
  status?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  volume_24h_fp?: string;
}

interface WeatherEdge {
  ticker: string;
  parsed: KalshiWeatherTicker;
  market_p: number;
  vol_24: number;
  spread_c: number;
  nws: { fair_p: number; forecast: number | null; sigma: number; edge_pp: number } | null;
  meteo: { fair_p: number; forecast: number | null; sigma: number; edge_pp: number } | null;
  signals: Signal[];
}

const SERIES_PREFIXES = ["KXHIGH", "KXLOW", "KXPRECIP"];

async function fetchKalshiSeries(prefix: string): Promise<KalshiMarket[]> {
  // KXHIGH 系列下有多 city · 拉所有 series_ticker 以 KXHIGH 开头的 events
  // Kalshi API 不支持 wildcard · 我们枚举主要城市
  const out: KalshiMarket[] = [];
  await Promise.all(
    Object.keys(KALSHI_CITY_MAP).map(async (city) => {
      const seriesTicker = `${prefix}${city}`;
      try {
        const evR = await fetch(
          `${KALSHI_API}/events?series_ticker=${seriesTicker}&limit=10&status=open`,
          { cache: "no-store", signal: AbortSignal.timeout(6000) }
        );
        if (!evR.ok) return;
        const evD = await evR.json();
        const events = (evD.events ?? []) as Array<{ event_ticker: string }>;
        await Promise.all(
          events.slice(0, 3).map(async (ev) => {
            try {
              const r = await fetch(`${KALSHI_API}/events/${ev.event_ticker}`, {
                cache: "no-store",
                signal: AbortSignal.timeout(5000),
              });
              if (!r.ok) return;
              const d = await r.json();
              for (const m of (d.markets ?? []) as KalshiMarket[]) {
                if (m.status === "active" || m.status === "open") {
                  m.event_ticker = ev.event_ticker;
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

export async function GET() {
  const allMarkets: KalshiMarket[] = (
    await Promise.all(SERIES_PREFIXES.map((p) => fetchKalshiSeries(p)))
  ).flat();

  const edges: WeatherEdge[] = [];

  // 处理每个 ticker · 双源并行
  await Promise.all(
    allMarkets.map(async (m) => {
      const parsed = parseWeatherTicker(m.ticker);
      if (!parsed) return;

      const yes_ask_c = parseFloat(m.yes_ask_dollars || "0") * 100;
      const yes_bid_c = parseFloat(m.yes_bid_dollars || "0") * 100;
      if (yes_ask_c <= 0 || yes_ask_c >= 100) return;
      const market_p = yes_ask_c / 100;
      const vol_24 = parseFloat(m.volume_24h_fp || "0");

      // 太低流动性跳过
      if (vol_24 < 50) return;

      const [nwsRes, meteoRes] = await Promise.all([
        fairPFromNWS(parsed),
        fairPFromOpenMeteo(parsed),
      ]);

      const signals: Signal[] = [];
      const ts = new Date().toISOString();

      let nwsBlock: WeatherEdge["nws"] = null;
      if (nwsRes) {
        const edge_pp = (nwsRes.P_yes - market_p) * 100;
        nwsBlock = {
          fair_p: nwsRes.P_yes,
          forecast: nwsRes.forecast_value,
          sigma: nwsRes.sigma,
          edge_pp,
        };
        if (Math.abs(edge_pp) >= 4 && vol_24 >= 100) {
          signals.push({
            source: "weather-nws",
            ticker: m.ticker,
            direction: edge_pp >= 0 ? 1 : -1,
            predicted_p: nwsRes.P_yes,
            confidence: 0.65,
            reason: `NWS ${parsed.city} ${parsed.type} forecast=${nwsRes.forecast_value?.toFixed(1)} vs ${parsed.threshold} · σ=${nwsRes.sigma.toFixed(1)}`,
            ts,
            data: { ...nwsRes },
          });
        }
      }

      let meteoBlock: WeatherEdge["meteo"] = null;
      if (meteoRes) {
        const edge_pp = (meteoRes.P_yes - market_p) * 100;
        meteoBlock = {
          fair_p: meteoRes.P_yes,
          forecast: meteoRes.forecast_value,
          sigma: meteoRes.sigma,
          edge_pp,
        };
        if (Math.abs(edge_pp) >= 4 && vol_24 >= 100) {
          signals.push({
            source: "weather-meteo",
            ticker: m.ticker,
            direction: edge_pp >= 0 ? 1 : -1,
            predicted_p: meteoRes.P_yes,
            confidence: 0.62,
            reason: `Open-Meteo ${parsed.city} ${parsed.type} forecast=${meteoRes.forecast_value?.toFixed(1)} vs ${parsed.threshold}`,
            ts,
            data: { ...meteoRes },
          });
        }
      }

      edges.push({
        ticker: m.ticker,
        parsed,
        market_p,
        vol_24,
        spread_c: yes_ask_c - yes_bid_c,
        nws: nwsBlock,
        meteo: meteoBlock,
        signals,
      });
    })
  );

  edges.sort((a, b) => {
    const av = Math.max(Math.abs(a.nws?.edge_pp ?? 0), Math.abs(a.meteo?.edge_pp ?? 0));
    const bv = Math.max(Math.abs(b.nws?.edge_pp ?? 0), Math.abs(b.meteo?.edge_pp ?? 0));
    return bv - av;
  });

  const allSignals = edges.flatMap((e) => e.signals);
  const dualConfirm = edges.filter((e) => e.signals.length >= 2).length;

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      total_markets: edges.length,
      total_signals: allSignals.length,
      dual_confirm_tickers: dualConfirm,
      cities_scanned: Object.keys(KALSHI_CITY_MAP).length,
    },
    edges: edges.slice(0, 30),
    signals: allSignals,
  });
}
