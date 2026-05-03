// /api/xiapan/baichuan/picks-push · 每日 9am · cron 调 · 拉 picks + push Telegram
// V0.73 W1 Day 5

import { NextResponse } from "next/server";
import { recordPaperPick, shortPickId } from "@/lib/xiapan/百川/paper-picks";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function getBaseUrl(req: Request): string {
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3001";
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
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const BASE = getBaseUrl(req);
  // 验 cron
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
    const r = await fetch(`${BASE}/api/xiapan/baichuan/picks?limit=5&min_ev=5`).then(r => r.json());
    if (!r.ok || !r.winners || r.winners.length === 0) {
      const text = `📊 今日推荐 · 暂无 +EV 单 (扫 ${r.scanned || 0} · 估值 ${r.estimated || 0})`;
      await pushTelegram(text);
      return NextResponse.json({ ok: true, pushed: true, winners: 0 });
    }
    // 自动 record 为 paper pick · paper 验证模型
    let recorded = 0;
    for (const w of r.winners) {
      const rec = await recordPaperPick({
        pick_id: shortPickId(),
        ticker: w.ticker,
        title: w.title,
        yes_subtitle: w.yes_subtitle,
        side: "yes",                   // /推荐 默认押 yes (LLM 给的概率即 yes 方真概率)
        entry_price: w.last_price,
        fair_prob: w.fair_prob,
        ev_pct: w.ev_pct,
        reasoning: w.reason,
        source: "cron",
        paper_stake_usd: 1.0,
      });
      if (rec) recorded++;
    }

    const lines = [
      `📊 早安 · 今日 Top ${r.winners.length} +EV 推荐 (≥ ${r.min_ev}% EV)`,
      `扫 ${r.scanned} · 估 ${r.estimated} · 命中 ${r.winners_count} · paper ${recorded}`,
      ``,
    ];
    for (const w of r.winners) {
      lines.push(`${w.ticker}`);
      lines.push(`  ${w.title}`);
      lines.push(`  ${(w.last_price*100).toFixed(0)}¢ → ${(w.fair_prob*100).toFixed(0)}% · +EV ${w.ev_pct.toFixed(1)}%`);
      lines.push(`  ${w.reason}`);
      lines.push(`  → kalshi.com/markets?q=${encodeURIComponent(w.ticker)}`);
      lines.push(``);
    }
    lines.push(`💡 已记 paper · 用 /统计 看战绩 · 真钱另说`);
    await pushTelegram(lines.join("\n"));
    return NextResponse.json({ ok: true, pushed: true, winners: r.winners.length, paper_recorded: recorded });
  } catch (e: any) {
    await pushTelegram(`✗ /推荐 cron 失败 · ${e.message}`);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
