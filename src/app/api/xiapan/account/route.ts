import { NextResponse } from "next/server";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fp = (s: string | undefined | null) => parseFloat(s || "0");

type Position = {
  ticker: string;
  position_fp: string;
  market_exposure_dollars: string;
  realized_pnl_dollars: string;
  fees_paid_dollars: string;
};

type Fill = {
  ticker: string;
  side: string;
  action: string;
  count_fp: string;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  fee_cost: string;
  created_time: string;
};

export async function GET() {
  try {
    const [bal, pos, ord, fills] = await Promise.all([
      authedKalshi<{ balance?: number; payout?: number }>("GET", "/portfolio/balance"),
      authedKalshi<{ market_positions?: Position[] }>(
        "GET",
        "/portfolio/positions?limit=200"
      ),
      authedKalshi<{ orders?: unknown[] }>("GET", "/portfolio/orders?status=resting"),
      authedKalshi<{ fills?: Fill[] }>("GET", "/portfolio/fills?limit=12"),
    ]);

    const positionsRaw = (pos.market_positions || []).filter(
      (p) => fp(p.position_fp) !== 0
    );

    // 富化 · 拉每个 position 的当前 market 报价 · 算 mark-to-market
    type EnrichedPosition = {
      ticker: string;
      side: "yes" | "no";
      qty: number;
      exposure: number;
      avg_cents: number;
      realized_pnl: number;
      fees: number;
      // 富化字段
      title?: string;
      yes_sub?: string;
      no_sub?: string;
      current_yes_bid?: number;
      current_yes_ask?: number;
      current_no_bid?: number;
      current_no_ask?: number;
      mark_value?: number; // 现在 sell 能拿多少 $
      unrealized_pnl?: number; // 浮动盈亏 $
      unrealized_pct?: number; // 浮动盈亏 %
      starts_at?: string; // expected_expiration_time
      market_status?: string;
    };

    const positions: EnrichedPosition[] = await Promise.all(
      positionsRaw.map(async (p) => {
        const posFp = fp(p.position_fp);
        const exposure = fp(p.market_exposure_dollars);
        const qty = Math.abs(posFp);
        const side: "yes" | "no" = posFp > 0 ? "yes" : "no";
        const avg_cents = qty > 0 ? Math.round((exposure / qty) * 100) : 0;
        const base: EnrichedPosition = {
          ticker: p.ticker,
          side,
          qty,
          exposure,
          avg_cents,
          realized_pnl: fp(p.realized_pnl_dollars),
          fees: fp(p.fees_paid_dollars),
        };
        // 拉 market 详情 (用 unauthenticated · 公开数据)
        try {
          const r = await fetch(
            `https://api.elections.kalshi.com/trade-api/v2/markets/${p.ticker}`,
            { headers: { Accept: "application/json" }, cache: "no-store" }
          );
          if (r.ok) {
            const data = await r.json();
            const m = data.market || {};
            const yesBidC = m.yes_bid_dollars
              ? Math.round(parseFloat(m.yes_bid_dollars) * 100)
              : 0;
            const yesAskC = m.yes_ask_dollars
              ? Math.round(parseFloat(m.yes_ask_dollars) * 100)
              : 0;
            const noBidC = m.no_bid_dollars
              ? Math.round(parseFloat(m.no_bid_dollars) * 100)
              : 0;
            const noAskC = m.no_ask_dollars
              ? Math.round(parseFloat(m.no_ask_dollars) * 100)
              : 0;
            // mark-to-market: 现在能 sell 拿多少
            // long YES → sell @ yes_bid
            // long NO  → sell @ no_bid
            const sellPriceC = side === "yes" ? yesBidC : noBidC;
            const markValue = (sellPriceC * qty) / 100;
            const unrealizedPnl = markValue - exposure;
            const unrealizedPct =
              exposure > 0 ? (unrealizedPnl / exposure) * 100 : 0;
            base.title = m.title;
            base.yes_sub = m.yes_sub_title;
            base.no_sub = m.no_sub_title;
            base.current_yes_bid = yesBidC;
            base.current_yes_ask = yesAskC;
            base.current_no_bid = noBidC;
            base.current_no_ask = noAskC;
            base.mark_value = markValue;
            base.unrealized_pnl = unrealizedPnl;
            base.unrealized_pct = unrealizedPct;
            base.starts_at = m.expected_expiration_time;
            base.market_status = m.status;
          }
        } catch {
          // 静默 fallback
        }
        return base;
      })
    );

    const totalExposure = positions.reduce((s, p) => s + p.exposure, 0);
    const totalPnl = positions.reduce((s, p) => s + p.realized_pnl, 0);
    const totalUnrealized = positions.reduce(
      (s, p) => s + (p.unrealized_pnl ?? 0),
      0
    );
    const totalMarkValue = positions.reduce(
      (s, p) => s + (p.mark_value ?? p.exposure),
      0
    );

    return NextResponse.json({
      ok: true,
      balance: (bal.balance ?? 0) / 100,
      payout: (bal.payout ?? 0) / 100,
      positions,
      totalExposure,
      totalPnl,
      totalUnrealized,
      totalMarkValue,
      restingOrders: (ord.orders || []).length,
      fills: (fills.fills || []).slice(0, 10).map((f) => ({
        ticker: f.ticker,
        side: f.side,
        action: f.action,
        count: fp(f.count_fp),
        price_cents: Math.round(
          (f.side === "yes" ? fp(f.yes_price_dollars) : fp(f.no_price_dollars)) *
            100
        ),
        fee: fp(f.fee_cost),
        ts: f.created_time,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
