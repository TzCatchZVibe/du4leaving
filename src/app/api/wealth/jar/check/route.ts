// /api/wealth/jar/check · ① Guilty Pleasure 触发器 · daily cron + on-demand
// daysBack=7 默认 · cron 每天跑 · 新事件 push Telegram

import { NextResponse } from "next/server";
import { checkGuilty } from "@/lib/wealth/guilty";

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
    const days = parseInt(url.searchParams.get("days") || (isCron ? "2" : "7"));
    const r = await checkGuilty(days);
    let pushed = false;
    if (isCron && r.new_events > 0) {
      const lines = [
        `🎤 Guilty Pleasure 触发`,
        ``,
        `${r.new_events} 笔花费 → 罐子记账`,
      ];
      for (const e of r.events.slice(0, 5)) {
        lines.push(`+ $${e.jar_credit} → ${e.jar_slug} · ${e.tx_desc.slice(0, 30)}`);
      }
      lines.push(``, `罐子现状 ·`);
      for (const j of r.jars_after) {
        lines.push(`${j.emoji} ${j.name} · $${j.balance_usd.toFixed(0)}`);
      }
      lines.push(``, `→ 真去存这笔 · 还是只看着? /罐 看明细`);
      pushed = await pushTelegram(lines.join("\n"));
    }
    return NextResponse.json({ ok: true, pushed, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
