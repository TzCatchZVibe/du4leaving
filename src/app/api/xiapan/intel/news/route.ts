// /api/xiapan/intel/news
//
// V0.60 · 真 alpha 新闻聚合
// 优先 · CryptoPanic (free 50/hr) → nirholas/free-crypto-news (no-auth fallback)
//        Wallstreet CN 中文财经快讯 (TZ 双语优势)
// 5 分钟缓存 · 抽 ticker · sentiment · 18 lang
//
// 用户 directive 研究 · 这套 + Polymarket Gamma + Kalshi 是真 alpha · 不是那 5 个 RSS 聚合器

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 300;

interface LinkedMarket {
  platform: "polymarket" | "kalshi";
  title: string;
  url: string;
  yes_price?: number;        // cents
  vol_24h?: number;
  match_score: number;       // 0-100 关联度
}

interface IntelNewsItem {
  source: string;            // "CryptoPanic" / "Wallstreet CN" / "nirholas"
  source_kind: string;       // "crypto" | "macro_cn" | "macro_global"
  title: string;
  body?: string;
  url: string;
  ts: string;                // ISO
  age_minutes: number;
  lang: string;              // "en" / "zh" / "..."
  sentiment?: "positive" | "negative" | "neutral";
  currencies?: string[];
  tickers?: string[];        // 自动从 title 抽
  linked_markets?: LinkedMarket[];   // V0.62 · 关联到的活跃市场
}

// ───────── CryptoPanic ─────────

interface PanicPost {
  id: number;
  title: string;
  url: string;
  source?: { domain?: string; title?: string };
  published_at?: string;
  votes?: { positive?: number; negative?: number; toxic?: number };
  currencies?: Array<{ code?: string }>;
  domain?: string;
}

async function fetchCryptoPanic(): Promise<IntelNewsItem[]> {
  const token = process.env.CRYPTOPANIC_TOKEN;
  if (!token) return [];           // 没 key 直接跳 · 留 nirholas 顶上
  try {
    const r = await fetch(
      `https://cryptopanic.com/api/v1/posts/?auth_token=${token}&public=true&kind=news`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json() as { results?: PanicPost[] };
    const now = Date.now();
    return (d.results ?? []).slice(0, 30).map((p) => {
      const ts = p.published_at ?? new Date().toISOString();
      const age = Math.round((now - new Date(ts).getTime()) / 60_000);
      const pos = p.votes?.positive ?? 0;
      const neg = p.votes?.negative ?? 0;
      let sentiment: "positive" | "negative" | "neutral" = "neutral";
      if (pos > neg + 1) sentiment = "positive";
      else if (neg > pos + 1) sentiment = "negative";
      return {
        source: "CryptoPanic",
        source_kind: "crypto",
        title: p.title,
        url: p.url,
        ts,
        age_minutes: age,
        lang: "en",
        sentiment,
        currencies: p.currencies?.map((c) => c.code ?? "").filter(Boolean) ?? [],
      };
    });
  } catch {
    return [];
  }
}

// ───────── nirholas/free-crypto-news (no-auth fallback) ─────────

async function fetchNirholas(): Promise<IntelNewsItem[]> {
  try {
    const r = await fetch("https://cryptocurrency.cv/api/news/feed?limit=30", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const d = await r.json() as { news?: Array<{ title: string; url: string; published_at?: string; source?: string; language?: string; sentiment?: string }> };
    const now = Date.now();
    return (d.news ?? []).slice(0, 30).map((n) => {
      const ts = n.published_at ?? new Date().toISOString();
      return {
        source: n.source ?? "nirholas",
        source_kind: "crypto",
        title: n.title,
        url: n.url,
        ts,
        age_minutes: Math.round((now - new Date(ts).getTime()) / 60_000),
        lang: (n.language ?? "en").slice(0, 2),
        sentiment: (n.sentiment as "positive" | "negative" | "neutral" | undefined) ?? "neutral",
      };
    });
  } catch {
    return [];
  }
}

// ───────── Wallstreet CN 财联社 (中文财经快讯) ─────────
// 双语 alpha · 用 newsnow 自部署 / 直接抓
// 这里 stub · 等 Mac mini 自部署 newsnow 后填 base URL

async function fetchWallstreetCN(): Promise<IntelNewsItem[]> {
  const newsnowBase = process.env.NEWSNOW_BASE_URL;          // e.g. http://192.168.1.100:4444
  if (!newsnowBase) {
    return [];                                                // 没自部署就跳
  }
  try {
    const r = await fetch(`${newsnowBase}/api/s?id=wallstreetcn-quick`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return [];
    const d = await r.json() as { items?: Array<{ id: string; title: string; url: string; pubDate?: number; extra?: { info?: string } }> };
    const now = Date.now();
    return (d.items ?? []).slice(0, 20).map((it) => {
      const tsMs = it.pubDate ?? now;
      const ts = new Date(tsMs).toISOString();
      return {
        source: "Wallstreet CN",
        source_kind: "macro_cn",
        title: it.title,
        body: it.extra?.info,
        url: it.url,
        ts,
        age_minutes: Math.round((now - tsMs) / 60_000),
        lang: "zh",
      };
    });
  } catch {
    return [];
  }
}

// ───────── 自动抽 ticker ─────────

const TICKER_REGEX = /\b(KX[A-Z0-9]{2,}|[A-Z]{2,5})\b/g;

function autoExtractTickers(text: string): string[] {
  const known = new Set([
    "BTC", "ETH", "SOL", "DOGE", "XRP", "ADA", "TRUMP", "NBA", "NFL", "MLB",
    "FOMC", "CPI", "GDP", "FED", "ECB", "BOJ", "USD", "EUR", "JPY",
  ]);
  const out: string[] = [];
  for (const m of text.matchAll(TICKER_REGEX)) {
    const t = m[0];
    if (t.startsWith("KX") || known.has(t)) {
      if (!out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, 5);
}

// V0.62 · 拉当前活跃市场用做 keyword 关联
const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

interface MarketCandidate {
  platform: "polymarket" | "kalshi";
  title: string;
  url: string;
  yes_price?: number;
  vol_24h?: number;
  tokens: Set<string>;       // title 分词后的 keyword set · 给关联用
}

function tokenize(s: string): Set<string> {
  const lower = s.toLowerCase();
  // ASCII 词 ≥3 字 + 中文字符块
  const stop = new Set(["the","a","an","vs","and","or","to","in","of","on","for","win","wins","game","match","be","is","will","be"]);
  const out = new Set<string>();
  for (const w of (lower.match(/[a-z][a-z0-9]+/gi) ?? [])) {
    if (w.length >= 3 && !stop.has(w)) out.add(w);
  }
  for (const c of (lower.match(/[一-龥]+/g) ?? [])) {
    out.add(c);
  }
  return out;
}

async function fetchMarketCandidates(): Promise<MarketCandidate[]> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/intel/markets?limit=40`, { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { markets?: Array<{ platform: "polymarket"|"kalshi"; title: string; url: string; best_yes_price?: number; vol_24h?: number }> };
    return (d.markets ?? []).map((m) => ({
      platform: m.platform,
      title: m.title,
      url: m.url,
      yes_price: m.best_yes_price,
      vol_24h: m.vol_24h,
      tokens: tokenize(m.title),
    }));
  } catch {
    return [];
  }
}

function linkMarkets(item: IntelNewsItem, candidates: MarketCandidate[]): LinkedMarket[] {
  const newsTokens = tokenize(`${item.title} ${item.body ?? ""}`);
  if (newsTokens.size === 0) return [];
  const scored = candidates.map((c) => {
    let overlap = 0;
    for (const t of c.tokens) if (newsTokens.has(t)) overlap++;
    const denom = Math.min(c.tokens.size, newsTokens.size);
    const score = denom > 0 ? (overlap / denom) * 100 : 0;
    return { c, score };
  });
  return scored
    .filter((s) => s.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({
      platform: s.c.platform,
      title: s.c.title,
      url: s.c.url,
      yes_price: s.c.yes_price,
      vol_24h: s.c.vol_24h,
      match_score: Math.round(s.score),
    }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "30", 10));
  const langFilter = url.searchParams.get("lang");
  const linkMode = url.searchParams.get("link") !== "false";   // 默认开启 · ?link=false 关

  try {
    const [panic, nir, wsj, mkts] = await Promise.all([
      fetchCryptoPanic(),
      fetchNirholas(),
      fetchWallstreetCN(),
      linkMode ? fetchMarketCandidates() : Promise.resolve([] as MarketCandidate[]),
    ]);

    let merged = [...panic, ...nir, ...wsj];

    // 自动抽 ticker
    merged = merged.map((it) => ({
      ...it,
      tickers: it.tickers ?? autoExtractTickers(`${it.title} ${it.body ?? ""}`),
    }));

    // V0.62 · 关联到 active 市场
    if (linkMode && mkts.length > 0) {
      merged = merged.map((it) => ({
        ...it,
        linked_markets: linkMarkets(it, mkts),
      }));
    }

    // 去重 (按 url)
    const seen = new Set<string>();
    merged = merged.filter((it) => {
      if (seen.has(it.url)) return false;
      seen.add(it.url);
      return true;
    });

    // 排序 · 最新 + sentiment 极性高的先
    merged.sort((a, b) => {
      if (a.age_minutes !== b.age_minutes) return a.age_minutes - b.age_minutes;
      const sentScore = (s?: string) => s === "positive" ? 1 : s === "negative" ? -1 : 0;
      return Math.abs(sentScore(b.sentiment)) - Math.abs(sentScore(a.sentiment));
    });

    const filtered = langFilter
      ? merged.filter((it) => it.lang === langFilter)
      : merged;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        cryptopanic: panic.length,
        nirholas: nir.length,
        wallstreet_cn: wsj.length,
        total: merged.length,
        returned: Math.min(limit, filtered.length),
        cryptopanic_enabled: !!process.env.CRYPTOPANIC_TOKEN,
        wallstreet_cn_enabled: !!process.env.NEWSNOW_BASE_URL,
      },
      news: filtered.slice(0, limit),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
