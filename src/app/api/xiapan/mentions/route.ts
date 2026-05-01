// /api/xiapan/mentions
//
// V0.41 · Catboy mention-market lane (iitoebXttn0 案例)
// Esoteric Catboy ($872K top-100 Kalshi) 主要赚的就是这类盘 ·
//   "X 在 Y 事件里会不会说某词 N 次"
//
// 4 个 Catboy 边 ·
//   1. 叙事偏 · 性感词被高估
//   2. 规则文本难懂 · 多数人没看仔细
//   3. 没人查历史 · 他抓 15-20 场词频
//   4. 直播延迟窗口
//
// 此 endpoint 做 1 + 2 + (启发) 3 ·
//   · 列所有 mention 系列 + 当前 open markets
//   · 解析: speaker / event / target_word
//   · 桶化: long_shot / middle / junk_bond
//   · 用户研究词频 → 自己定 edge

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KAL = "https://api.elections.kalshi.com/trade-api/v2";

interface KalSeries {
  ticker: string;
  title?: string;
  category?: string;
  frequency?: string;
}

interface KalEvent {
  event_ticker: string;
  series_ticker?: string;
  title?: string;
  sub_title?: string;
  category?: string;
}

interface KalMarket {
  ticker: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume_24h?: number;
  open_interest?: number;
  expected_expiration_time?: string;
  rules_primary?: string;
}

interface MentionMarket {
  ticker: string;
  target_word: string;            // yes_sub_title (清洗后)
  yes_ask: number;
  yes_bid: number;
  no_ask: number;
  no_bid: number;
  vol_24: number;
  oi: number;
  bucket: string;                 // "long_shot" | "middle" | "junk_bond"
  bucket_label: string;
  expires_at?: string;
  rule: string;

  // V0.42 enrichment (?enrich=true 时填)
  estimated_prob?: number;        // 0-1 · LLM 估计的实际概率
  confidence?: string;             // "low" | "med" | "high"
  edge_pp?: number;               // estimated_prob*100 - yes_ask · 正 = 便宜
  reasoning?: string;             // LLM 一句话理由
}

interface MentionEvent {
  event_ticker: string;
  series_ticker: string;
  speaker: string;                // 从 series 推断 (Bernie / Lucid / FTN ...)
  category: string;               // "political" | "earnings" | "cultural" | "other"
  title: string;
  sub_title?: string;
  expires_at?: string;
  markets: MentionMarket[];
}

const KEYWORD_REGEX = /(MENTION|WORD|SAY|SAID|SPEECH|UTTER|PRESSCONF)/i;

function classifySeries(s: KalSeries): { speaker: string; category: string } {
  const t = s.ticker.toUpperCase();
  const title = (s.title ?? "").toLowerCase();
  // 政治
  if (t.includes("BERNIE") || t.includes("BIANCO") || t.includes("AOC") || title.includes("congress") || title.includes("senator") || title.includes("political") || title.includes("press conf")) {
    return { speaker: extractSpeaker(s), category: "political" };
  }
  // 财报 mention
  if (t.includes("EARNINGSMENTION") || title.includes("earnings")) {
    return { speaker: extractSpeaker(s), category: "earnings" };
  }
  // 文化
  if (t.includes("OXFORD") || t.includes("WEF") || t.includes("FTN") || t.includes("DILLON") || t.includes("GOLDEN") || title.includes("podcast") || title.includes("award")) {
    return { speaker: extractSpeaker(s), category: "cultural" };
  }
  return { speaker: extractSpeaker(s), category: "other" };
}

function extractSpeaker(s: KalSeries): string {
  if (s.title) {
    // 用 series.title (e.g. "Bernie says" → "Bernie")
    const t = s.title.replace(/(say|said|mention|speech|press conf|earnings call|podcast)/gi, "").trim();
    if (t.length > 0) return t.split(/\s+/).slice(0, 4).join(" ");
  }
  return s.ticker;
}

function classifyBucket(yes_ask: number): { bucket: string; label: string } {
  if (yes_ask <= 0) return { bucket: "no_quote", label: "无报价" };
  if (yes_ask < 30) return { bucket: "long_shot", label: "冷门" };
  if (yes_ask <= 60) return { bucket: "middle", label: "中价" };
  if (yes_ask <= 90) return { bucket: "junk_bond", label: "高位" };
  return { bucket: "near_cert", label: "近必中" };
}

async function fetchAllMentionSeries(): Promise<KalSeries[]> {
  // /series 不直接支持 keyword filter · 拉一大页 + 客户端 filter
  try {
    const r = await fetch(`${KAL}/series?limit=1000`, { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json() as { series?: KalSeries[] };
    const all = d.series ?? [];
    return all.filter((s) => {
      const t = s.ticker.toUpperCase();
      const title = (s.title ?? "").toLowerCase();
      return KEYWORD_REGEX.test(t) || /\bsay|mention|word|speech|press/i.test(title);
    });
  } catch {
    return [];
  }
}

async function fetchOpenMarketsForSeries(series_ticker: string): Promise<KalMarket[]> {
  try {
    const r = await fetch(
      `${KAL}/markets?series_ticker=${series_ticker}&limit=50&status=open`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json() as { markets?: KalMarket[] };
    return d.markets ?? [];
  } catch {
    return [];
  }
}

async function fetchEventsForSeries(series_ticker: string): Promise<KalEvent[]> {
  try {
    const r = await fetch(
      `${KAL}/events?series_ticker=${series_ticker}&limit=20`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json() as { events?: KalEvent[] };
    return d.events ?? [];
  } catch {
    return [];
  }
}

async function pMap<T, R>(items: T[], fn: (x: T) => Promise<R>, conc: number): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try { out[i] = await fn(items[i]); }
      catch { out[i] = null as unknown as R; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, worker));
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryFilter = url.searchParams.get("category");      // "political" | "earnings" | "cultural" | "all"
  const bucketFilter = url.searchParams.get("bucket");          // "long_shot" | "middle" | "junk_bond" | "near_cert"
  const minVol = parseInt(url.searchParams.get("minVol") ?? "0", 10);
  const enrich = url.searchParams.get("enrich") === "true";     // V0.42 · LLM 估词频

  try {
    const allSeries = await fetchAllMentionSeries();

    // 限到 60 个 series · 减负载 · 优先 active 的
    const limited = allSeries.slice(0, 60);

    const eventsAndMarkets = await pMap(
      limited,
      async (s) => {
        const [events, markets] = await Promise.all([
          fetchEventsForSeries(s.ticker),
          fetchOpenMarketsForSeries(s.ticker),
        ]);
        return { series: s, events, markets };
      },
      6
    );

    // group markets by event_ticker
    const result: MentionEvent[] = [];
    for (const { series, events, markets } of eventsAndMarkets) {
      if (!markets || markets.length === 0) continue;
      const { speaker, category } = classifySeries(series);

      const byEvent = new Map<string, KalMarket[]>();
      for (const m of markets) {
        const evt = m.event_ticker || "";
        if (!byEvent.has(evt)) byEvent.set(evt, []);
        byEvent.get(evt)!.push(m);
      }

      for (const [evtTicker, evtMarkets] of byEvent) {
        const ev = events.find((e) => e.event_ticker === evtTicker);

        const evtMms: MentionMarket[] = evtMarkets.map((m) => {
          const yes_ask = m.yes_ask ?? 0;
          const { bucket, label } = classifyBucket(yes_ask);
          return {
            ticker: m.ticker,
            target_word: (m.yes_sub_title ?? m.title ?? "?").trim(),
            yes_ask,
            yes_bid: m.yes_bid ?? 0,
            no_ask: m.no_ask ?? 0,
            no_bid: m.no_bid ?? 0,
            vol_24: m.volume_24h ?? 0,
            oi: m.open_interest ?? 0,
            bucket,
            bucket_label: label,
            expires_at: m.expected_expiration_time,
            rule: (m.rules_primary ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
          };
        });

        // bucket filter (只保留至少一条命中)
        const filteredMms = bucketFilter
          ? evtMms.filter((mm) => mm.bucket === bucketFilter)
          : evtMms;
        if (filteredMms.length === 0) continue;

        result.push({
          event_ticker: evtTicker,
          series_ticker: series.ticker,
          speaker,
          category,
          title: ev?.title ?? evtMarkets[0].title ?? "",
          sub_title: ev?.sub_title,
          expires_at: filteredMms[0].expires_at,
          markets: filteredMms.sort((a, b) => b.yes_ask - a.yes_ask),
        });
      }
    }

    // category filter
    let filtered = categoryFilter && categoryFilter !== "all"
      ? result.filter((r) => r.category === categoryFilter)
      : result;

    // min vol filter (event-level · 任意 leg ≥ minVol 即留)
    if (minVol > 0) {
      filtered = filtered.filter((r) => r.markets.some((m) => m.vol_24 >= minVol));
    }

    // 排序: vol 降 · expires 升 (近的优先)
    filtered.sort((a, b) => {
      const aVol = Math.max(...a.markets.map((m) => m.vol_24));
      const bVol = Math.max(...b.markets.map((m) => m.vol_24));
      if (bVol !== aVol) return bVol - aVol;
      const aExp = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
      const bExp = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
      return aExp - bExp;
    });

    let topEvents = filtered.slice(0, 30);

    // V0.42 enrichment · LLM 估每词频率 → edge_pp
    if (enrich && topEvents.length > 0) {
      // 限上 limit 个 markets · 太多走得慢
      type EnrichItem = { speaker: string; word: string; context: string; ticker: string };
      const items: EnrichItem[] = [];
      const enrichLimit = 20;
      for (const ev of topEvents) {
        for (const m of ev.markets) {
          if (items.length >= enrichLimit) break;
          if (m.yes_ask <= 0) continue;
          items.push({
            speaker: ev.speaker,
            word: m.target_word,
            context: ev.title,
            ticker: m.ticker,
          });
        }
        if (items.length >= enrichLimit) break;
      }

      if (items.length > 0) {
        try {
          // 调内部 mention-freq POST
          const baseURL =
            process.env.NEXT_PUBLIC_BASE_URL ??
            process.env.VERCEL_URL ??
            "http://localhost:3001";
          const r = await fetch(
            `${baseURL.startsWith("http") ? baseURL : `https://${baseURL}`}/api/xiapan/mention-freq`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items }),
            }
          );
          if (r.ok) {
            const j = await r.json() as { ok: boolean; results?: Array<{ ticker: string; estimated_prob: number; confidence: string; reasoning: string }> };
            const byTicker = new Map((j.results ?? []).map(x => [x.ticker, x]));
            for (const ev of topEvents) {
              for (const m of ev.markets) {
                const f = byTicker.get(m.ticker);
                if (f) {
                  m.estimated_prob = f.estimated_prob;
                  m.confidence = f.confidence;
                  m.edge_pp = Number((f.estimated_prob * 100 - m.yes_ask).toFixed(1));
                  m.reasoning = f.reasoning;
                }
              }
            }
            // 重排 · 优先 edge_pp 大的事件
            topEvents.sort((a, b) => {
              const aMaxEdge = Math.max(...a.markets.map(m => m.edge_pp ?? -100));
              const bMaxEdge = Math.max(...b.markets.map(m => m.edge_pp ?? -100));
              return bMaxEdge - aMaxEdge;
            });
          }
        } catch {
          // enrichment 失败不致命
        }
      }
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        total_series: allSeries.length,
        evaluated_series: limited.length,
        event_count: result.length,
        filtered_count: filtered.length,
        enriched: enrich,
      },
      events: topEvents,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
