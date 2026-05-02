// /api/xiapan/baichuan/settle
//
// V0.72 · 拉 Kalshi 已结算市场 · update lessons.jsonl · 把 PnL 写回 pools
// 每天 03:00 cron 跑一次

import { NextResponse } from "next/server";
import { readAllLessons, updateLessonOnClose } from "@/lib/xiapan/百川/lessons";
import { creditToPool, readPools } from "@/lib/xiapan/百川/pools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface SettleResult {
  ticker: string;
  status: "settled" | "still_open" | "missing" | "error";
  actual?: 0 | 1;
  payoff?: number;
  pnl?: number;
  error?: string;
}

async function fetchKalshiMarketStatus(ticker: string): Promise<{
  status: string;
  result?: string;        // "yes" | "no" | "void"
  settlement_value?: number;
} | null> {
  try {
    const r = await fetch(`${KALSHI_API}/markets/${ticker}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const m = d?.market;
    if (!m) return null;
    return {
      status: m.status,
      result: m.result,
      settlement_value: m.settlement_value,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
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

  const pools = readPools();
  if (!pools) {
    return NextResponse.json({ ok: false, error: "pools not initialized" });
  }

  const lessons = readAllLessons();
  // 仅看未平仓的
  const open = lessons.filter((l) => l.actual === undefined || l.actual === null);
  if (open.length === 0) {
    return NextResponse.json({ ok: true, message: "no open lessons", checked: 0 });
  }

  const results: SettleResult[] = [];
  // 串行限速 · Kalshi API 不希望被打太狠
  for (const l of open) {
    const m = await fetchKalshiMarketStatus(l.ticker);
    if (!m) {
      results.push({ ticker: l.ticker, status: "error", error: "fetch failed" });
      continue;
    }
    if (m.status !== "settled" && m.status !== "finalized") {
      results.push({ ticker: l.ticker, status: "still_open" });
      continue;
    }

    // 算 actual
    let actual: 0 | 1 = 0;
    if (m.result === "yes") actual = l.side === "yes" ? 1 : 0;
    else if (m.result === "no") actual = l.side === "no" ? 1 : 0;
    else {
      // void · 全退 · 当 0 PnL
      actual = l.side === "yes" ? 0 : 0;
    }

    // 算 payoff · 命中 = 100¢/张 · 输 = 0
    const payoffPerShare = actual === 1 ? 100 : 0;
    const payoff = (l.qty * payoffPerShare) / 100;
    const pnl = payoff - l.stake;

    // update lesson
    updateLessonOnClose({
      ticker: l.ticker,
      ts_open: l.ts,
      exit_c: actual === 1 ? 100 : 0,
      actual,
      pnl,
    });

    // 回桶
    creditToPool(l.bucket === "stable" ? "S" : "C", payoff, pnl);

    results.push({ ticker: l.ticker, status: "settled", actual, payoff, pnl });
  }

  const settled = results.filter((r) => r.status === "settled");
  const summary = {
    total_checked: results.length,
    settled: settled.length,
    still_open: results.filter((r) => r.status === "still_open").length,
    error: results.filter((r) => r.status === "error").length,
    total_pnl: settled.reduce((s, r) => s + (r.pnl ?? 0), 0),
    wins: settled.filter((r) => r.actual === 1).length,
    losses: settled.filter((r) => r.actual === 0).length,
  };

  // V0.72 · push Telegram · 当日有结算
  if (summary.settled > 0) {
    try {
      const tg = await import("@/lib/xiapan/telegram");
      if (tg.tgEnabled()) {
        const sign = summary.total_pnl >= 0 ? "+" : "";
        await tg.sendTelegramMessage(
          `▼ Settle ${new Date().toISOString().slice(0, 10)}\n` +
          `· ${summary.settled} 单结算 · 赢 ${summary.wins} / 输 ${summary.losses}\n` +
          `· PnL ${sign}$${summary.total_pnl.toFixed(2)}`,
          { parseMode: undefined }
        );
      }
    } catch {}
  }

  return NextResponse.json({ ok: true, summary, results: results.slice(0, 50) });
}
