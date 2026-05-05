// /api/wealth/weekly/push · 周日 9pm Dallas (= Mon 02:00 UTC) push Telegram

import { NextResponse } from "next/server";
import { generateWeekly } from "@/lib/wealth/weekly";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

async function pushTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function format(r: any): string {
  const lines = [
    `📊 周报 · ${r.week_label}`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    r.narrative,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `💼 收入 $${r.income.real_total.toFixed(0)}`,
    `   HG $${r.income.hg.toFixed(0)} · CZV $${r.income.czv.toFixed(0)}`,
    ``,
    `💸 支出 $${r.spending.total_out.toFixed(0)} · 日均 $${r.spending.daily_avg.toFixed(0)}`,
    `   vs 上周 · ${r.spending.delta_vs_prior_week_pct >= 0 ? "+" : ""}${r.spending.delta_vs_prior_week_pct}%`,
  ];
  for (const c of r.spending.top_3_categories || []) {
    lines.push(`   ${c.emoji} ${c.cat} $${c.total.toFixed(0)}`);
  }
  lines.push(``, `🔮 14 天 cashflow`);
  lines.push(`   bill 预测 · $${r.cashflow.bills_next_14d.toFixed(0)}`);
  lines.push(`   现金 · $${r.cashflow.cash_now.toFixed(0)}`);
  lines.push(`   ${r.cashflow.gap >= 0 ? "✓ 安全 · 余 $" + r.cashflow.gap : "⚠ 缺 $" + Math.abs(r.cashflow.gap)}`);
  lines.push(``, `🎯 目标速度`);
  for (const g of r.goals_velocity || []) {
    const status = g.on_track ? "✓ 在轨" : `⚠ 需 +$${g.extra_needed_per_month}/月`;
    lines.push(`   ${g.emoji} ${g.name} ${g.pct}% · ${status}`);
  }
  return lines.join("\n");
}

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
  try {
    const offset = parseInt(url.searchParams.get("offset") || "-1");      // 默认上周 (周日跑 = 看刚结束的周)
    const r = await generateWeekly(offset);
    const text = format(r);
    const ok = await pushTelegram(text);
    return NextResponse.json({ ok: true, pushed: ok, week_label: r.week_label });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
