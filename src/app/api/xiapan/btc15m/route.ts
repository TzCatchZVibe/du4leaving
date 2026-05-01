// 虾盘 · BTC 15min Kalshi + Coinbase 实时
// 拉 KXBTC15M 当前 event + Coinbase 现货 + 距 target 距离 · 给决策建议

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 2; // 2s ISR

async function fetchKalshiBtc15m() {
  try {
    const r = await fetch(
      "https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXBTC15M&limit=10&status=open",
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const events = d.events || [];
    if (events.length === 0) return null;
    // 取最近的 (event_ticker 含日期+时间)
    events.sort((a: { event_ticker: string }, b: { event_ticker: string }) =>
      a.event_ticker.localeCompare(b.event_ticker)
    );
    const ev = events[events.length - 1];
    // 拉详情
    const detailR = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/events/${ev.event_ticker}`,
      { cache: "no-store" }
    );
    if (!detailR.ok) return null;
    const detail = await detailR.json();
    const m = (detail.markets || []).find(
      (mm: { status?: string }) => mm.status === "active"
    );
    if (!m) return null;
    const fp = (s: string) => parseFloat(s || "0");
    const dolToC = (s: string) => Math.round(fp(s) * 100);
    return {
      eventTicker: ev.event_ticker,
      title: ev.title,
      subTitle: ev.sub_title,
      target: extractTarget(ev.title || ""),
      ticker: m.ticker,
      yes_bid: dolToC(m.yes_bid_dollars),
      yes_ask: dolToC(m.yes_ask_dollars),
      no_bid: dolToC(m.no_bid_dollars),
      no_ask: dolToC(m.no_ask_dollars),
      last_price: dolToC(m.last_price_dollars),
      volume: fp(m.volume_fp),
      volume_24h: fp(m.volume_24h_fp),
      open_interest: fp(m.open_interest_fp),
      expected_expiration_time: m.expected_expiration_time,
      open_time: m.open_time,
      yes_sub: m.yes_sub_title,
      no_sub: m.no_sub_title,
    };
  } catch {
    return null;
  }
}

function extractTarget(title: string): number | null {
  // 从 "BTC 15 min · $77,061.36 target" 解析
  const m = title.match(/\$([\d,.]+)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

async function fetchBtcSpot(): Promise<{
  usd: number | null;
  source: string;
} | null> {
  // Coinbase 公开 spot (无 key · 实时)
  try {
    const r = await fetch(
      "https://api.coinbase.com/v2/prices/BTC-USD/spot",
      { cache: "no-store" }
    );
    if (r.ok) {
      const d = await r.json();
      return { usd: parseFloat(d?.data?.amount || "0"), source: "coinbase" };
    }
  } catch {}
  // Backup · CoinGecko
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { cache: "no-store" }
    );
    if (r.ok) {
      const d = await r.json();
      return { usd: d?.bitcoin?.usd || null, source: "coingecko" };
    }
  } catch {}
  return null;
}

export async function GET() {
  const [kalshi, spot] = await Promise.all([
    fetchKalshiBtc15m(),
    fetchBtcSpot(),
  ]);
  if (!kalshi) {
    return NextResponse.json(
      { ok: false, error: "no active KXBTC15M event" },
      { status: 200 }
    );
  }
  const target = kalshi.target;
  const price = spot?.usd || null;
  let analysis: {
    direction: "above" | "below" | null;
    distance: number | null;
    distancePct: number | null;
    minutesLeft: number | null;
    yesImpliedP: number | null;
    suggestedSide: "yes" | "no" | "skip";
    confidence: string;
    story: string;
  } = {
    direction: null,
    distance: null,
    distancePct: null,
    minutesLeft: null,
    yesImpliedP: null,
    suggestedSide: "skip",
    confidence: "loading",
    story: "",
  };
  if (price && target) {
    const distance = target - price;
    const distancePct = (distance / price) * 100;
    const direction: "above" | "below" =
      distance >= 0 ? "above" : "below";
    let minutesLeft: number | null = null;
    if (kalshi.expected_expiration_time) {
      minutesLeft = Math.max(
        0,
        Math.round(
          (new Date(kalshi.expected_expiration_time).getTime() - Date.now()) /
            60000
        )
      );
    }
    const yesImpliedP = kalshi.yes_ask / 100;
    // 简易模型 · 基于距离 + 剩余分钟
    // BTC 1min 标准差约 0.05% · 15min ~ 0.2%
    const sigmaPctPerMin = 0.05;
    const totalSigmaPct =
      sigmaPctPerMin * Math.sqrt(Math.max(1, minutesLeft || 15));
    // P(price >= target) = 1 - Φ(distancePct / totalSigmaPct)
    // 简易近似 · 距离/sigma 越大越难突破
    const z = distancePct / totalSigmaPct;
    const ourP = approxNormCdf(-z); // P(target hit)
    const edge = ourP - yesImpliedP;
    let suggestedSide: "yes" | "no" | "skip" = "skip";
    let confidence = "中等";
    if (edge > 0.05) {
      suggestedSide = "yes";
      confidence = "yes 押便宜了 (+5pp 以上)";
    } else if (edge < -0.05) {
      suggestedSide = "no";
      confidence = "no 押便宜了 (target 难达 +5pp)";
    } else {
      suggestedSide = "skip";
      confidence = `市场基本定价合理 (边缘 ${(edge * 100).toFixed(1)}pp)`;
    }
    let story = "";
    if (Math.abs(distancePct) < 0.02) {
      story = `BTC 卡在 target 旁边 · 任何风吹草动决定胜负 · 高方差时刻`;
    } else if (direction === "above") {
      story = `BTC 比 target 低 $${(-distance).toFixed(2)} · 还剩 ${minutesLeft}min 要冲上 target`;
    } else {
      story = `BTC 已经超过 target · 还剩 ${minutesLeft}min 守住就 yes 赢`;
    }
    analysis = {
      direction,
      distance,
      distancePct,
      minutesLeft,
      yesImpliedP,
      suggestedSide,
      confidence,
      story,
    };
  }
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    kalshi,
    spot,
    analysis,
  });
}

// 标准正态 CDF 近似 (Abramowitz)
function approxNormCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}
