// /api/xiapan/baichuan/paper-tick · 扫 pending paper picks · settle · 算 P&L
// V0.73 W1 Day 5 · cron 跑 (每 30min · vercel.json 配)

import { NextResponse } from "next/server";
import { listPendingPicks, settlePick } from "@/lib/xiapan/百川/paper-picks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

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

  const pending = await listPendingPicks();
  let settled_count = 0;
  let total_pnl = 0;
  const settled_log: any[] = [];

  for (const p of pending) {
    try {
      const ticker = p.ticker;
      const r = await fetch(`${KALSHI}/markets/${encodeURIComponent(ticker)}`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;
      const m = (await r.json()).market;
      if (!m) continue;
      const status = m.status;
      const result = m.result;
      // 只 settle finalized / settled / resolved 且 result yes/no 明确
      if (
        ["finalized", "settled", "resolved"].includes(status) &&
        (result === "yes" || result === "no")
      ) {
        const { pnl_usd } = await settlePick(p, result, status);
        settled_count++;
        total_pnl += pnl_usd;
        settled_log.push({
          ticker,
          side: p.side,
          entry: p.entry_price,
          result,
          pnl: pnl_usd,
        });
      }
    } catch (e) {
      console.error(`tick err · ${p.ticker} · ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    pending_total: pending.length,
    settled_now: settled_count,
    pnl_now: +total_pnl.toFixed(2),
    settled_log,
  });
}
