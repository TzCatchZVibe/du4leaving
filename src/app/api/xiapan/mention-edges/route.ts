// /api/xiapan/mention-edges
//
// V0.72 W2 Day 5 · Mention engine 适配 · 出 Signal[] 给 fusion
// 复用 /api/xiapan/mentions?enrich=true · 转 Signal[] (C 池凸性)
//
// Catboy mention-market 是凸性桶最好的 alpha 源之一
// (long-shot 押注 · hit 25-35% · 击中赔率 5-15x)

import { NextResponse } from "next/server";
import type { Signal } from "@/lib/xiapan/百川/fusion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const baseURL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3001";

interface MentionMarket {
  ticker: string;
  target_word: string;
  yes_ask: number;
  no_ask: number;
  vol_24: number;
  bucket: string;
  edge_pp?: number;
  confidence?: string;
  reasoning?: string;
}

interface MentionEvent {
  speaker: string;
  category: string;
  title: string;
  markets: MentionMarket[];
}

export async function GET() {
  try {
    const r = await fetch(`${baseURL}/api/xiapan/mentions?enrich=true`, {
      cache: "no-store",
      signal: AbortSignal.timeout(50_000),
    });
    if (!r.ok) {
      return NextResponse.json({
        ok: false,
        error: `mentions endpoint ${r.status}`,
        signals: [],
      });
    }
    const d = await r.json();
    const events = (d.events ?? []) as MentionEvent[];

    const signals: Signal[] = [];
    const marketData: Record<string, { vol_24: number; spread_c: number; market_p: number }> = {};

    for (const ev of events) {
      for (const m of ev.markets) {
        const edge = m.edge_pp ?? 0;
        // 凸性桶高门槛 · |edge| ≥ 12pp 才触发
        if (Math.abs(edge) < 12) continue;
        if (m.vol_24 < 50) continue;
        const direction: 1 | -1 = edge > 0 ? 1 : -1;
        const buy_price = direction === 1 ? m.yes_ask : m.no_ask;
        if (buy_price <= 0 || buy_price >= 100) continue;

        const market_p = m.yes_ask / 100;
        const fair_p = market_p + edge / 100;
        const conf =
          m.confidence === "high" ? 0.65 :
          m.confidence === "med"  ? 0.55 :
                                    0.52;

        signals.push({
          source: "mention-engine",
          ticker: m.ticker,
          direction,
          predicted_p: Math.max(0.01, Math.min(0.99, fair_p)),
          confidence: conf,
          reason: `${ev.speaker} · "${m.target_word}" · ${m.bucket} · LLM 估错价 ${edge.toFixed(0)}pp · ${m.confidence ?? "?"} 把握`,
          ts: new Date().toISOString(),
          data: {
            speaker: ev.speaker,
            category: ev.category,
            target_word: m.target_word,
            bucket: m.bucket,
            confidence: m.confidence,
            reasoning: m.reasoning?.slice(0, 200),
          },
        });

        marketData[m.ticker] = {
          vol_24: m.vol_24,
          spread_c: 0,         // mentions 没暴露 bid · 假设 0
          market_p,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        total_events: events.length,
        total_markets: events.reduce((s, ev) => s + ev.markets.length, 0),
        signals: signals.length,
      },
      signals,
      market_data: marketData,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, signals: [] });
  }
}
