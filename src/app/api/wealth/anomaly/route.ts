// /api/wealth/anomaly · D · 支出类目异常检测
// 算法 · 最近 7 天 vs 前 28 天周均 · 任一类目 +50% 且 delta ≥ $20 → 异常

import { NextResponse } from "next/server";
import { summarizeWindow } from "@/lib/wealth/simplefin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SPIKE_THRESHOLD_PCT = 50;
const MIN_DELTA_USD = 20;

export interface CategoryAnomaly {
  cat: string;
  emoji: string;
  this_week_total: number;
  prior_4w_avg_per_week: number;
  delta_pct: number;
  delta_usd: number;
}

export async function GET() {
  try {
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 86400000);
    const prior28Start = new Date(now.getTime() - 35 * 86400000);
    const prior28End = last7;

    const [thisWeek, prior4w] = await Promise.all([
      summarizeWindow(last7, now, 60),
      summarizeWindow(prior28Start, prior28End, 60),
    ]);

    const priorAvgByCat: Record<string, number> = {};
    for (const c of prior4w.by_category) {
      priorAvgByCat[c.cat] = c.total_usd / 4;     // 4 周
    }

    const anomalies: CategoryAnomaly[] = [];
    for (const c of thisWeek.by_category) {
      // 跳过 income/transfer 类
      if (["income", "transfer", "interest"].includes(c.cat)) continue;
      const baseline = priorAvgByCat[c.cat] || 0;
      const delta = c.total_usd - baseline;
      if (delta < MIN_DELTA_USD) continue;
      const pct = baseline > 0 ? (delta / baseline) * 100 : Infinity;
      if (pct < SPIKE_THRESHOLD_PCT && baseline > 0) continue;
      anomalies.push({
        cat: c.cat,
        emoji: c.emoji,
        this_week_total: c.total_usd,
        prior_4w_avg_per_week: +baseline.toFixed(2),
        delta_pct: baseline > 0 ? +pct.toFixed(0) : 999,
        delta_usd: +delta.toFixed(2),
      });
    }
    anomalies.sort((a, b) => b.delta_usd - a.delta_usd);

    return NextResponse.json({
      ok: true,
      anomalies,
      this_week_total: thisWeek.total_out,
      prior_4w_weekly_avg: +(prior4w.total_out / 4).toFixed(2),
      window_start: last7.toISOString().slice(0, 10),
      window_end: now.toISOString().slice(0, 10),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
