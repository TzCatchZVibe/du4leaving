// /api/wealth/lockdown/remind · cron 每 6h 跑 · push 24h 后的提醒
// "你 24h 前说要等的 $X · 现在还要吗?"

import { NextResponse } from "next/server";
import { findExpiredNotReminded, markReminded } from "@/lib/wealth/lockdown";

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
  const expired = await findExpiredNotReminded();
  let pushed = 0;
  for (const p of expired) {
    const hoursAgo = ((Date.now() - new Date(p.created_at).getTime()) / 3600000).toFixed(0);
    const lines = [
      `⏰ ${hoursAgo} 小时前你说要等等 ·`,
      ``,
      `${p.description}`,
      `$${Number(p.amount_usd).toFixed(2)}  ·  ${p.category}`,
      ``,
      `还要吗?`,
      `  /确认 ${p.short_id}    要 · 去花`,
      `  /取消 ${p.short_id}    不要了 · 省了 $${Number(p.amount_usd).toFixed(2)}`,
    ];
    const ok = await pushTelegram(lines.join("\n"));
    if (ok) {
      await markReminded(p.short_id);
      pushed++;
    }
  }
  return NextResponse.json({ ok: true, expired_count: expired.length, pushed });
}
