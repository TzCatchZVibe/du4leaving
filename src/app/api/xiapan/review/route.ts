// /api/xiapan/review
// AI 单单复盘 · 拿用户最近 30 单 + 用户写的理由 · 让 LLM 找规律
//
// 输出 ·
//   { ok, summary: 一句话总览, patterns: [3 条规律], actions: [3 条具体行动], generatedAt }
//
// 节奏 · 每用户每 30 分钟跑一次 · 内存 cache · 省 OpenAI cost

import { NextResponse } from "next/server";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";
import { chat } from "@/lib/xiapan/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Fill = {
  ticker: string;
  side: string;
  action: string;
  count_fp: string;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  fee_cost?: string;
  created_time: string;
};
type Settlement = {
  ticker: string;
  market_result?: string;
  realized_pnl?: string;
  settled_time: string;
};
type BetLogEntry = { ts: string; ticker: string; reason: string; tag?: string };

// V0.18 · cache 升 30min → 24h · 用户 budget 0 模式 · 减 OpenAI cost
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL = 24 * 60 * 60 * 1000;
const KEY = "user-default";

const fp = (s: string | undefined) => parseFloat(s || "0");

export async function POST(req: Request) {
  let body: { betLog?: BetLogEntry[] } = {};
  try { body = await req.json(); } catch {}
  const betLog = body.betLog || [];

  const cached = cache.get(KEY);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json({ ok: true, cached: true, ...(cached.data as object) });
  }

  try {
    // 拉用户全 fills + settlements
    const [fillsResp, setResp] = await Promise.all([
      authedKalshi<{ fills?: Fill[] }>("GET", "/portfolio/fills?limit=200"),
      authedKalshi<{ settlements?: Settlement[] }>("GET", "/portfolio/settlements?limit=200"),
    ]);
    const fills = fillsResp.fills || [];
    const settlements = setResp.settlements || [];

    // 数据 hot-summary · LLM 不需要看每条 · 给统计 + 极端样本
    const tickerStats = new Map<string, {
      ticker: string;
      sport: string;
      count: number;
      pnl: number;
      fee: number;
      first_ts: string;
      last_ts: string;
    }>();

    const sportOf = (t: string): string => {
      const u = t.toUpperCase();
      if (u.includes("LOL")) return "LOL";
      if (u.includes("NBA")) return "NBA";
      if (u.includes("MLB")) return "MLB";
      if (u.includes("NFL")) return "NFL";
      if (u.includes("NHL")) return "NHL";
      if (u.includes("ITF") || u.includes("ATP") || u.includes("WTA")) return "Tennis";
      if (u.includes("EPL") || u.includes("UCL") || u.includes("MLS")) return "Soccer";
      if (u.includes("BTC") || u.includes("ETH") || u.includes("SOL")) return "Crypto";
      return "Other";
    };

    for (const f of fills) {
      let row = tickerStats.get(f.ticker);
      if (!row) {
        row = {
          ticker: f.ticker,
          sport: sportOf(f.ticker),
          count: 0,
          pnl: 0,
          fee: 0,
          first_ts: f.created_time,
          last_ts: f.created_time,
        };
        tickerStats.set(f.ticker, row);
      }
      row.count++;
      row.fee += fp(f.fee_cost);
      if (f.created_time < row.first_ts) row.first_ts = f.created_time;
      if (f.created_time > row.last_ts) row.last_ts = f.created_time;
    }
    for (const s of settlements) {
      const row = tickerStats.get(s.ticker);
      if (row) row.pnl = fp(s.realized_pnl);
    }
    const summary = Array.from(tickerStats.values()).slice(0, 30);

    // 时段分布
    const hourBuckets: Record<number, { count: number; pnl: number }> = {};
    for (const f of fills) {
      const h = new Date(f.created_time).getHours();
      hourBuckets[h] = hourBuckets[h] || { count: 0, pnl: 0 };
      hourBuckets[h].count++;
      const row = tickerStats.get(f.ticker);
      if (row) hourBuckets[h].pnl += row.pnl / Math.max(1, row.count);
    }

    // sport 分布
    const sportBuckets: Record<string, { count: number; pnl: number }> = {};
    for (const row of tickerStats.values()) {
      const sp = row.sport;
      sportBuckets[sp] = sportBuckets[sp] || { count: 0, pnl: 0 };
      sportBuckets[sp].count += row.count;
      sportBuckets[sp].pnl += row.pnl;
    }

    const totalPnl = Array.from(tickerStats.values()).reduce((s, r) => s + r.pnl, 0);
    const totalFee = Array.from(tickerStats.values()).reduce((s, r) => s + r.fee, 0);

    // 给 LLM 的紧凑 JSON
    const compact = {
      total_fills: fills.length,
      total_tickers: tickerStats.size,
      total_pnl: Number(totalPnl.toFixed(2)),
      total_fee: Number(totalFee.toFixed(2)),
      net_roi_pct:
        fills.length > 0
          ? Number(((totalPnl - totalFee) / Math.max(1, fills.length) * 10).toFixed(1))
          : 0,
      sport_distribution: Object.fromEntries(
        Object.entries(sportBuckets).map(([k, v]) => [k, { ...v, pnl: Number(v.pnl.toFixed(2)) }])
      ),
      hour_distribution: Object.fromEntries(
        Object.entries(hourBuckets).map(([k, v]) => [k, { ...v, pnl: Number(v.pnl.toFixed(2)) }])
      ),
      top_winners: summary
        .filter((r) => r.pnl > 0)
        .sort((a, b) => b.pnl - a.pnl)
        .slice(0, 5),
      top_losers: summary
        .filter((r) => r.pnl < 0)
        .sort((a, b) => a.pnl - b.pnl)
        .slice(0, 5),
      bet_log: betLog.slice(0, 20),
    };

    // LLM 调用 · 通过 provider abstraction · auto-fallback Ollama → OpenAI → Static
    const llmResult = await chat({
      system: `你是用户的赌博伴侣 · 名字 Duby · 邻家小妹妹懂投资风投 ·
对面用户在 Kalshi 上做体育/电竞/crypto 短赌 · 你看他历史数据找规律 · 给 3 条具体行动

规则 ·
1. 不用术语 · "Kelly" "EV" "Brier" "Sharpe" "edge" "spread" "vol24" 全部翻成人话
2. 中文 · 故事化 · 每条行动 ≤ 30 字 · 具体可执行
3. 输出严格 JSON · 不要 markdown
4. summary 一句话 (≤ 25 字 · 一眼看出整体表现)
5. patterns · 3 条 · 每条 ≤ 35 字 · 找出他的盈/亏规律
6. actions · 3 条 · 每条 ≤ 30 字 · 具体行动 (例 "周日 02:00 后别下 NBA")

输出格式 ·
{ "summary": "...", "patterns": ["...", "...", "..."], "actions": ["...", "...", "..."] }`,
      user: `这是我最近的 Kalshi 数据 · 帮我看规律 ·\n\n${JSON.stringify(compact, null, 2)}`,
      jsonOutput: true,
      temperature: 0.4,
    });

    let parsed: { summary?: string; patterns?: string[]; actions?: string[] } = {};
    try {
      parsed = JSON.parse(llmResult.text || "{}");
    } catch {
      parsed = { summary: "AI 输出格式错 · 重试一次" };
    }

    const data = {
      summary: parsed.summary || "",
      patterns: parsed.patterns || [],
      actions: parsed.actions || [],
      provider: llmResult.provider,
      stats: {
        total_fills: compact.total_fills,
        total_tickers: compact.total_tickers,
        total_pnl: compact.total_pnl,
        total_fee: compact.total_fee,
      },
      generatedAt: new Date().toISOString(),
    };

    cache.set(KEY, { ts: Date.now(), data });
    return NextResponse.json({ ok: true, cached: false, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
