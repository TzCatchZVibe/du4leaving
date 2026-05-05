// /api/wealth/goals · 阶段 1 #2 起床看离目标多远
// C · 目标速度警报 · 用最近 30 天真攒 vs 月需

import { NextResponse } from "next/server";
import { listGoals, updateGoalCurrent } from "@/lib/wealth/store";
import { summarizeWindow } from "@/lib/wealth/simplefin";
import { summarizeIncomeWindow } from "@/lib/wealth/income";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function recentMonthlySavingsRate(): Promise<number> {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 86400000);
  const [spend, income] = await Promise.all([
    summarizeWindow(start, now, 60).catch(() => null),
    summarizeIncomeWindow(start, now).catch(() => null),
  ]);
  const inc = income?.real_total || 0;
  const out = spend?.total_out || 0;
  return inc - out;     // 30 天 ≈ 月化
}

export async function GET() {
  try {
    const [goals, monthlySave] = await Promise.all([
      listGoals(),
      recentMonthlySavingsRate(),
    ]);
    const enriched = goals.map((g) => {
      const pct = g.target_usd > 0 ? (Number(g.current_usd) / Number(g.target_usd)) * 100 : 0;
      const remaining = Math.max(0, Number(g.target_usd) - Number(g.current_usd));
      let monthsToDeadline: number | null = null;
      if (g.deadline_date) {
        const ms = new Date(g.deadline_date).getTime() - Date.now();
        monthsToDeadline = Math.max(0, Math.floor(ms / (30 * 86400000)));
      }
      const monthlyNeed = monthsToDeadline && monthsToDeadline > 0 ? remaining / monthsToDeadline : null;

      // 速度 · 假设当前月化攒额全部分给该 goal · projected months
      let projected_months: number | null = null;
      let on_track = true;
      let extra_per_month = 0;
      if (monthlySave > 0 && remaining > 0) {
        projected_months = Math.ceil(remaining / monthlySave);
        if (monthsToDeadline != null && projected_months > monthsToDeadline) {
          on_track = false;
          extra_per_month = monthlyNeed ? +(monthlyNeed - monthlySave).toFixed(0) : 0;
        }
      } else if (remaining > 0 && monthlySave <= 0) {
        on_track = false;
        extra_per_month = monthlyNeed ? +monthlyNeed.toFixed(0) : 0;
        projected_months = null;     // 永远到不了
      }

      return {
        ...g,
        pct: +pct.toFixed(1),
        remaining_usd: +remaining.toFixed(2),
        months_to_deadline: monthsToDeadline,
        monthly_need_usd: monthlyNeed != null ? +monthlyNeed.toFixed(2) : null,
        projected_months_at_current_rate: projected_months,
        on_track,
        extra_needed_per_month: extra_per_month,
      };
    });
    return NextResponse.json({
      ok: true,
      goals: enriched,
      recent_monthly_save_rate: +monthlySave.toFixed(2),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug, current_usd } = body;
    if (!slug || current_usd === undefined) {
      return NextResponse.json({ ok: false, error: "缺 slug 或 current_usd" }, { status: 400 });
    }
    const g = await updateGoalCurrent(slug, Number(current_usd));
    return NextResponse.json({ ok: true, goal: g });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
