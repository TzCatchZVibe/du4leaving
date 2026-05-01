// /api/xiapan/picks
//
// 信号融合推送 · "随时筛选出适合赌的"
// 用户 directive · "要帮我随时筛选出适合赌的"
//
// 评分维度 (0-100)
//   edge_pp       40 · 便宜分 (你模型 vs Kalshi)
//   kelly         20 · 仓位指标
//   liquidity     15 · vol24 + OI · 能进能出
//   spread        10 · spread 越紧越好
//   level boost   10 · live-edge 已分 strong / watch / skip
//   live context  +5 · 在打 (matched live story) +5
//
// 输出 · 候选数 + 排序 + reasons[] 供 UI 一句话解释

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface EdgeRow {
  marketTicker: string;
  team1?: string;
  team2?: string;
  starts_at?: string;
  myEdgePp?: number;
  direction?: string;
  buySide?: string;
  buyPriceC?: number;
  spread?: number;
  vol24?: number;
  oi?: number;
  status?: string;
  kelly?: number;
  kellySuggestStake?: number;
  level?: string;
}

interface LiveStory {
  sport: string;
  team1: string;
  team2: string;
  phase?: string;
}

interface Pick {
  ticker: string;
  title: string;
  buy_side: string;
  buy_price_c: number;
  score: number;
  edge_pp: number;
  kelly: number;
  kelly_stake: number;
  vol_24: number;
  oi: number;
  spread: number;
  level: string;
  is_live: boolean;
  reasons: string[];
}

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";

async function fetchEdgeRows(): Promise<EdgeRow[]> {
  try {
    const r = await fetch(
      `${baseURL.startsWith("http") ? baseURL : `https://${baseURL}`}/api/xiapan/live-edge`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const j = await r.json();
    return (j.rows || []) as EdgeRow[];
  } catch {
    return [];
  }
}

async function fetchLiveStories(): Promise<LiveStory[]> {
  try {
    const r = await fetch(
      `${baseURL.startsWith("http") ? baseURL : `https://${baseURL}`}/api/xiapan/live`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const j = await r.json();
    return (j.stories || []) as LiveStory[];
  } catch {
    return [];
  }
}

interface CrossArbBoost {
  k_ticker: string;
  signal: string;            // "kalshi_cheap_yes" | "kalshi_cheap_no" | "neutral"
  edge_pp: number;
}

async function fetchCrossArb(): Promise<CrossArbBoost[]> {
  try {
    const r = await fetch(
      `${baseURL.startsWith("http") ? baseURL : `https://${baseURL}`}/api/xiapan/cross-arb?minDiv=3&limit=20`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const j = await r.json();
    return ((j.pairs || []) as Array<{ k_ticker: string; signal: string; edge_pp: number }>).map((p) => ({
      k_ticker: p.k_ticker,
      signal: p.signal,
      edge_pp: p.edge_pp,
    }));
  } catch {
    return [];
  }
}

interface MentionPick {
  ticker: string;
  title: string;
  buy_side: string;
  buy_price_c: number;
  edge_pp: number;
  confidence: string;
  bucket: string;
  reasoning?: string;
  vol_24: number;
  speaker: string;
  category: string;
}

/// V0.44 · 拉 mention markets · 折成 Pick 候选
/// 仅当 mention 有 enrichment edge_pp 时才纳入 picks
async function fetchMentionPicks(): Promise<MentionPick[]> {
  try {
    const r = await fetch(
      `${baseURL.startsWith("http") ? baseURL : `https://${baseURL}`}/api/xiapan/mentions?enrich=true`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const j = await r.json();
    const events = (j.events || []) as Array<{
      speaker: string;
      category: string;
      title: string;
      markets: Array<{
        ticker: string;
        target_word: string;
        yes_ask: number;
        no_ask: number;
        vol_24: number;
        bucket: string;
        edge_pp?: number;
        confidence?: string;
        reasoning?: string;
      }>;
    }>;

    const picks: MentionPick[] = [];
    for (const ev of events) {
      for (const m of ev.markets) {
        const edge = m.edge_pp ?? 0;
        // 双边都拿 · |edge| ≥ 8 才纳入 (LLM 估有噪音 · 高阈过滤)
        if (Math.abs(edge) < 8) continue;
        const isPositive = edge > 0;
        const buy_side = isPositive ? "yes" : "no";
        const buy_price = isPositive ? m.yes_ask : m.no_ask;
        if (buy_price <= 0) continue;

        picks.push({
          ticker: m.ticker,
          title: `${ev.speaker} · "${m.target_word}"`,
          buy_side,
          buy_price_c: buy_price,
          edge_pp: Math.abs(edge),
          confidence: m.confidence ?? "low",
          bucket: m.bucket,
          reasoning: m.reasoning,
          vol_24: m.vol_24,
          speaker: ev.speaker,
          category: ev.category,
        });
      }
    }
    return picks;
  } catch {
    return [];
  }
}

function scoreMentionPick(mp: MentionPick): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // edge (50)
  if (mp.edge_pp >= 25) {
    score += 50;
    reasons.push(`AI 估 ${mp.edge_pp.toFixed(0)}pp 错价 · 强信号`);
  } else if (mp.edge_pp >= 15) {
    score += 35;
    reasons.push(`AI 估 ${mp.edge_pp.toFixed(0)}pp 错价`);
  } else {
    score += 18;
    reasons.push(`AI 估 ${mp.edge_pp.toFixed(0)}pp 错价 · 弱`);
  }

  // confidence (15)
  if (mp.confidence === "high") {
    score += 15;
    reasons.push("AI 把握高");
  } else if (mp.confidence === "med") {
    score += 8;
  } else {
    reasons.push("AI 把握低 · 自核");
  }

  // category prior (10) · catboy 边在政论 + 文化 强
  if (mp.category === "political") {
    score += 10;
    reasons.push("政论场景");
  } else if (mp.category === "cultural") {
    score += 8;
    reasons.push("文化场景");
  } else if (mp.category === "earnings") {
    score += 6;
  }

  // bucket prior (10) · long_shot + 高 edge = 高方差金矿
  if (mp.bucket === "long_shot" && mp.edge_pp >= 20) {
    score += 10;
    reasons.push("冷门 · 高方差桶");
  } else if (mp.bucket === "junk_bond" && mp.edge_pp >= 10) {
    score += 7;
    reasons.push("近必中 · junk bond 桶");
  }

  // vol (5)
  if (mp.vol_24 >= 500) {
    score += 5;
    reasons.push("流动性可");
  } else if (mp.vol_24 >= 100) {
    score += 2;
  }

  // 标记来源
  reasons.unshift("◇ Mention 通道");

  return { score: Math.min(100, score), reasons };
}

function scoreRow(
  r: EdgeRow,
  matchedStory: LiveStory | null,
  arb: CrossArbBoost | null = null
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Edge (40)
  const ep = r.myEdgePp ?? 0;
  if (ep >= 4) {
    score += 40;
    reasons.push(`便宜分 +${ep.toFixed(1)}pp`);
  } else if (ep >= 2) {
    score += 25;
    reasons.push(`便宜分 +${ep.toFixed(1)}pp`);
  } else if (ep >= 1) {
    score += 12;
    reasons.push(`微便宜 +${ep.toFixed(1)}pp`);
  }

  // Kelly (20)
  const k = r.kelly ?? 0;
  if (k >= 0.05) {
    score += 20;
    reasons.push(`Kelly ${(k * 100).toFixed(1)}%`);
  } else if (k >= 0.02) {
    score += 12;
    reasons.push(`Kelly ${(k * 100).toFixed(1)}%`);
  } else if (k > 0) {
    score += 4;
  }

  // Liquidity (15)
  const vol = r.vol24 ?? 0;
  const oi = r.oi ?? 0;
  if (vol >= 5000 && oi >= 10000) {
    score += 15;
    reasons.push("流动性厚 · 进出顺");
  } else if (vol >= 2000 && oi >= 3000) {
    score += 9;
    reasons.push("流动性中");
  } else if (vol >= 500) {
    score += 3;
  }

  // Spread (10)
  const sp = r.spread ?? 99;
  if (sp <= 2) {
    score += 10;
    reasons.push("点差紧 · 摩擦低");
  } else if (sp <= 4) {
    score += 5;
  }

  // Level boost (10)
  if (r.level === "strong") {
    score += 10;
    reasons.push("引擎判 · strong");
  } else if (r.level === "watch") {
    score += 4;
  }

  // Live context (5)
  if (matchedStory) {
    score += 5;
    const ph = matchedStory.phase ? ` · ${matchedStory.phase}` : "";
    reasons.push(`在打${ph}`);
  }

  // Cross-platform divergence boost (max 12)
  // 视频 zAEFF6qDSLk 启发 · Polymarket 跟 Kalshi 价差是真的 alpha
  if (arb && (arb.signal === "kalshi_cheap_yes" || arb.signal === "kalshi_cheap_no")) {
    const ep = arb.edge_pp;
    const direction = arb.signal === "kalshi_cheap_yes" ? "YES" : "NO";
    if (ep >= 6) {
      score += 12;
      reasons.push(`Polymarket 比 Kalshi ${direction} 高 ${ep.toFixed(1)}pp · 强分歧`);
    } else if (ep >= 4) {
      score += 7;
      reasons.push(`Polymarket 看 ${direction} 高 ${ep.toFixed(1)}pp`);
    } else if (ep >= 3) {
      score += 3;
      reasons.push(`轻微分歧 ${ep.toFixed(1)}pp`);
    }
  }

  return { score: Math.min(100, score), reasons };
}

function matchStory(row: EdgeRow, stories: LiveStory[]): LiveStory | null {
  const t1 = (row.team1 || "").toLowerCase();
  const t2 = (row.team2 || "").toLowerCase();
  if (!t1 && !t2) return null;
  return (
    stories.find((s) => {
      const a = s.team1.toLowerCase();
      const b = s.team2.toLowerCase();
      return (
        (t1.length >= 2 && (a.includes(t1) || b.includes(t1))) ||
        (t2.length >= 2 && (a.includes(t2) || b.includes(t2)))
      );
    }) || null
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minScore = parseInt(url.searchParams.get("min") ?? "45", 10);
  const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "5", 10));

  try {
    const [rows, stories, arbs, mentionPicks] = await Promise.all([
      fetchEdgeRows(),
      fetchLiveStories(),
      fetchCrossArb(),
      fetchMentionPicks(),
    ]);

    const arbByTicker = new Map(arbs.map((a) => [a.k_ticker, a]));

    const candidates: Pick[] = rows
      .filter((r) => (r.status === "active" || r.status === "open"))
      .map((r) => {
        const matched = matchStory(r, stories);
        const arb = arbByTicker.get(r.marketTicker) ?? null;
        const { score, reasons } = scoreRow(r, matched, arb);
        const team1 = r.team1 ?? "";
        const team2 = r.team2 ?? "";
        const title = team1 && team2 ? `${team1} vs ${team2}` : team1 || team2 || r.marketTicker;
        return {
          ticker: r.marketTicker,
          title,
          buy_side: r.direction ?? r.buySide ?? "yes",
          buy_price_c: r.buyPriceC ?? 0,
          score,
          edge_pp: r.myEdgePp ?? 0,
          kelly: r.kelly ?? 0,
          kelly_stake: r.kellySuggestStake ?? 0,
          vol_24: r.vol24 ?? 0,
          oi: r.oi ?? 0,
          spread: r.spread ?? 0,
          level: r.level ?? "watch",
          is_live: matched !== null,
          reasons,
        };
      })
      .sort((a, b) => b.score - a.score);

    // V0.44 · fold mention picks 进总候选
    for (const mp of mentionPicks) {
      const { score, reasons } = scoreMentionPick(mp);
      candidates.push({
        ticker: mp.ticker,
        title: mp.title,
        buy_side: mp.buy_side,
        buy_price_c: mp.buy_price_c,
        score,
        edge_pp: mp.edge_pp,
        kelly: 0,
        kelly_stake: 0,
        vol_24: mp.vol_24,
        oi: 0,
        spread: 0,
        level: "watch",
        is_live: false,
        reasons,
      });
    }
    candidates.sort((a, b) => b.score - a.score);

    const picks = candidates.filter((p) => p.score >= minScore).slice(0, limit);
    const avg = picks.length
      ? picks.reduce((s, p) => s + p.score, 0) / picks.length
      : 0;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        candidate_count: candidates.length,
        pick_count: picks.length,
        avg_score: Number(avg.toFixed(1)),
        min_score: minScore,
      },
      picks,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
