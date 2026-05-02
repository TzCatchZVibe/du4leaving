// /api/xiapan/baichuan/signals
// V0.72 W3 Day 8 · /信号 · TZ 主动看 top 5 候选
// 不主动 push · 你想看才看

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const baseURL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

interface DecisionLite {
  ticker: string;
  fusion: {
    edge_pp: number;
    n_active: number;
    side: 1 | -1;
    p_consensus: number;
    signals_used: string[];
  };
  decision: { act: boolean; stake_usd: number; qty: number; reason: string };
  bucket: "stable" | "convex";
  acted: boolean;
}

export async function GET() {
  let decisions: DecisionLite[] = [];
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/baichuan/run`, {
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    }).then((r) => r.json());
    decisions = (r.decisions ?? []) as DecisionLite[];
  } catch {}

  // 按 |edge_pp| 排序 · multi-signal 优先
  decisions.sort((a, b) => {
    const aw = a.fusion.n_active * 100 + Math.abs(a.fusion.edge_pp);
    const bw = b.fusion.n_active * 100 + Math.abs(b.fusion.edge_pp);
    return bw - aw;
  });

  const top = decisions.slice(0, 5).map((d) => ({
    ticker: d.ticker.slice(0, 35),
    edge_pp: d.fusion.edge_pp,
    n_active: d.fusion.n_active,
    sources: d.fusion.signals_used,
    side: d.fusion.side === 1 ? "yes" : "no",
    bucket: d.bucket,
    acted: d.acted,
    stake: d.decision.stake_usd,
    reason: d.decision.reason,
  }));

  return NextResponse.json({
    ok: true,
    summary: {
      total: decisions.length,
      multi_signal: decisions.filter((d) => d.fusion.n_active >= 2).length,
      acted: decisions.filter((d) => d.acted).length,
    },
    top,
  });
}
