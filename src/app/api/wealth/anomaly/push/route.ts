// /api/wealth/anomaly/push · 每日 11am Dallas · 异常 cron · push Telegram

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "";
    const r = await fetch(`${proto}://${host}/api/wealth/anomaly`).then((r) => r.json());
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
    }
    if (!r.anomalies || r.anomalies.length === 0) {
      return NextResponse.json({ ok: true, pushed: false, reason: "no anomalies" });
    }
    const lines = [
      `🚨 支出异常 · ${r.window_start} ~ ${r.window_end}`,
      `本周 $${r.this_week_total.toFixed(0)} vs 4 周均 $${r.prior_4w_weekly_avg.toFixed(0)}`,
      ``,
    ];
    for (const a of r.anomalies) {
      const pct = a.delta_pct === 999 ? "新出现" : `+${a.delta_pct}%`;
      lines.push(`${a.emoji} ${a.cat} · $${a.this_week_total.toFixed(0)} (${pct} · 多花 $${a.delta_usd.toFixed(0)})`);
    }
    lines.push(``, `→ 检查 SimpleFIN · 是计划支出还是漏单 · 必要时 /等等 锁`);
    const ok = await pushTelegram(lines.join("\n"));
    return NextResponse.json({ ok: true, pushed: ok, anomalies: r.anomalies.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
