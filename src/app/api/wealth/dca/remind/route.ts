// /api/wealth/dca/remind · 周一 9am cron · push DCA 周定投提醒
// 也月 1 号提醒强制储蓄

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function getCryptoPrice(ticker: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.coinbase.com/v2/prices/${ticker}-USD/spot`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const d = await r.json();
    return parseFloat(d.data?.amount || "0") || null;
  } catch { return null; }
}

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
  } catch { return false; }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("cron") === "1";
  if (isCron) {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.headers.get("authorization") ?? "";
      if (got !== `Bearer ${expected}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const dayOfWeek = now.getUTCDay();      // 0=Sun · 1=Mon
  const dayOfMonth = now.getUTCDate();
  const c = sb();
  const { data: plans } = await c.from("dca_plans").select("*").eq("active", true);
  const dueToday = (plans || []).filter((p: any) => {
    if (p.frequency === "weekly") return dayOfWeek === (p.day_of_period || 1);
    if (p.frequency === "biweekly") {
      const week = Math.floor((now.getTime() / 1000 - 0) / 604800);
      return dayOfWeek === (p.day_of_period || 1) && week % 2 === 0;
    }
    if (p.frequency === "monthly") return dayOfMonth === (p.day_of_period || 1);
    return false;
  });

  if (dueToday.length === 0) {
    return NextResponse.json({ ok: true, due_today: 0, pushed: false });
  }

  const lines = [`📅 DCA 提醒 · ${now.toISOString().slice(0, 10)}`, ``];
  const executions: any[] = [];
  for (const p of dueToday) {
    const price = p.ticker ? await getCryptoPrice(p.ticker) : null;
    const qty = price ? (p.amount_usd / price).toFixed(6) : null;
    lines.push(`${p.ticker ? "₿" : "💰"} ${p.name}`);
    lines.push(`   $${p.amount_usd}${p.ticker ? ` ≈ ${qty} ${p.ticker} (现 $${price?.toFixed(0)})` : ""}`);
    if (p.ticker) {
      lines.push(`   去 Coinbase 买 · 或 /dca_done ${p.slug}`);
    } else {
      lines.push(`   去银行转 high-yield savings · 或 /dca_done ${p.slug}`);
    }
    lines.push(``);
    // 创建 pending execution
    const { data } = await c.from("dca_executions").insert({
      plan_id: p.id,
      scheduled_at: now.toISOString(),
      amount_usd: p.amount_usd,
      status: "pending",
      ticker_price_usd: price,
    }).select("*").single();
    if (data) executions.push(data);
  }
  lines.push(`💡 这周已提醒 · 跑完发 /dca_done <slug>`);
  const pushed = await pushTelegram(lines.join("\n"));
  return NextResponse.json({ ok: true, due_today: dueToday.length, pushed, executions: executions.length });
}
