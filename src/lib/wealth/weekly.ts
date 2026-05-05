// 周报 · 替月报 · 周日 9pm Dallas push
// A · 月报太晚 · 周报能调头

import { summarizeWindow, detectRecurring } from "./simplefin";
import { summarizeIncomeWindow } from "./income";
import { netWorthSummary, listGoals } from "./store";

export interface WeeklyReport {
  week_label: string;                // "5/4-5/10"
  start: string;
  end: string;
  income: { hg: number; czv: number; other: number; real_total: number };
  spending: {
    total_out: number;
    daily_avg: number;
    top_3_categories: Array<{ cat: string; emoji: string; total: number }>;
    top_3_expenses: Array<{ desc: string; amount: number; date: string }>;
    delta_vs_prior_week_pct: number;     // 这周 vs 上周
  };
  cashflow: {
    bills_next_14d: number;              // 14 天内 bill 总额
    cash_now: number;
    gap: number;                          // cash - bills_14d
  };
  goals_velocity: Array<{
    name: string;
    emoji: string;
    pct: number;
    months_to_deadline: number | null;
    monthly_need: number;
    on_track: boolean;
    extra_needed_per_month: number;
  }>;
  narrative: string;
}

async function llmWeeklyNarrative(d: any): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return weeklyFallback(d);
  const prompt = `你是 TZ 的私人理财顾问 · 写周报 (周日晚)
数据 ·
${JSON.stringify(d, null, 2)}

要求 ·
- 中文 · MUJI 暖纸调 · 不指责
- 4 句 · 每句 1 行 · "·" 分隔
- 第 1 句 · 这周净 (赚多少 - 花多少 = 攒多少)
- 第 2 句 · 比上周怎样 (上升 / 持平 / 下降)
- 第 3 句 · 14 天 cashflow 是否安全 (gap 正负)
- 第 4 句 · 1 个目标的速度 · 是否在轨

只返回故事文本 · 不带引号 · 不带 JSON`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 300,
      }),
    });
    if (!res.ok) return weeklyFallback(d);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || weeklyFallback(d);
  } catch {
    return weeklyFallback(d);
  }
}

function weeklyFallback(d: any): string {
  const net = d.income.real_total - d.spending.total_out;
  const lines = [
    `本周 · 赚 $${d.income.real_total.toFixed(0)} · 花 $${d.spending.total_out.toFixed(0)} · 攒 $${net.toFixed(0)}`,
    `vs 上周 · ${d.spending.delta_vs_prior_week_pct >= 0 ? "+" : ""}${d.spending.delta_vs_prior_week_pct}% 支出`,
    `14 天内 bill $${d.cashflow.bills_next_14d.toFixed(0)} · 现金 $${d.cashflow.cash_now.toFixed(0)} · ${d.cashflow.gap >= 0 ? "✓ 安全" : "⚠ 缺 $" + Math.abs(d.cashflow.gap).toFixed(0)}`,
    d.goals_velocity[0] ? `${d.goals_velocity[0].emoji} ${d.goals_velocity[0].name} ${d.goals_velocity[0].pct}% · ${d.goals_velocity[0].on_track ? "在轨" : "需 +$" + d.goals_velocity[0].extra_needed_per_month + "/月"}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function generateWeekly(weekOffset = 0): Promise<WeeklyReport> {
  const now = new Date();
  // 本周 · 周一 00:00 → 下周一 00:00 (UTC 边界 · 简单粗暴)
  const dow = (now.getUTCDay() + 6) % 7;     // 0=周一
  const thisMon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow + weekOffset * 7));
  const nextMon = new Date(thisMon.getTime() + 7 * 86400000);
  const priorMon = new Date(thisMon.getTime() - 7 * 86400000);

  const [thisWeek, priorWeek, incomeThis, networth, goals, recurring] = await Promise.all([
    summarizeWindow(thisMon, nextMon, 60),
    summarizeWindow(priorMon, thisMon, 60),
    summarizeIncomeWindow(thisMon, nextMon),
    netWorthSummary().catch(() => null),
    listGoals().catch(() => []),
    detectRecurring(60).catch(() => []),
  ]);

  const delta = priorWeek.total_out > 0
    ? +(((thisWeek.total_out - priorWeek.total_out) / priorWeek.total_out) * 100).toFixed(0)
    : 0;

  // 14 天内 bill
  const horizon = new Date(now.getTime() + 14 * 86400000);
  const todayStr = now.toISOString().slice(0, 10);
  const horizonStr = horizon.toISOString().slice(0, 10);
  const bills14 = recurring
    .filter((b) => b.next_predicted >= todayStr && b.next_predicted <= horizonStr)
    .reduce((s, b) => s + b.avg_amount, 0);

  // 现金 · 只算 cash 类账户 (checking / savings)
  const cashAccts = (networth?.by_account || []).filter((a: any) =>
    a.category === "cash" || a.category === "bank" || a.slug?.includes("bank") || a.slug?.includes("cash")
  );
  const cashNow = cashAccts.reduce((s: number, a: any) => s + Number(a.balance || 0), 0);

  // 目标速度 · 用本月真攒额做月化基准
  const monthly_save = incomeThis.real_total - thisWeek.total_out;     // 周净 (粗略)
  const monthly_save_proj = monthly_save * 4;                            // 月化
  const goalsVel = goals.map((g) => {
    const months = g.deadline_date
      ? Math.max(1, Math.floor((new Date(g.deadline_date).getTime() - now.getTime()) / (30 * 86400000)))
      : null;
    const target = Number(g.target_usd);
    const current = Number(g.current_usd);
    const pct = target > 0 ? (current / target) * 100 : 0;
    const remaining = Math.max(0, target - current);
    const monthly_need = months ? remaining / months : 0;
    const on_track = monthly_save_proj >= monthly_need;
    return {
      name: g.name,
      emoji: g.emoji || "🎯",
      pct: +pct.toFixed(0),
      months_to_deadline: months,
      monthly_need: +monthly_need.toFixed(0),
      on_track,
      extra_needed_per_month: on_track ? 0 : +(monthly_need - monthly_save_proj).toFixed(0),
    };
  });

  const aggregated = {
    week_label: `${thisMon.toISOString().slice(5, 10)} ~ ${new Date(nextMon.getTime() - 86400000).toISOString().slice(5, 10)}`,
    start: thisMon.toISOString().slice(0, 10),
    end: nextMon.toISOString().slice(0, 10),
    income: {
      hg: incomeThis.hg_total,
      czv: incomeThis.czv_total,
      other: incomeThis.other_total,
      real_total: incomeThis.real_total,
    },
    spending: {
      total_out: thisWeek.total_out,
      daily_avg: thisWeek.daily_avg_burn,
      top_3_categories: thisWeek.by_category.slice(0, 3).map((c) => ({ cat: c.cat, emoji: c.emoji, total: c.total_usd })),
      top_3_expenses: thisWeek.top_5_expenses.slice(0, 3),
      delta_vs_prior_week_pct: delta,
    },
    cashflow: {
      bills_next_14d: +bills14.toFixed(0),
      cash_now: +cashNow.toFixed(0),
      gap: +(cashNow - bills14).toFixed(0),
    },
    goals_velocity: goalsVel,
  };

  const narrative = await llmWeeklyNarrative(aggregated);
  return { ...aggregated, narrative };
}
