// /api/wealth/cashflow · B · /钱要 · 14 天现金流预测
// 检测 SimpleFIN 60 天 recurring · 预测下 14 天 bill · 对比现金

import { NextResponse } from "next/server";
import { detectRecurring } from "@/lib/wealth/simplefin";
import { netWorthSummary } from "@/lib/wealth/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const horizonDays = parseInt(url.searchParams.get("horizon") || "14");
  try {
    const [recurring, networth] = await Promise.all([
      detectRecurring(60),
      netWorthSummary().catch(() => null),
    ]);

    const now = new Date();
    const horizon = new Date(now.getTime() + horizonDays * 86400000);
    const todayStr = now.toISOString().slice(0, 10);
    const horizonStr = horizon.toISOString().slice(0, 10);

    const upcoming = recurring
      .filter((b) => b.next_predicted >= todayStr && b.next_predicted <= horizonStr)
      .sort((a, b) => a.next_predicted.localeCompare(b.next_predicted));

    const totalBills = upcoming.reduce((s, b) => s + b.avg_amount, 0);

    // 现金 · checking + savings · 不算 crypto / Kalshi
    const cashAccts = (networth?.by_account || []).filter((a: any) =>
      a.category === "cash" || a.category === "bank" || a.slug?.includes("bank") || a.slug?.includes("cash")
    );
    const cashNow = cashAccts.reduce((s: number, a: any) => s + Number(a.balance || 0), 0);

    return NextResponse.json({
      ok: true,
      horizon_days: horizonDays,
      bills_total: +totalBills.toFixed(2),
      cash_now: +cashNow.toFixed(2),
      gap: +(cashNow - totalBills).toFixed(2),
      bills: upcoming.map((b) => ({
        desc: b.desc,
        cat: b.cat,
        emoji: b.emoji,
        amount: b.avg_amount,
        date: b.next_predicted,
        period_days: b.period_days,
      })),
      cash_accounts: cashAccts.map((a: any) => ({ name: a.name, balance: a.balance })),
      total_recurring_detected: recurring.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
