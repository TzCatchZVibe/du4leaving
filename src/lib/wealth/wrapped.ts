// 月度 Wrapped · Spotify 风故事化复盘
// W3 #12 · 每月 1 号 9am push · 也可 /复盘 [month] 看任何月

import { summarizeIncome } from "./income";
import { summarizeMonth as summarizeBurn } from "./simplefin";
import { netWorthSummary } from "./store";
import { listAll as listLockdown, monthSavings } from "./lockdown";

export interface WrappedReport {
  month: string;                  // "2026-04"
  income: {
    hg_total: number;
    czv_total: number;
    other_total: number;
    real_total: number;
    hg_status: string;
  };
  spending: {
    total_out: number;
    daily_avg: number;
    top_3_categories: Array<{ cat: string; emoji: string; total: number }>;
    top_3_expenses: Array<{ desc: string; amount: number; date: string }>;
  };
  lockdown: {
    cancelled_count: number;
    saved_usd: number;
    approved_count: number;
    save_rate_pct: number;
  };
  networth: {
    current: number;
  };
  kalshi: {
    pnl_usd: number;
    wr_pct: number;
    trades: number;
  };
  goals: Array<{
    name: string;
    emoji: string;
    pct: number;
    months_to_deadline: number | null;
    monthly_need: number | null;
  }>;
  narrative: string;              // AI 写的 3-5 句故事
}

async function llmNarrative(input: any): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return narrativeFallback(input);
  }
  const prompt = `你是 TZ 的私人理财顾问 · 写月度 Wrapped 故事 (Spotify 年终风) ·

数据 ·
${JSON.stringify(input, null, 2)}

要求 ·
- 中文 · MUJI 暖纸调 · 不指责 · 客观但温暖
- 4-6 句 · 每句 1 行 · 用 "·" 分隔
- 第 1 句 · 数字开场 (本月赚多少 / 攒多少)
- 第 2 句 · 最大胜利
- 第 3 句 · 最大坑 / 教训 (温柔不指责)
- 第 4 句 · lockdown 战绩 (省了多少)
- 第 5 句 · 离 1 个目标多近 (绿卡 / EP / 房 / 车 · 选最近的)
- 第 6 句 · 1 句鼓励 / 期待

只返回故事文本 · 不带引号 · 不带 JSON · 不带额外说明`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return narrativeFallback(input);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || narrativeFallback(input);
  } catch {
    return narrativeFallback(input);
  }
}

function narrativeFallback(d: any): string {
  const m = d.month;
  const lines = [
    `${m} 月 · 真收入 $${d.income.real_total.toFixed(0)} · 攒 $${(d.income.real_total - d.spending.total_out).toFixed(0)}`,
    `HG ${d.income.hg_status === "above_normal" ? "破纪录 · 加薪到账" : "正常发"}`,
    `最大坑 · ${d.spending.top_3_expenses[0]?.desc || "—"} · $${d.spending.top_3_expenses[0]?.amount?.toFixed(0) || 0}`,
    `lockdown · cancel ${d.lockdown.cancelled_count} 单 · 省 $${d.lockdown.saved_usd}`,
    `离绿卡 · 还 ${d.goals?.[0]?.months_to_deadline || "—"} 月 · 月需 $${d.goals?.[0]?.monthly_need || "—"}`,
  ];
  return lines.join("\n");
}

export async function generateWrapped(monthOffset = -1): Promise<WrappedReport> {
  // 同时拉所有数据
  const [incomeData, burnData, networth, lockdownStats] = await Promise.all([
    summarizeIncome(monthOffset),
    summarizeBurn(35).catch(() => null),
    netWorthSummary().catch(() => null),
    monthSavings(monthOffset).catch(() => ({ cancelled_count: 0, saved_usd: 0, approved_count: 0, save_rate_pct: 0 } as any)),
  ]);

  // 目标 · 直接 hardcode 简化 (先不调 endpoint)
  const goals_raw = [
    { slug: "ep-record", name: "EP 录音", emoji: "🎤", target: 3000, deadline: "2026-12-31" },
    { slug: "greencard", name: "绿卡基金", emoji: "🇺🇸", target: 30000, deadline: "2029-12-31" },
    { slug: "house-down", name: "房首付", emoji: "🏠", target: 80000, deadline: "2031-06-01" },
    { slug: "cybertruck", name: "Cybertruck", emoji: "🛻", target: 60000, deadline: "2031-12-31" },
  ];
  const goals = goals_raw.map((g) => {
    const months = Math.max(1, Math.floor((new Date(g.deadline).getTime() - Date.now()) / (30 * 86400000)));
    const pct = (Number(networth?.total_usd || 0) / g.target) * 100;
    return {
      name: g.name,
      emoji: g.emoji,
      pct: +pct.toFixed(0),
      months_to_deadline: months,
      monthly_need: +(g.target / months).toFixed(0),
    };
  });

  const month = incomeData.month_start.slice(0, 7);
  const top3Cat = (burnData?.by_category || []).slice(0, 3).map((c: any) => ({
    cat: c.cat, emoji: c.emoji, total: c.total_usd,
  }));
  const top3Exp = (burnData?.top_5_expenses || []).slice(0, 3);

  const aggregated = {
    month,
    income: {
      hg_total: incomeData.hg_total,
      czv_total: incomeData.czv_total,
      other_total: incomeData.other_total,
      real_total: incomeData.total_real_income,
      hg_status: incomeData.hg_status,
    },
    spending: {
      total_out: burnData?.total_out || 0,
      daily_avg: burnData?.daily_avg_burn || 0,
      top_3_categories: top3Cat,
      top_3_expenses: top3Exp,
    },
    lockdown: lockdownStats,
    networth: {
      current: Number(networth?.total_usd || 0),
    },
    kalshi: { pnl_usd: 0, wr_pct: 0, trades: 0 },   // TODO · 接 paper_picks
    goals,
  };

  const narrative = await llmNarrative(aggregated);
  return { ...aggregated, narrative };
}
