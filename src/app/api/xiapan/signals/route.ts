// /api/xiapan/signals
//
// V0.46 · Glint-style 信号 feed (轻量版)
// 视频 n3PkwmEZ0aQ 研究 · Glint 是 Bloomberg-Terminal-for-prediction-markets ·
//   核心是实时 X / Telegram / OSINT 信号 < 30s 映射到受影响合约
//
// 我们做免费版:
//   · Reddit r/Polymarket + r/sportsbook + r/Kalshi · 免 API key
//   · 5 min 缓存 · 滚动取近 6h
//   · 抽 ticker / cashtag / 关键词
//   · 排序: score + recency

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;
export const revalidate = 300; // 5min

interface RedditPost {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    permalink?: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    subreddit?: string;
    link_flair_text?: string;
    author?: string;
  };
}

interface SignalItem {
  id: string;
  source: string;             // "r/Polymarket" | "r/sportsbook" | "r/Kalshi"
  title: string;
  body?: string;
  url: string;
  score: number;
  comments: number;
  age_minutes: number;
  flair?: string;
  author?: string;
  // 抽取
  tickers: string[];           // 出现的 KX*/PRE/类 ticker
  category: string;            // "political" | "sports" | "crypto" | "economy" | "other"
  signal_strength: number;     // 0-100 综合
}

const SUBREDDITS = ["Polymarket", "Kalshi", "sportsbook", "PredictionMarkets"];

const HEADERS: HeadersInit = {
  "User-Agent": "du4leaving:v0.46 (by /u/du4leaving)",
};

async function fetchSubreddit(name: string): Promise<RedditPost[]> {
  try {
    const r = await fetch(
      `https://www.reddit.com/r/${name}/new.json?limit=30`,
      { headers: HEADERS, cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json() as { data?: { children?: RedditPost[] } };
    return d.data?.children ?? [];
  } catch {
    return [];
  }
}

const TICKER_REGEX = /\b(KX[A-Z0-9]{2,}|0x[a-fA-F0-9]{6,})\b/g;
const CASHTAG_REGEX = /\$[A-Z]{2,5}\b/g;

function extractTickers(text: string): string[] {
  const ts = new Set<string>();
  for (const m of text.matchAll(TICKER_REGEX)) ts.add(m[0]);
  for (const m of text.matchAll(CASHTAG_REGEX)) ts.add(m[0]);
  return Array.from(ts).slice(0, 5);
}

function classifyCategory(text: string, sub: string): string {
  const lower = text.toLowerCase();
  if (sub.toLowerCase().includes("sportsbook")) return "sports";
  if (/(election|trump|biden|congress|senate|fed|fomc|powell|gop|dem|debate)/i.test(lower)) return "political";
  if (/(btc|bitcoin|eth|crypto|coin|polygon)/i.test(lower)) return "crypto";
  if (/(jobs|cpi|gdp|inflation|rate|earnings|stock|market)/i.test(lower)) return "economy";
  if (/(nba|nfl|mlb|nhl|tennis|soccer|fight|ufc)/i.test(lower)) return "sports";
  return "other";
}

function signalStrength(p: RedditPost, ageMin: number, tickerCount: number): number {
  const score = p.data?.score ?? 0;
  const comments = p.data?.num_comments ?? 0;

  // recency decay · 60min 内 1.0 · 6h 衰到 0.3
  const recency = Math.max(0.3, 1.0 - ageMin / (6 * 60));

  // base · score 0-50 · comments 0-30
  const base = Math.min(50, score * 0.5) + Math.min(30, comments * 0.6);

  // ticker bonus
  const tickBonus = tickerCount > 0 ? 15 : 0;

  return Math.round(Math.min(100, (base + tickBonus) * recency));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minStrength = parseInt(url.searchParams.get("min") ?? "20", 10);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));
  const categoryFilter = url.searchParams.get("category");

  try {
    const arrs = await Promise.all(SUBREDDITS.map(fetchSubreddit));
    const items: SignalItem[] = [];
    const now = Date.now() / 1000;

    for (let i = 0; i < arrs.length; i++) {
      const sub = SUBREDDITS[i];
      for (const p of arrs[i]) {
        const d = p.data;
        if (!d || !d.title) continue;

        const created = d.created_utc ?? now;
        const ageMin = (now - created) / 60;
        if (ageMin > 6 * 60) continue;        // 6h 以上太老

        const text = `${d.title} ${d.selftext ?? ""}`;
        const tickers = extractTickers(text);
        const category = classifyCategory(text, sub);
        const strength = signalStrength(p, ageMin, tickers.length);

        if (strength < minStrength) continue;

        items.push({
          id: d.id ?? `${sub}-${created}`,
          source: `r/${sub}`,
          title: d.title.slice(0, 200),
          body: (d.selftext ?? "").slice(0, 240),
          url: `https://reddit.com${d.permalink ?? ""}`,
          score: d.score ?? 0,
          comments: d.num_comments ?? 0,
          age_minutes: Math.round(ageMin),
          flair: d.link_flair_text ?? undefined,
          author: d.author ?? undefined,
          tickers,
          category,
          signal_strength: strength,
        });
      }
    }

    // 排序: signal_strength 降 · age 升
    items.sort((a, b) => {
      if (b.signal_strength !== a.signal_strength) return b.signal_strength - a.signal_strength;
      return a.age_minutes - b.age_minutes;
    });

    const filtered = categoryFilter && categoryFilter !== "all"
      ? items.filter((it) => it.category === categoryFilter)
      : items;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        total: items.length,
        filtered: filtered.length,
        by_source: SUBREDDITS.map((s, i) => ({ source: `r/${s}`, count: arrs[i].length })),
      },
      signals: filtered.slice(0, limit),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
