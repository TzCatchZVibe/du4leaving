// /api/xiapan/history
//
// 拉用户全 Kalshi 历史 · 分页 · fills + settlements + orders 全捞
// 用户要求 · "我需要看到我过去的所有投注记录和细节信息"
//
// 后端做 ·
// 1. paginate /portfolio/fills · 一直翻到没 cursor
// 2. paginate /portfolio/settlements · 拉所有已结算
// 3. paginate /portfolio/orders · 拉所有订单 (含已撤)
// 4. 富化 · 每个 fill 加 title (查 market 名)
// 5. 汇总 · 总成交金额 / 总抽水 / 总盈亏 / 单数

import { NextResponse } from "next/server";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 60; // 1 min ISR · 历史变化不快

const fp = (s: string | undefined | null) => parseFloat(s || "0");

type Fill = {
  trade_id?: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count_fp: string;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  fee_cost?: string;
  taker_fee_cost?: string;
  fee_dollars?: string;
  created_time: string;
  is_taker?: boolean;
};

type Settlement = {
  ticker: string;
  market_result?: "yes" | "no" | "void";
  yes_count_fp?: string;
  no_count_fp?: string;
  yes_total_cost?: string;
  no_total_cost?: string;
  realized_pnl?: string;
  revenue?: string;
  settled_time: string;
};

type Order = {
  order_id: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  status: string;
  count_fp?: string;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  created_time: string;
  closed_time?: string;
};

async function paginate<T>(
  endpointBuilder: (cursor?: string) => string,
  pickKey: string,
  hardLimit = 5000
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 50 && out.length < hardLimit; i++) {
    const path = endpointBuilder(cursor);
    const resp = await authedKalshi<Record<string, unknown>>("GET", path);
    const arr = (resp[pickKey] as T[]) || [];
    out.push(...arr);
    cursor = resp.cursor as string | undefined;
    if (!cursor || arr.length === 0) break;
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sinceParam = searchParams.get("since");                // ISO date
  const untilParam = searchParams.get("until");
  const sportFilter = searchParams.get("sport");                // 例 lol/nba/...
  const cap = parseInt(searchParams.get("limit") || "5000");

  try {
    const [fills, settlements, orders] = await Promise.all([
      paginate<Fill>(
        (cursor) => `/portfolio/fills?limit=200${cursor ? `&cursor=${cursor}` : ""}`,
        "fills",
        cap
      ),
      paginate<Settlement>(
        (cursor) => `/portfolio/settlements?limit=200${cursor ? `&cursor=${cursor}` : ""}`,
        "settlements",
        cap
      ),
      paginate<Order>(
        (cursor) => `/portfolio/orders?limit=200${cursor ? `&cursor=${cursor}` : ""}`,
        "orders",
        cap
      ),
    ]);

    // 时间筛选
    const sinceMs = sinceParam ? new Date(sinceParam).getTime() : 0;
    const untilMs = untilParam ? new Date(untilParam).getTime() : Date.now();

    const inWindow = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= sinceMs && t <= untilMs;
    };

    // 过滤 fills · sport 推断 (从 ticker prefix)
    const sportOf = (ticker: string): string => {
      const t = ticker.toUpperCase();
      if (t.includes("LOL")) return "lol";
      if (t.includes("NBA")) return "nba";
      if (t.includes("MLB")) return "mlb";
      if (t.includes("NFL")) return "nfl";
      if (t.includes("NHL")) return "nhl";
      if (t.includes("ITF") || t.includes("ATP") || t.includes("WTA")) return "tennis";
      if (t.includes("EPL") || t.includes("UCL") || t.includes("MLS")) return "soccer";
      if (t.includes("BTC") || t.includes("ETH") || t.includes("SOL")) return "crypto";
      if (t.includes("CS")) return "cs";
      if (t.includes("VAL")) return "valorant";
      return "other";
    };

    const filteredFills = fills.filter((f) => {
      if (!inWindow(f.created_time)) return false;
      if (sportFilter && sportOf(f.ticker) !== sportFilter) return false;
      return true;
    });

    const filteredSettlements = settlements.filter((s) => {
      if (!inWindow(s.settled_time)) return false;
      if (sportFilter && sportOf(s.ticker) !== sportFilter) return false;
      return true;
    });

    const filteredOrders = orders.filter((o) => {
      if (!inWindow(o.created_time)) return false;
      if (sportFilter && sportOf(o.ticker) !== sportFilter) return false;
      return true;
    });

    // 汇总
    const totalFee = fills.reduce(
      (s, f) => s + fp(f.fee_cost || f.taker_fee_cost || f.fee_dollars),
      0
    );
    const totalVolume = fills.reduce((s, f) => {
      const price = fp(f.yes_price_dollars || f.no_price_dollars);
      const count = fp(f.count_fp);
      return s + price * count;
    }, 0);
    const totalRealizedPnl = settlements.reduce(
      (s, x) => s + fp(x.realized_pnl),
      0
    );

    // 按 ticker 聚合 · 每个 ticker 一段总结 (entry / exit / pnl)
    type TickerSummary = {
      ticker: string;
      sport: string;
      sportLabel: string;
      fills: Fill[];
      settlement?: Settlement;
      pnl: number;
      fee: number;
      first_ts: string;
      last_ts: string;
    };

    const tickerMap = new Map<string, TickerSummary>();
    for (const f of filteredFills) {
      const key = f.ticker;
      let row = tickerMap.get(key);
      const sp = sportOf(key);
      if (!row) {
        row = {
          ticker: key,
          sport: sp,
          sportLabel: sp.toUpperCase(),
          fills: [],
          pnl: 0,
          fee: 0,
          first_ts: f.created_time,
          last_ts: f.created_time,
        };
        tickerMap.set(key, row);
      }
      row.fills.push(f);
      row.fee += fp(f.fee_cost || f.taker_fee_cost || f.fee_dollars);
      if (f.created_time < row.first_ts) row.first_ts = f.created_time;
      if (f.created_time > row.last_ts) row.last_ts = f.created_time;
    }
    for (const s of filteredSettlements) {
      const row = tickerMap.get(s.ticker);
      if (row) {
        row.settlement = s;
        row.pnl = fp(s.realized_pnl);
      }
    }

    const tickerSummaries = Array.from(tickerMap.values()).sort(
      (a, b) => (b.last_ts > a.last_ts ? 1 : -1)
    );

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        totalFillsCount: fills.length,
        totalOrdersCount: orders.length,
        totalSettlementsCount: settlements.length,
        totalVolume,                 // $ 总成交
        totalFee,                    // $ 总抽水
        totalRealizedPnl,            // $ 总已结算盈亏
        netRoi:
          totalVolume > 0
            ? (totalRealizedPnl - totalFee) / totalVolume
            : 0,
      },
      filteredCount: {
        fills: filteredFills.length,
        settlements: filteredSettlements.length,
        orders: filteredOrders.length,
        tickers: tickerSummaries.length,
      },
      fills: filteredFills,
      settlements: filteredSettlements,
      orders: filteredOrders,
      tickers: tickerSummaries,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
