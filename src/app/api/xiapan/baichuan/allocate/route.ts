// /api/xiapan/baichuan/allocate
// V0.72 · 月底分配 · cron 触发
//
// GET ?cron=1  · cron-runner 调 · 跑 monthly allocation
// 结果写到 pools.json + 返回 AllocationResult

import { NextResponse } from "next/server";
import { runMonthlyAllocation } from "@/lib/xiapan/百川/allocator";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  const result = runMonthlyAllocation();
  if (!result) {
    return NextResponse.json({ ok: false, error: "pools not initialized" }, { status: 200 });
  }

  // V0.72 · 月度报表 push Telegram
  try {
    const tg = await import("@/lib/xiapan/telegram");
    if (tg.tgEnabled()) {
      const lines = [
        `▼ ${result.month} 月度结算`,
        ``,
        `S 池 · $${result.S_start.toFixed(2)} → $${result.S_end.toFixed(2)}`,
        `  drawdown: ${(result.drawdown_S_pct * 100).toFixed(1)}%`,
        result.S_to_C_transfer > 0
          ? `  超 hurdle 转 C: $${result.S_to_C_transfer.toFixed(2)}`
          : `  未达 hurdle · 全留`,
        ``,
        `C 池 · net_gain $${result.C_distribution.net_gain.toFixed(2)}`,
        result.C_distribution.tier !== "none"
          ? `  ${result.C_distribution.tier} tier · cashout $${result.C_distribution.cashout.toFixed(2)} / reinvest $${result.C_distribution.reinvest.toFixed(2)}`
          : `  < $50 · 累积`,
        ``,
        `状态: ${result.circuit_state_after}`,
      ];
      await tg.sendTelegramMessage(lines.join("\n"), { parseMode: undefined });
    }
  } catch {}

  return NextResponse.json({ ok: true, result });
}
