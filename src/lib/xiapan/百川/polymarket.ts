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
/// 匹配规则 ·
///   · 都含 "BTC" / "bitcoin"
///   · 行权价 ± 1% · 到期 ± 1 天
export async function findPolyBtcMatches(kalshiList: KalshiBtcLite[]): Promise<
  Array<{
    kalshi: KalshiBtcLite;
    poly: PolyMarket;
    poly_yes_p: number;
    diff_pp: number;             // poly_p - kalshi_p · 正 = Polymarket 押 yes 更贵
  }>
> {
  const polyAll = await fetchPolyMarkets({ search: "BTC", limit: 200 });
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
      // 解析 question 找 strike (e.g. "Bitcoin reach $70,000 by Dec 31?")
      const strikeMatch = q.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
      if (!strikeMatch) continue;
      const polyStrike = parseFloat(strikeMatch[1].replace(/,/g, ""));
      if (Math.abs(polyStrike - k_strike) / k_strike > 0.01) continue;

      // 到期匹配 · ± 1 天
      if (!p.endDate) continue;
      const polyEnd = new Date(p.endDate);
      const dayDiff = Math.abs(polyEnd.getTime() - k.expire_at.getTime()) / 86400_000;
      if (dayDiff > 1) continue;

      const polyYesP = getPolyYesPrice(p);
      if (polyYesP === null) continue;
      // 方向 · "above $X" 跟 Kalshi side 对齐
      const polyAbove = q.includes("reach") || q.includes("above") || q.includes("hit");
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
