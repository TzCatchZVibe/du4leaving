// /api/wealth/wrapped/push · 每月 1 号 9am · cron 调 · push Telegram

import { NextResponse } from "next/server";
import { generateWrapped } from "@/lib/wealth/wrapped";

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

function formatReport(r: any): string {
  const sign = (v: number) => v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
  const lines = [
    `📊 ${r.month} · 月度 Wrapped`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    r.narrative,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `数据明细`,
    ``,
    `💼 收入 · $${r.income.real_total.toFixed(0)}`,
    `   HG · $${r.income.hg_total.toFixed(0)} (${r.income.hg_status})`,
    `   CZV · $${r.income.czv_total.toFixed(0)}`,
    `   其他 · $${r.income.other_total.toFixed(0)}`,
    ``,
    `💸 支出 · $${r.spending.total_out.toFixed(0)} · 日均 $${r.spending.daily_avg.toFixed(0)}`,
  ];
  for (const c of r.spending.top_3_categories || []) {
    lines.push(`   ${c.emoji} ${c.cat} · $${c.total.toFixed(0)}`);
  }
  lines.push(``, `🛑 lockdown · cancel ${r.lockdown.cancelled_count} · 省 $${r.lockdown.saved_usd}`);
  lines.push(``, `💰 净值 · $${r.networth.current.toFixed(0)}`);
  lines.push(``, `🎯 目标进度`);
  for (const g of r.goals) {
    lines.push(`   ${g.emoji} ${g.name} · ${g.pct}% · 剩 ${g.months_to_deadline}月 · 月需 $${g.monthly_need}`);
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
    const offset = parseInt(url.searchParams.get("offset") || "-1");
    const report = await generateWrapped(offset);
    const text = formatReport(report);
    const ok = await pushTelegram(text);
    return NextResponse.json({ ok: true, pushed: ok, month: report.month });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
