// /api/xiapan/paper-trade
// V0.67 [A] 模拟挂单 endpoint
//
// GET                    · 拉历史 + 统计
// GET ?action=tick       · 跑一遍 mark-to-market · 平止盈/止损/时限 (cron 调)
// POST                   · 老虎自动 / 用户手动 record 新单

import { NextResponse } from "next/server";
import {
  recordTrade,
  readAllTrades,
  tickAllOpenTrades,
  canPlaceTrade,
  summary,
  PAPER_BANKROLL, PAPER_PER_TRADE, PAPER_DAILY_LIMIT, PAPER_MIN_SCORE,
  type PaperTrade,
} from "@/lib/xiapan/paper-trade";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const days = Math.min(30, parseInt(url.searchParams.get("days") ?? "7", 10));

  // cron / 手动触发 mark-to-market
  if (action === "tick") {
    const isCron = url.searchParams.get("cron") === "1";
    if (isCron) {
      const expected = process.env.CRON_SECRET;
      if (expected) {
        const got = req.headers.get("authorization") ?? "";
        if (got !== `Bearer ${expected}`) {
          return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
      }
    }
    const closed = await tickAllOpenTrades();
    return NextResponse.json({
      ok: true,
      ticked_at: new Date().toISOString(),
      closed_count: closed.length,
      closed,
    });
  }

  return NextResponse.json({
    ok: true,
    config: {
      bankroll: PAPER_BANKROLL,
      per_trade_max: PAPER_PER_TRADE,
      daily_limit: PAPER_DAILY_LIMIT,
      min_score: PAPER_MIN_SCORE,
    },
    summary: summary(days),
    trades: readAllTrades(days),
  });
}

export async function POST(req: Request) {
  let body: Partial<PaperTrade>;
  try { body = (await req.json()) as Partial<PaperTrade>; }
  catch { return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 }); }

  const ticker = body.ticker;
  const side = body.side;
  const qty = body.qty;
  const entry = body.entry_price_c;
  const cost = body.cost_dollars;

  if (!ticker || !side || !qty || !entry || !cost) {
    return NextResponse.json({ ok: false, error: "ticker/side/qty/entry_price_c/cost_dollars required" }, { status: 400 });
  }

  const gate = canPlaceTrade(cost);
  if (!gate.allowed) {
    return NextResponse.json({ ok: false, blocked_by_risk: true, reason: gate.reason }, { status: 200 });
  }

  const trade: PaperTrade = {
    id: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ticker,
    title: body.title ?? ticker,
    side,
    entry_price_c: entry,
    qty,
    cost_dollars: cost,
    opened_at: new Date().toISOString(),
    source: body.source ?? "manual",
    picks_score: body.picks_score,
    reasons: body.reasons,
  };

  recordTrade(trade);

  return NextResponse.json({
    ok: true,
    trade,
    summary: summary(7),
  });
}
