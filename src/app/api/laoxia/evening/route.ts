// /api/laoxia/evening · 晚 9pm Dallas (= 02:00 UTC next day CDT) 一句晚问
// 不施压 · 问今天怎么样 · TZ 回 → 老虾顺势 narrate

import { NextResponse } from "next/server";
import { callLaoxia } from "@/lib/laoxia/agent";

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
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return NextResponse.json({ ok: false, error: "缺 TELEGRAM_CHAT_ID" }, { status: 500 });

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "";
  const base = `${proto}://${host}`;

  try {
    const r = await callLaoxia(
      chatId,
      "[系统主动 · 晚 9pm 晚问] 不要 tool · 不要数字 · 一句话问 TZ 今天怎么样 · 不施压 · 不问感受 · 像兄弟下班发的微信 · ≤ 2 行",
      base
    );
    const pushed = await pushTelegram(r.text);
    return NextResponse.json({ ok: true, pushed, model: r.model_used });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
