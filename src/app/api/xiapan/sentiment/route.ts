// /api/xiapan/sentiment?ticker=KXLOL...&team=T1
//
// 反 FOMO sentiment check · 押前调用 · 看是否市场情绪过热
//
// 信号 ·
// 1. Kalshi /events 该 market vol_24h 比基线高多少 (热度 spike)
// 2. Reddit r/leagueoflegends 等 sub 该队提及频率 (近 24h 上 trending)
// 3. 综合 → score 0-1 · 高 = FOMO 风险高 · 你 edge 可能被吹大
//
// 输出 ·
//   { ok, score, reason: 一句话, vol_spike: x.x倍, mention_rate: 0-1, generatedAt }

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RedditChild = {
  data?: {
    title?: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
  };
};

type KalshiEvent = {
  event_ticker?: string;
  markets?: Array<{
    ticker?: string;
    volume_24h?: number;
    volume?: number;
    open_interest?: number;
    last_price?: number;
  }>;
};

async function getKalshiVolSpike(ticker: string): Promise<number> {
  try {
    const r = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`,
      { cache: "no-store" }
    );
    if (!r.ok) return 1;
    const d = await r.json();
    const v24 = d.market?.volume_24h || 0;
    const total = d.market?.volume || 1;
    // 简化 · 24h 比平均 · 越高越 FOMO
    const days = 14;
    const dailyAvg = total / days;
    if (dailyAvg <= 0) return 1;
    return v24 / dailyAvg;
  } catch {
    return 1;
  }
}

async function getRedditMentionRate(team: string, sub = "leagueoflegends"): Promise<number> {
  try {
    const r = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=50`,
      {
        cache: "no-store",
        headers: { "User-Agent": "Du4Leaving/0.13 sentiment" },
      }
    );
    if (!r.ok) return 0;
    const d = await r.json();
    const posts = (d.data?.children || []) as RedditChild[];
    const total = posts.length;
    if (total === 0) return 0;
    const lower = team.toLowerCase();
    const hits = posts.filter((p) => (p.data?.title || "").toLowerCase().includes(lower)).length;
    return hits / total;
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") || "";
  const team = searchParams.get("team") || "";
  const sub = searchParams.get("sub") || undefined;

  if (!ticker && !team) {
    return NextResponse.json(
      { ok: false, error: "需 ticker 或 team 参数" },
      { status: 400 }
    );
  }

  const [volSpike, mentionRate] = await Promise.all([
    ticker ? getKalshiVolSpike(ticker) : Promise.resolve(1),
    team ? getRedditMentionRate(team, sub) : Promise.resolve(0),
  ]);

  // 综合 score · vol > 3x → +0.4 · mention > 20% → +0.4
  const volComp = Math.min(0.5, Math.max(0, (volSpike - 1) / 6));
  const mentionComp = Math.min(0.5, mentionRate * 2.5);
  const score = Math.min(1, volComp + mentionComp);

  let reason = "";
  if (score >= 0.7) {
    reason = `市场 FOMO 中 · 热度 ${volSpike.toFixed(1)}x · ${(mentionRate * 100).toFixed(0)}% 帖子提到 · 你的便宜分可能被吹大 · 等 5min`;
  } else if (score >= 0.4) {
    reason = `热度偏高 · ${volSpike.toFixed(1)}x vol · 谨慎 · 仓位减半`;
  } else {
    reason = `情绪平稳 · ${volSpike.toFixed(1)}x vol · 押你的 edge`;
  }

  return NextResponse.json({
    ok: true,
    score,
    reason,
    vol_spike: Number(volSpike.toFixed(2)),
    mention_rate: Number(mentionRate.toFixed(3)),
    generatedAt: new Date().toISOString(),
  });
}
