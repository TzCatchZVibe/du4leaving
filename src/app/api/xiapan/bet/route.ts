import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: {
    ticker?: string;
    side?: "yes" | "no";
    count?: number;
    price?: number;
    action?: "buy" | "sell";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { ticker, side, count, price, action: rawAction } = body;
  const action: "buy" | "sell" = rawAction === "sell" ? "sell" : "buy";
  if (!ticker || !side || !count) {
    return NextResponse.json(
      { ok: false, error: "需要 ticker / side / count" },
      { status: 400 }
    );
  }
  if (!["yes", "no"].includes(side)) {
    return NextResponse.json(
      { ok: false, error: "side 必须 yes/no" },
      { status: 400 }
    );
  }
  if (count <= 0 || count > 10000) {
    return NextResponse.json({ ok: false, error: "count 不合法" }, { status: 400 });
  }

  // 拉当前价确定 limit
  // buy → 用 ask 吃单
  // sell → 用 bid 卖出
  let actualPrice = price;
  if (actualPrice == null) {
    try {
      const m = await authedKalshi<{
        market: {
          yes_ask_dollars?: string;
          yes_bid_dollars?: string;
          no_ask_dollars?: string;
          no_bid_dollars?: string;
        };
      }>("GET", `/markets/${ticker}`);
      let priceDollars: string | undefined;
      if (action === "buy") {
        priceDollars = side === "yes" ? m.market.yes_ask_dollars : m.market.no_ask_dollars;
      } else {
        priceDollars = side === "yes" ? m.market.yes_bid_dollars : m.market.no_bid_dollars;
      }
      if (!priceDollars) {
        return NextResponse.json(
          { ok: false, error: "无报价" },
          { status: 400 }
        );
      }
      actualPrice = Math.round(parseFloat(priceDollars) * 100);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      );
    }
  }
  if (actualPrice == null || actualPrice < 1 || actualPrice > 99) {
    return NextResponse.json(
      { ok: false, error: `price ${actualPrice} 不合法` },
      { status: 400 }
    );
  }

  const order: Record<string, unknown> = {
    ticker,
    client_order_id: crypto.randomUUID(),
    side,
    action,
    type: "limit",
    count,
  };
  if (side === "yes") order.yes_price = actualPrice;
  else order.no_price = actualPrice;

  try {
    const res = await authedKalshi<{ order?: Record<string, unknown> }>(
      "POST",
      "/portfolio/orders",
      order
    );
    return NextResponse.json({
      ok: true,
      ticker,
      side,
      count,
      price: actualPrice,
      cost_dollars: (actualPrice * count) / 100,
      order: res.order,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
