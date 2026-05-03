// /api/xiapan/baichuan/picks · B · 每日 5 单 +EV 推荐 endpoint
// V0.73 W1 Day 2 · 4 模式 co-pilot 第 2 模式
//
// 用法 ·
//   GET /api/xiapan/baichuan/picks?limit=5&min_ev=5&series=KXBTCDAILY,KXWTACHALLENGERMATCH
//   默认 · 6 系列扫 · top 5 +EV ≥ 5%

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

const DEFAULT_SERIES = [
  "KXBTCDAILY",
  "KXETHDAILY",
  "KXSOLDAILY",
  "KXWTACHALLENGERMATCH",
  "KXATPCHALLENGERMATCH",
  "KXUSPRESELECT",
];

async function listOpenMarkets(seriesTicker: string, limit = 10): Promise<any[]> {
  const url = `${KALSHI}/events?series_ticker=${seriesTicker}&status=open&limit=${limit}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const d = await res.json();
  const markets: any[] = [];
  for (const ev of d.events || []) {
    const evRes = await fetch(`${KALSHI}/events/${ev.event_ticker}`, { headers: { Accept: "application/json" } });
    if (!evRes.ok) continue;
    const evData = await evRes.json();
    for (const m of evData.markets || []) {
      if (["active", "open", "initialized"].includes(m.status)) {
        markets.push({ ...m, _event_title: evData.event?.title });
      }
    }
  }
  return markets;
}

async function llmEstimate(market: any): Promise<{ fairProb: number; reason: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const lastPrice = (market.last_price ?? 0) / 100;
  const prompt = `预测市场分析师 · 估 YES 真概率。

市场 · ${market.ticker}
事件 · ${market._event_title || ""}
问题 · ${market.title}
押 YES · ${market.yes_sub_title}
当前 · ${(lastPrice * 100).toFixed(0)}¢

返回 JSON · 无别的 ·
{"prob": <0-100 整数>, "reason": "<≤60 字>"}`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 150,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const text = d.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    if (typeof parsed.prob !== "number") return null;
    return { fairProb: parsed.prob / 100, reason: parsed.reason || "" };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "5");
  const minEv = parseFloat(url.searchParams.get("min_ev") || "5");
  const seriesArg = url.searchParams.get("series");
  const series = seriesArg ? seriesArg.split(",") : DEFAULT_SERIES;

  // 扫
  const all: any[] = [];
  for (const ser of series) {
    const ms = await listOpenMarkets(ser, 8);
    all.push(...ms);
  }

  // LLM 估值 · 节流 5 个一批
  const scored: any[] = [];
  for (let i = 0; i < all.length; i += 5) {
    const batch = all.slice(i, i + 5);
    const results = await Promise.all(batch.map(async (m) => {
      const lastPrice = (m.last_price ?? 0) / 100;
      if (lastPrice <= 0 || lastPrice >= 1) return null;
      const est = await llmEstimate(m);
      if (!est || est.fairProb == null) return null;
      const evPct = ((est.fairProb - lastPrice) / lastPrice) * 100;
      return {
        ticker: m.ticker,
        title: (m.title || "").slice(0, 80),
        yes_subtitle: m.yes_sub_title,
        last_price: lastPrice,
        fair_prob: est.fairProb,
        ev_pct: +evPct.toFixed(1),
        reason: est.reason,
        kalshi_url: `https://kalshi.com/markets?q=${encodeURIComponent(m.ticker)}`,
      };
    }));
    scored.push(...results.filter(Boolean));
  }

  const winners = scored
    .filter((s) => s.ev_pct >= minEv)
    .sort((a, b) => b.ev_pct - a.ev_pct)
    .slice(0, limit);

  return NextResponse.json({
    ok: true,
    scanned: all.length,
    estimated: scored.length,
    winners_count: winners.length,
    min_ev: minEv,
    series,
    winners,
  });
}
