// /api/wealth/goals · 阶段 1 #2 起床看离目标多远
// V0.74 W1

import { NextResponse } from "next/server";
import { listGoals, updateGoalCurrent } from "@/lib/wealth/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const goals = await listGoals();
    const enriched = goals.map((g) => {
      const pct = g.target_usd > 0 ? (Number(g.current_usd) / Number(g.target_usd)) * 100 : 0;
      const remaining = Math.max(0, Number(g.target_usd) - Number(g.current_usd));
      let monthsToDeadline: number | null = null;
      if (g.deadline_date) {
        const ms = new Date(g.deadline_date).getTime() - Date.now();
        monthsToDeadline = Math.max(0, Math.floor(ms / (30 * 86400000)));
      }
      const monthlyNeed = monthsToDeadline && monthsToDeadline > 0 ? remaining / monthsToDeadline : null;
      return {
        ...g,
        pct: +pct.toFixed(1),
        remaining_usd: +remaining.toFixed(2),
        months_to_deadline: monthsToDeadline,
        monthly_need_usd: monthlyNeed != null ? +monthlyNeed.toFixed(2) : null,
      };
    });
    return NextResponse.json({ ok: true, goals: enriched });
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
