// /api/xiapan/intel/yn-signals
//
// V0.61 · YN Signals Telegram 公开 archive 镜像
// 用户研究 · YN Signals = Polymarket / Kalshi / Limitless 24/7 alpha 聚合
// 我们用 t.me/s/<channel> 公开 web archive 抓 · 不需要 Telegram API
//
// 5 min 缓存 · 抽 ticker · 估 sentiment
//
// 注 · 公开 archive 是 Telegram 自家功能 · 任何 public channel 都能 web 看
//      cryptocurrency channels 普遍开 · 不算爬虫违规

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 300;

interface YnSignalItem {
  channel: string;
  message_id: string;
  text: string;
  ts: string;
  age_minutes: number;
  views?: number;
  url: string;
  tickers: string[];
  platforms: string[];          // ["polymarket", "kalshi", "limitless"]
  prices: string[];             // 抽到的 ¢ / % 数
  urgency: "low" | "med" | "high";
}

const TICKER_REGEX = /\b(KX[A-Z0-9]{2,}|\$[A-Z]{2,5}|0x[a-fA-F0-9]{4,})\b/g;

function extractTickers(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(TICKER_REGEX)) out.add(m[0]);
  return Array.from(out).slice(0, 5);
}

function extractPlatforms(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  if (lower.includes("polymarket") || lower.includes("poly ")) out.push("polymarket");
  if (lower.includes("kalshi")) out.push("kalshi");
  if (lower.includes("limitless")) out.push("limitless");
  return out;
}

function extractPrices(text: string): string[] {
  const out: string[] = [];
  const cents = text.match(/\b\d{1,3}(?:\.\d{1,2})?¢/g) ?? [];
  const pct = text.match(/\b\d{1,3}(?:\.\d{1,2})?%/g) ?? [];
  out.push(...cents, ...pct);
  return Array.from(new Set(out)).slice(0, 5);
}

function judgeUrgency(text: string): "low" | "med" | "high" {
  const lower = text.toLowerCase();
  if (/\b(alert|breaking|🚨|urgent|now)\b/i.test(lower)) return "high";
  if (/\b(big|whale|huge|crash|surge)\b/i.test(lower)) return "med";
  return "low";
}

/// 抓 t.me/s/<channel> 公开 archive · 解 HTML
async function fetchTelegramArchive(channel: string): Promise<YnSignalItem[]> {
  try {
    const r = await fetch(`https://t.me/s/${channel}`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; du4leaving/0.61)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return [];
    const html = await r.text();

    // 解 message blocks
    // <div class="tgme_widget_message" data-post="CHANNEL/123">
    //   <div class="tgme_widget_message_text">...</div>
    //   <a class="tgme_widget_message_date" href="..."><time datetime="..."/></a>
    //   <span class="tgme_widget_message_views">12.3K</span>
    // </div>
    const messageBlocks = html.split('<div class="tgme_widget_message ').slice(1);
    const now = Date.now();
    const out: YnSignalItem[] = [];

    for (const block of messageBlocks.slice(-20)) {       // 最近 20 条
      const dataPostM = block.match(/data-post="([^"]+)"/);
      const messageId = dataPostM?.[1] ?? "";
      if (!messageId) continue;

      // 抽文本 (可能多个 _text div)
      const textM = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      let text = textM?.[1] ?? "";
      // 去 HTML tag
      text = text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<a[^>]*>/g, "")
        .replace(/<\/a>/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      if (!text || text.length < 10) continue;

      // 时间
      const timeM = block.match(/<time[^>]+datetime="([^"]+)"/);
      const ts = timeM?.[1] ?? new Date().toISOString();
      const age = Math.round((now - new Date(ts).getTime()) / 60_000);
      if (age > 24 * 60) continue;                          // 过 24h 跳

      // views
      const viewsM = block.match(/class="tgme_widget_message_views"[^>]*>([^<]+)</);
      let views: number | undefined;
      if (viewsM) {
        const v = viewsM[1].trim();
        if (v.endsWith("K")) views = parseFloat(v) * 1000;
        else if (v.endsWith("M")) views = parseFloat(v) * 1_000_000;
        else views = parseFloat(v);
      }

      out.push({
        channel,
        message_id: messageId,
        text: text.slice(0, 500),
        ts,
        age_minutes: age,
        views: views,
        url: `https://t.me/${messageId}`,
        tickers: extractTickers(text),
        platforms: extractPlatforms(text),
        prices: extractPrices(text),
        urgency: judgeUrgency(text),
      });
    }

    return out;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel") ?? process.env.YN_TELEGRAM_CHANNEL ?? "YNSignals";
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

  try {
    const items = await fetchTelegramArchive(channel);

    // 排序 · 新 + 高紧急度先
    items.sort((a, b) => {
      const u = (x: string) => x === "high" ? 2 : x === "med" ? 1 : 0;
      const urgDiff = u(b.urgency) - u(a.urgency);
      if (urgDiff !== 0) return urgDiff;
      return a.age_minutes - b.age_minutes;
    });

    // V0.71 · high urgency push Telegram (仅近 30min · 防历史回灌)
    try {
      const tg = await import("@/lib/xiapan/telegram");
      if (tg.tgEnabled()) {
        for (const s of items.filter((i) => i.urgency === "high" && i.age_minutes < 30).slice(0, 3)) {
          await tg.sendTelegramAlertDedupe(
            `yn-${s.message_id}`,
            `⚠ YN ${s.platforms.join("/").toUpperCase() || "PM"} · ${s.age_minutes}min`,
            `${s.text.slice(0, 280)}` +
            (s.tickers.length > 0 ? `\n标的: ${s.tickers.join(" · ")}` : "")
          );
        }
      }
    } catch { /* 静默 */ }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        channel,
        total: items.length,
        high_urgency: items.filter((i) => i.urgency === "high").length,
        last_24h: items.length,
      },
      signals: items.slice(0, limit),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
