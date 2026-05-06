// /api/wealth/translate?amount=30 · ⑥ provocation
// $30 不是 $30 · 是 1.3 HG 小时 + EP 推迟 2.1 天 + 0.43% 律师费

import { NextResponse } from "next/server";
import { listGoals } from "@/lib/wealth/store";
import { listLumpy } from "@/lib/wealth/lumpy";

export const dynamic = "force-dynamic";

const HG_HOURLY_USD = 23;     // $4000/月 ÷ 168h ≈ $23/h

export async function GET(req: Request) {
  const url = new URL(req.url);
  const amount = parseFloat(url.searchParams.get("amount") || "0");
  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "amount 必须 > 0" }, { status: 400 });
  }
  try {
    const [goals, lumpyItems] = await Promise.all([listGoals().catch(() => []), listLumpy().catch(() => [])]);
    const hg_hours = +(amount / HG_HOURLY_USD).toFixed(1);
    const translations: Array<{ kind: string; emoji: string; name: string; pct?: number; days?: number; description: string }> = [];

    translations.push({
      kind: "hg-hours",
      emoji: "⏱",
      name: "HG 干活",
      description: `${hg_hours} 小时 (按 $${HG_HOURLY_USD}/h)`,
    });

    for (const g of goals) {
      const target = Number(g.target_usd);
      const current = Number(g.current_usd);
      const remaining = Math.max(0, target - current);
      let monthly_need = 0;
      let days_delay: number | null = null;
      if (g.deadline_date) {
        const months = Math.max(1, Math.floor((new Date(g.deadline_date).getTime() - Date.now()) / (30 * 86400000)));
        monthly_need = remaining / months;
        const daily_need = monthly_need / 30;
        if (daily_need > 0) days_delay = +(amount / daily_need).toFixed(1);
      }
      const pct = target > 0 ? +((amount / target) * 100).toFixed(2) : 0;
      translations.push({
        kind: "goal",
        emoji: g.emoji || "🎯",
        name: g.name,
        pct,
        days: days_delay ?? undefined,
        description: days_delay != null
          ? `推迟 ${days_delay} 天 · 占目标 ${pct}%`
          : `占目标 ${pct}%`,
      });
    }

    for (const l of lumpyItems) {
      const pct = l.total_usd > 0 ? +((amount / l.total_usd) * 100).toFixed(2) : 0;
      translations.push({
        kind: "lumpy",
        emoji: l.emoji,
        name: l.name,
        pct,
        description: `占 ${pct}% (大坑总 $${l.total_usd})`,
      });
    }

    return NextResponse.json({
      ok: true,
      amount,
      hg_hours,
      translations,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
