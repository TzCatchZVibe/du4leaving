// /api/xiapan/baichuan/today
// V0.72 W3 Day 10 · 每日 9:30 setup 卡 · Wordle 风格 · 一屏

import { NextResponse } from "next/server";
import { allocateStrategies } from "@/lib/xiapan/百川/allocator-strategies";
import { computeApproval } from "@/lib/xiapan/百川/companion-approval";
import { readPools } from "@/lib/xiapan/百川/pools";
import { readAllLessons } from "@/lib/xiapan/百川/lessons";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const bankroll = pools ? pools.S.balance + pools.C.balance : 400;
  const alloc = await allocateStrategies({ bankroll, max_pct_per_strategy: 25 });
  const companions = computeApproval();
  const lessons = readAllLessons();
  const today_str = new Date().toISOString().slice(0, 10);
  const today_lessons = lessons.filter((l) => l.ts.startsWith(today_str));

  // top 3 active strategies
  const top3 = alloc.strategies.filter((s) => s.suggested_pct > 0).slice(0, 3);

  // ASCII heatmap (Wordle style · 用 emoji)
  // 🟢 = active alpha+ · 🟡 = active neutral · ⚪ = idle · 🔴 = retired
  const heatmap = alloc.strategies.map((s) => {
    if (s.suggested_pct >= 10) return "🟢";
    if (s.suggested_pct > 0) return "🟡";
    if (s.eligible) return "⚪";
    return "🔴";
  }).join("");

  // companion 模拟"今天是否有 advantage"
  const consensus = companions.reduce((s, c) => s + c.approval, 0) / companions.length;
  let advantage: "GREEN_ADVANTAGE" | "NEUTRAL" | "RED_DISADVANTAGE";
  if (consensus >= 30 && alloc.diversification.allocated >= 5) advantage = "GREEN_ADVANTAGE";
  else if (consensus < -20) advantage = "RED_DISADVANTAGE";
  else advantage = "NEUTRAL";

  // 战术暂停建议
  let tactic_advice = "";
  if (advantage === "GREEN_ADVANTAGE") tactic_advice = "↑↑ 多源 confirm · 节奏好 · 全速";
  else if (advantage === "RED_DISADVANTAGE") tactic_advice = "↓↓ 风险高 · 单笔减半 · 等明天";
  else tactic_advice = "中性 · 按计划跑";

  const result = {
    ok: true,
    date: today_str,
    bankroll,
    advantage,
    advantage_emoji: advantage === "GREEN_ADVANTAGE" ? "🟢⬆⬆" : advantage === "RED_DISADVANTAGE" ? "🔴⬇⬇" : "⚪・",
    tactic_advice,
    heatmap,
    heatmap_legend: "🟢 主力 · 🟡 辅 · ⚪ 待 · 🔴 退",
    top3_strategies: top3.map((s) => ({
      emoji: s.strategy.emoji,
      name: s.strategy.name,
      pct: s.suggested_pct,
      usd: s.suggested_usd,
      signals: s.current_signals,
    })),
    companions: companions.map((c) => ({
      name: c.name,
      emoji: c.emoji,
      approval: c.approval,
      mood: c.current_mood,
      quote: c.last_quote,
      blind_spot: c.blind_spot,
    })),
    today_progress: {
      placed: today_lessons.length,
      closed: today_lessons.filter((l) => l.actual !== undefined && l.actual !== null).length,
    },
    diversification: alloc.diversification,
    warnings: alloc.warnings,
  };

  // V0.72 W3 Day 10 · cron 模式 push setup 卡
  if (isCron) {
    try {
      const tg = await import("@/lib/xiapan/telegram");
      if (tg.tgEnabled()) {
        const lines = [
          `📅 ${result.date} · 早安`,
          ``,
          `${result.advantage_emoji}  ${result.tactic_advice}`,
          ``,
          result.heatmap,
          ``,
          `主力 ·`,
        ];
        for (const t of result.top3_strategies) {
          lines.push(`  ${t.emoji} ${t.name} · ${t.pct.toFixed(0)}%`);
        }
        lines.push(``);
        for (const c of result.companions) {
          const moodIcon = c.approval >= 30 ? "😊" : c.approval >= -20 ? "😐" : "😠";
          lines.push(`${c.emoji} ${c.name} ${moodIcon} "${c.quote}"`);
        }
        await tg.sendTelegramMessage(lines.join("\n"), { parseMode: undefined });
      }
    } catch {}
  }

  return NextResponse.json(result);
}
