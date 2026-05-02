// 百川/polymarket.ts · Polymarket 客户端
// V0.72 W2 · 用 gamma-api · 公开 · 免费
//
// 主要用 ·
//   1. 跨平台套利 (Kalshi vs Polymarket 同事件)
//   2. Polymarket 鲸鱼跟单 (后续 W3)

const POLY_GAMMA = "https://gamma-api.polymarket.com";

export interface PolyMarket {
  id: string;
  question: string;
  conditionId?: string;
  slug?: string;
  endDate?: string;
  active: boolean;
  closed: boolean;
  outcomes?: string[];           // ["Yes", "No"] 通常
  outcomePrices?: string[];      // ["0.65", "0.35"]
  volumeNum?: number;
  liquidityNum?: number;
  category?: string;
}

export interface PolyEvent {
  id: string;
  title: string;
  description?: string;
  slug?: string;
  endDate?: string;
  active: boolean;
  closed: boolean;
  category?: string;
  markets?: PolyMarket[];
}

/// 拉活跃 markets (按 tag / search 等)
export async function fetchPolyMarkets(opts: {
  limit?: number;
  search?: string;          // 关键词 · "BTC" 等
  category?: string;
}): Promise<PolyMarket[]> {
  const params = new URLSearchParams();
  params.set("active", "true");
  params.set("closed", "false");
  params.set("limit", String(opts.limit ?? 100));
  if (opts.category) params.set("category", opts.category);

  try {
    const r = await fetch(`${POLY_GAMMA}/markets?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    let markets = (Array.isArray(d) ? d : d.markets ?? []) as PolyMarket[];

    if (opts.search) {
      const kw = opts.search.toLowerCase();
      markets = markets.filter((m) => m.question?.toLowerCase().includes(kw));
    }
    return markets;
  } catch {
    return [];
  }
}

/// 拿单一 market 的 yes/no price
export function getPolyYesPrice(m: PolyMarket): number | null {
  if (!m.outcomePrices || m.outcomePrices.length < 2) return null;
  // outcomes ["Yes","No"] · outcomePrices ["0.65","0.35"]
  const yesIdx = m.outcomes?.findIndex((o) => o.toLowerCase() === "yes") ?? 0;
  const yesPriceStr = m.outcomePrices[yesIdx];
  const yesPrice = parseFloat(yesPriceStr);
  if (isNaN(yesPrice)) return null;
  return yesPrice;
}

// ───────────────── BTC 跨平台匹配 ─────────────────

export interface KalshiBtcLite {
  ticker: string;
  strike: number;
  expire_at: Date;
  side: "above" | "below";
  market_p: number;
}

/// 给定 Kalshi BTC 市场列表 · 找匹配的 Polymarket markets
/// V0.72 W3 Day 7 · 放宽匹配规则 ·
///   strike ± 2.5%  (Polymarket 用整数 · Kalshi 用精确)
///   到期 ± 3 天    (Polymarket EOD UTC vs Kalshi 17:00)
///   关键词宽松匹配
export async function findPolyBtcMatches(kalshiList: KalshiBtcLite[]): Promise<
  Array<{
    kalshi: KalshiBtcLite;
    poly: PolyMarket;
    poly_yes_p: number;
    diff_pp: number;
  }>
> {
  // 多关键词 · 增加召回
  const [a, b, c] = await Promise.all([
    fetchPolyMarkets({ search: "BTC", limit: 200 }),
    fetchPolyMarkets({ search: "Bitcoin", limit: 200 }),
    fetchPolyMarkets({ search: "$BTC", limit: 100 }),
  ]);
  const polyAll = Array.from(new Map([...a, ...b, ...c].map((p) => [p.id, p])).values());
  if (polyAll.length === 0) return [];

  const matches: Array<{
    kalshi: KalshiBtcLite;
    poly: PolyMarket;
    poly_yes_p: number;
    diff_pp: number;
  }> = [];

  for (const k of kalshiList) {
    const k_strike = k.strike;
    for (const p of polyAll) {
      const q = p.question?.toLowerCase() ?? "";
      if (!q.includes("bitcoin") && !q.includes("btc")) continue;
      // 解析 question 找 strike · 拿所有数字 · 取最接近 k_strike 的
      const numMatches = Array.from(q.matchAll(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)k?\b/g));
      if (numMatches.length === 0) continue;
      let bestPolyStrike = 0;
      let bestDelta = Infinity;
      for (const nm of numMatches) {
        let v = parseFloat(nm[1].replace(/,/g, ""));
        if (nm[0].endsWith("k")) v *= 1000;            // "70k" → 70000
        // 过滤掉年份等明显不是 strike 的数
        if (v < 1000 || v > 1_000_000) continue;
        const delta = Math.abs(v - k_strike);
        if (delta < bestDelta) { bestDelta = delta; bestPolyStrike = v; }
      }
      if (bestPolyStrike === 0) continue;
      if (Math.abs(bestPolyStrike - k_strike) / k_strike > 0.025) continue;     // 放宽到 2.5%

      // 到期匹配 · 放宽 ± 3 天
      if (!p.endDate) continue;
      const polyEnd = new Date(p.endDate);
      const dayDiff = Math.abs(polyEnd.getTime() - k.expire_at.getTime()) / 86400_000;
      if (dayDiff > 3) continue;

      const polyYesP = getPolyYesPrice(p);
      if (polyYesP === null) continue;
      const polyAbove = q.includes("reach") || q.includes("above") || q.includes("hit") || q.includes("exceed") || q.includes(">=") || q.includes("over");
      let polyP = polyYesP;
      if (k.side === "below" && polyAbove) polyP = 1 - polyP;
      else if (k.side === "above" && !polyAbove) polyP = 1 - polyP;

      matches.push({
        kalshi: k,
        poly: p,
        poly_yes_p: polyP,
        diff_pp: (polyP - k.market_p) * 100,
      });
    }
  }

  return matches;
}
