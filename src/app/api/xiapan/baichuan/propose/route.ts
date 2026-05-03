// /api/xiapan/baichuan/propose · D 模式 · AI 推单 → push Telegram + inline 按钮
// V0.73 W1 Day 4
//
// 调 ·
//   POST /api/xiapan/baichuan/propose
//   body · { ticker, side, stake_usd, fair_prob, last_price, ev_pct, reasoning }
//
// 自动 ·
//   1 · 加入 pending list
//   2 · push Telegram 卡片 · 含 inline keyboard 2 按钮
//   3 · TZ 点 ✓ → telegram callback 跑 confirm endpoint
//   4 · TZ 点 ✗ → 学习反馈

import { NextResponse } from "next/server";
import { addPending } from "@/lib/xiapan/百川/pending-orders";

export const dynamic = "force-dynamic";

async function pushTelegramWithButtons(text: string, callbackData: { confirm: string; reject: string }): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const payload = {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [[
        { text: "✓ 下", callback_data: callbackData.confirm },
        { text: "✗ pass", callback_data: callbackData.reject },
      ]],
    },
  };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const required = ["ticker", "side", "stake_usd", "fair_prob", "last_price", "ev_pct"];
    for (const k of required) {
      if (body[k] === undefined) {
        return NextResponse.json({ ok: false, error: `缺字段 · ${k}` }, { status: 400 });
      }
    }
    const order = addPending({
      ticker: body.ticker,
      side: body.side,
      stake_usd: body.stake_usd,
      fair_prob: body.fair_prob,
      last_price: body.last_price,
      ev_pct: body.ev_pct,
      reasoning: body.reasoning || "",
    });

    const lines = [
      `🤖 AI 推单 · 1 键确认`,
      ``,
      `${order.ticker}`,
      `${order.side === "yes" ? "押 YES" : "押 NO"}  ·  $${order.stake_usd.toFixed(2)}`,
      ``,
      `当前 · ${(order.last_price * 100).toFixed(0)}¢`,
      `估真概率 · ${(order.fair_prob * 100).toFixed(0)}%`,
      `EV · ${order.ev_pct >= 0 ? "+" : ""}${order.ev_pct.toFixed(1)}%`,
      ``,
      order.reasoning ? `理由 · ${order.reasoning}` : "",
      ``,
      `id · ${order.id}  ·  60 min 内回复`,
    ].filter(Boolean);

    const ok = await pushTelegramWithButtons(lines.join("\n"), {
      confirm: `confirm_${order.id}`,
      reject: `reject_${order.id}`,
    });

    return NextResponse.json({ ok: true, pending: order, telegram_pushed: ok });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
