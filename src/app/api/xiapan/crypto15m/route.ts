// 虾盘 · 全 crypto 15M · 实时 · 故事性人话
// 9 种币: BTC ETH SOL DOGE BNB ADA XRP BCH HYPE

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3;

type Crypto = {
  key: string;
  ticker: string;
  spotSym: string; // Coinbase pair
  label: string;
  name: string;
  emoji: string;
};

const CRYPTOS: Crypto[] = [
  { key: "btc", ticker: "KXBTC15M", spotSym: "BTC-USD", label: "BTC", name: "Bitcoin · 比特币", emoji: "₿" },
  { key: "eth", ticker: "KXETH15M", spotSym: "ETH-USD", label: "ETH", name: "Ethereum · 以太坊", emoji: "Ξ" },
  { key: "sol", ticker: "KXSOL15M", spotSym: "SOL-USD", label: "SOL", name: "Solana", emoji: "◎" },
  { key: "doge", ticker: "KXDOGE15M", spotSym: "DOGE-USD", label: "DOGE", name: "Dogecoin · 狗狗币", emoji: "Ð" },
  { key: "bnb", ticker: "KXBNB15M", spotSym: "BNB-USD", label: "BNB", name: "Binance Coin", emoji: "B" },
  { key: "ada", ticker: "KXADA15M", spotSym: "ADA-USD", label: "ADA", name: "Cardano", emoji: "₳" },
  { key: "xrp", ticker: "KXXRP15M", spotSym: "XRP-USD", label: "XRP", name: "Ripple", emoji: "✕" },
  { key: "bch", ticker: "KXBCH15M", spotSym: "BCH-USD", label: "BCH", name: "Bitcoin Cash", emoji: "Ƀ" },
  { key: "hype", ticker: "KXHYPE15M", spotSym: "HYPE-USD", label: "HYPE", name: "Hype", emoji: "H" },
];

async function fetchSpot(sym: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.coinbase.com/v2/prices/${sym}/spot`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    const d = await r.json();
    return parseFloat(d?.data?.amount || "0") || null;
  } catch {
    return null;
  }
}

async function fetchKalshiEvent(seriesTicker: string) {
  try {
    const r = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=${seriesTicker}&limit=10&status=open`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const events = d.events || [];
    if (events.length === 0) return null;
    events.sort((a: { event_ticker: string }, b: { event_ticker: string }) =>
      a.event_ticker.localeCompare(b.event_ticker)
    );
    const ev = events[events.length - 1];
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
      title: ev.title || "",
      subTitle: ev.sub_title || "",
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
    };
  } catch {
    return null;
  }
}

function extractTarget(title: string): number | null {
  const m = title.match(/\$([\d,.]+)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

function makeStory(opts: {
  spot: number | null;
  target: number | null;
  yesAsk: number;
  minutesLeft: number;
  emoji: string;
  label: string;
  name: string;
}): { story: string; advice: string; suggested: "yes" | "no" | "skip" } {
  const { spot, target, yesAsk, minutesLeft, emoji, label, name } = opts;
  if (!spot || !target)
    return {
      story: `${emoji} ${name} · 数据加载中`,
      advice: "等行情",
      suggested: "skip",
    };
  const distance = target - spot;
  const distancePct = (distance / spot) * 100;
  const sigmaPctPerMin = 0.07; // crypto 1 min ~ 0.07%
  const totalSigma =
    sigmaPctPerMin * Math.sqrt(Math.max(1, minutesLeft));
  const z = distancePct / totalSigma;
  const ourP = approxNormCdf(-z);
  const yesImpliedP = yesAsk / 100;
  const edge = ourP - yesImpliedP;

  let story = "";
  if (Math.abs(distancePct) < 0.05) {
    story = `${emoji} ${label} 卡在 target 旁边 · 抖一下就翻盘 · 高方差时刻`;
  } else if (distance > 0) {
    story = `${emoji} ${label} 比 target 低 ${Math.abs(distance).toFixed(2)} · 还剩 ${minutesLeft}min 要冲上去`;
  } else {
    story = `${emoji} ${label} 已经超过 target ${Math.abs(distance).toFixed(2)} · 守住就 yes 赢`;
  }

  let suggested: "yes" | "no" | "skip" = "skip";
  let advice = "市场定价合理 · 看着玩";
  if (edge > 0.07) {
    suggested = "yes";
    advice = `押 YES 便宜 · 模型说有 ${(ourP * 100).toFixed(0)}% 概率突破 · 市场只给 ${yesAsk}%`;
  } else if (edge < -0.07) {
    suggested = "no";
    advice = `押 NO 便宜 · 模型说仅 ${(ourP * 100).toFixed(0)}% 突破 · 市场高估 yes`;
  } else if (Math.abs(edge) < 0.04) {
    suggested = "skip";
    advice = `市场定价基本对 · 没明显便宜 · 跳过`;
  }
  return { story, advice, suggested };
}

function approxNormCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

export async function GET() {
  const out = await Promise.all(
    CRYPTOS.map(async (c) => {
      const [spot, ev] = await Promise.all([
        fetchSpot(c.spotSym),
        fetchKalshiEvent(c.ticker),
      ]);
      if (!ev) {
        return {
          ...c,
          spot,
          available: false,
          reason: "Kalshi 这 15min 没开盘 · 等下一档",
        };
      }
      const minutesLeft = ev.expected_expiration_time
        ? Math.max(
            0,
            Math.round(
              (new Date(ev.expected_expiration_time).getTime() - Date.now()) /
                60000
            )
          )
        : 15;
      const { story, advice, suggested } = makeStory({
        spot,
        target: ev.target,
        yesAsk: ev.yes_ask,
        minutesLeft,
        emoji: c.emoji,
        label: c.label,
        name: c.name,
      });
      const distance =
        spot && ev.target ? ev.target - spot : null;
      return {
        ...c,
        spot,
        available: true,
        target: ev.target,
        ticker: ev.ticker,
        yes_ask: ev.yes_ask,
        yes_bid: ev.yes_bid,
        no_ask: ev.no_ask,
        no_bid: ev.no_bid,
        last_price: ev.last_price,
        volume: ev.volume,
        volume_24h: ev.volume_24h,
        open_interest: ev.open_interest,
        minutesLeft,
        distance,
        distancePct: spot ? ((distance ?? 0) / spot) * 100 : null,
        story,
        advice,
        suggested,
      };
    })
  );
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    cryptos: out,
  });
}
