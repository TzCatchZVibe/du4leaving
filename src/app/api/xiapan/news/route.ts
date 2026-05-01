// 虾盘 · 赛事新闻聚合 + OpenAI 中文翻译
// 全中文 · 人名队名保留原文
//
// 用法 · /api/xiapan/news?topic=lol|nba|mlb|nfl|nhl|tennis|soccer|cs|valorant

import { NextResponse } from "next/server";

export const revalidate = 1800; // 30min ISR cache 防 rate limit
export const maxDuration = 60;

// 内存缓存 · 翻译结果 (减 OpenAI cost)
const _translationCache = new Map<string, { ts: number; cn: string }>();
const TRANSLATION_TTL = 24 * 3600 * 1000; // 24h

async function translateBatch(titles: string[]): Promise<string[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || titles.length === 0) return titles;

  // 查缓存
  const out: string[] = [];
  const needTranslate: number[] = [];
  const needText: string[] = [];
  for (let i = 0; i < titles.length; i++) {
    const cached = _translationCache.get(titles[i]);
    if (cached && Date.now() - cached.ts < TRANSLATION_TTL) {
      out[i] = cached.cn;
    } else {
      out[i] = titles[i]; // fallback
      needTranslate.push(i);
      needText.push(titles[i]);
    }
  }
  if (needText.length === 0) return out;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "你是体育/电竞资讯翻译。把英文标题翻成简体中文,口语化。规则:\n1. 战队名/选手名/赛事代号 (T1, Faker, LCK, BLG, NBA, KD等) 保留原文\n2. 数字保留\n3. 不要解释,直接给译文\n4. 每行一条,顺序对应\n5. 长度大致一致 · 不要扩写\n6. 中文叙述要可读 · 不要直译生硬",
          },
          {
            role: "user",
            content: needText.map((t, i) => `${i + 1}. ${t}`).join("\n"),
          },
        ],
      }),
    });
    if (r.ok) {
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content || "";
      const lines = text
        .split("\n")
        .map((l: string) => l.replace(/^\s*\d+\.\s*/, "").trim())
        .filter(Boolean);
      for (let i = 0; i < needTranslate.length; i++) {
        const idx = needTranslate[i];
        const cn = lines[i] || titles[idx];
        out[idx] = cn;
        _translationCache.set(titles[idx], { ts: Date.now(), cn });
      }
    }
  } catch {
    // fallback 用原文
  }
  return out;
}

const SUBREDDITS: Record<string, { subs: string[]; label: string; emoji: string }> = {
  lol: {
    subs: ["leagueoflegends", "LCK", "LCS", "LEC", "lpl"],
    label: "LOL",
    emoji: "🎮",
  },
  nba: { subs: ["nba", "nbadiscussion"], label: "NBA", emoji: "🏀" },
  mlb: { subs: ["baseball", "mlb"], label: "MLB", emoji: "⚾" },
  nfl: { subs: ["nfl"], label: "NFL", emoji: "🏈" },
  nhl: { subs: ["hockey"], label: "NHL", emoji: "🏒" },
  tennis: { subs: ["tennis"], label: "Tennis", emoji: "🎾" },
  soccer: { subs: ["soccer", "PremierLeague", "championsleague"], label: "Soccer", emoji: "⚽" },
  cs: { subs: ["GlobalOffensive"], label: "CS2", emoji: "🔫" },
  valorant: { subs: ["ValorantCompetitive", "VALORANT"], label: "VAL", emoji: "🎯" },
  dota: { subs: ["DotA2"], label: "Dota2", emoji: "⚔" },
  politics: { subs: ["politics"], label: "Politics", emoji: "🏛" },
};

type RedditPost = {
  title: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  link_flair_text?: string;
  is_self: boolean;
};

async function fetchSub(sub: string): Promise<RedditPost[]> {
  try {
    const r = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
      headers: {
        "User-Agent": "Xiapan/0.1 by /u/anonymous",
        Accept: "application/json",
      },
      next: { revalidate: 1800 },
    });
    if (!r.ok) return [];
    const d = await r.json();
    const children = d?.data?.children || [];
    return children
      .map((c: { data: RedditPost }) => c.data)
      .filter((p: RedditPost) => !!p.title);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topic = (url.searchParams.get("topic") || "lol").toLowerCase();
  const config = SUBREDDITS[topic];
  if (!config) {
    return NextResponse.json(
      { ok: false, error: `unknown topic: ${topic}`, available: Object.keys(SUBREDDITS) },
      { status: 400 }
    );
  }

  const allPosts: RedditPost[] = [];
  for (const sub of config.subs) {
    const posts = await fetchSub(sub);
    allPosts.push(...posts);
    if (allPosts.length >= 30) break;
  }

  // 去重 (按 url) + 按 score 排
  const seen = new Set<string>();
  const unique: RedditPost[] = [];
  for (const p of allPosts.sort((a, b) => b.score - a.score)) {
    const key = p.url || p.permalink;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
    if (unique.length >= 20) break;
  }

  // 批量翻译 (人名/队名保留原文)
  const titles = unique.map((p) => p.title);
  const translated = await translateBatch(titles);

  return NextResponse.json({
    ok: true,
    topic,
    label: config.label,
    emoji: config.emoji,
    generatedAt: new Date().toISOString(),
    posts: unique.map((p, i) => ({
      title: translated[i] || p.title,
      titleEn: p.title,
      url: p.is_self
        ? `https://reddit.com${p.permalink}`
        : p.url,
      permalink: `https://reddit.com${p.permalink}`,
      score: p.score,
      comments: p.num_comments,
      ts: new Date(p.created_utc * 1000).toISOString(),
      sub: p.subreddit,
      flair: p.link_flair_text || null,
    })),
  });
}
