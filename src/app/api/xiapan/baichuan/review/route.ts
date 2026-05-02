// /api/xiapan/baichuan/review
// V0.72 W3 Day 5 · 综合表现报告 · CLV + Brier + PnL + drawdown 一站
//
// 用法 ·
//   GET                    · 全量 (since inception)
//   GET ?days=30           · 近 30 天
//   GET ?cron=1            · cron 调用 · 月底 push Telegram

import { NextResponse } from "next/server";
import { readAllLessons, brierBySource, type LessonRecord } from "@/lib/xiapan/百川/lessons";
import { computeCLV, clvSummary } from "@/lib/xiapan/百川/clv";
import { readPools } from "@/lib/xiapan/百川/pools";
import { loadWeights } from "@/lib/xiapan/百川/weights";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface SourceAttribution {
  source: string;
  weight: number;
  participated: number;
  closed: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  avg_clv_pp: number;
  brier: number | null;
  verdict: "alpha+" | "neutral" | "alpha-" | "insufficient";
}

function within(l: LessonRecord, sinceMs: number): boolean {
  return new Date(l.ts).getTime() >= sinceMs;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("cron") === "1";
  if (isCron) {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.headers.get("authorization") ?? "";
      if (got !== `Bearer ${expected}`) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }
  }

  const days = parseInt(url.searchParams.get("days") ?? "0", 10);
  const sinceMs = days > 0 ? Date.now() - days * 86400_000 : 0;

  const all = readAllLessons();
  const window = sinceMs > 0 ? all.filter((l) => within(l, sinceMs)) : all;
  const closed = window.filter((l) => l.actual !== undefined && l.actual !== null);

  // ─── 整体 ───
  const totalPnL = closed.reduce((s, l) => s + (l.pnl ?? 0), 0);
  const wins = closed.filter((l) => l.actual === 1).length;
  const wr = closed.length > 0 ? wins / closed.length : 0;
  const stable = closed.filter((l) => l.bucket === "stable");
  const convex = closed.filter((l) => l.bucket === "convex");

  // ─── CLV ───
  const clvRecords = computeCLV(window);
  const clv = clvSummary(clvRecords);

  // ─── 信号源归因 ───
  const weights = loadWeights();
  const brier = brierBySource(closed);
  const allSources = new Set<string>([...Object.keys(weights), ...Object.keys(brier)]);
  // 加上 lessons 里出现过的 sources
  for (const l of closed) for (const s of l.signals_active ?? []) allSources.add(s);

  const attributions: SourceAttribution[] = [];
  for (const src of allSources) {
    const part = window.filter((l) => l.signals_active?.includes(src));
    const closedSrc = part.filter((l) => l.actual !== undefined && l.actual !== null);
    const winsSrc = closedSrc.filter((l) => l.actual === 1).length;
    const pnl = closedSrc.reduce((s, l) => s + (l.pnl ?? 0), 0);

    // CLV by source (近似)
    const clvSrc = clvRecords.filter((r) =>
      part.some((l) => l.ts === r.ts && l.ticker === r.ticker)
    );
    const avgClv = clvSrc.length > 0
      ? clvSrc.reduce((s, r) => s + r.clv_pp, 0) / clvSrc.length
      : 0;

    let verdict: SourceAttribution["verdict"] = "insufficient";
    if (closedSrc.length >= 10) {
      if (avgClv >= 1.0 && winsSrc / closedSrc.length >= 0.55) verdict = "alpha+";
      else if (avgClv <= -1.0 || winsSrc / closedSrc.length <= 0.45) verdict = "alpha-";
      else verdict = "neutral";
    }

    attributions.push({
      source: src,
      weight: weights[src] ?? 1.0,
      participated: part.length,
      closed: closedSrc.length,
      wins: winsSrc,
      losses: closedSrc.length - winsSrc,
      win_rate: closedSrc.length > 0 ? winsSrc / closedSrc.length : 0,
      total_pnl: Number(pnl.toFixed(2)),
      avg_clv_pp: Number(avgClv.toFixed(2)),
      brier: brier[src]?.brier ?? null,
      verdict,
    });
  }

  attributions.sort((a, b) => b.total_pnl - a.total_pnl);

  // ─── 桶状态 ───
  const pools = readPools();
  const poolsState = pools
    ? {
        P0: pools.P0,
        S: pools.S.balance,
        S_peak: pools.S.peak,
        S_drawdown_from_peak_pct:
          pools.S.peak > 0 ? (pools.S.peak - pools.S.balance) / pools.S.peak : 0,
        C: pools.C.balance,
        C_open_trades: pools.C.open_trades,
        circuit: pools.circuit_state,
        lifetime_cashout: pools.lifetime.total_cashout,
        lifetime_reinvest: pools.lifetime.total_reinvest,
      }
    : null;

  const result = {
    ok: true,
    window_days: days || "全量",
    summary: {
      total_lessons: window.length,
      closed: closed.length,
      open: window.length - closed.length,
      wins,
      losses: closed.length - wins,
      win_rate: wr,
      total_pnl: Number(totalPnL.toFixed(2)),
      stable: { n: stable.length, pnl: Number(stable.reduce((s, l) => s + (l.pnl ?? 0), 0).toFixed(2)) },
      convex: { n: convex.length, pnl: Number(convex.reduce((s, l) => s + (l.pnl ?? 0), 0).toFixed(2)) },
    },
    clv: {
      n: clv.n,
      avg_clv_pp: clv.avg_clv_pp,
      positive_pct: clv.positive_pct,
      verdict: clv.verdict,
    },
    pools: poolsState,
    sources: attributions,
    generatedAt: new Date().toISOString(),
  };

  // V0.72 · cron · push 月度报告
  if (isCron && closed.length > 0) {
    try {
      const tg = await import("@/lib/xiapan/telegram");
      if (tg.tgEnabled()) {
        const sign = result.summary.total_pnl >= 0 ? "+" : "";
        const lines = [
          `▼ 综合表现 · ${days || "全"}天`,
          ``,
          `paper · ${result.summary.closed} 已平 / ${result.summary.open} 持仓`,
          `wr ${(result.summary.win_rate * 100).toFixed(0)}% · PnL ${sign}$${result.summary.total_pnl.toFixed(2)}`,
          `CLV ${result.clv.avg_clv_pp >= 0 ? "+" : ""}${result.clv.avg_clv_pp.toFixed(1)}pp (${result.clv.verdict})`,
          ``,
          `S 桶 ${stable.length} · ${stable.reduce((s, l) => s + (l.pnl ?? 0), 0) >= 0 ? "+" : ""}$${stable.reduce((s, l) => s + (l.pnl ?? 0), 0).toFixed(2)}`,
          `C 桶 ${convex.length} · ${convex.reduce((s, l) => s + (l.pnl ?? 0), 0) >= 0 ? "+" : ""}$${convex.reduce((s, l) => s + (l.pnl ?? 0), 0).toFixed(2)}`,
          ``,
          `top 5 sources by PnL ·`,
        ];
        for (const s of attributions.slice(0, 5)) {
          lines.push(`  ${s.source}: ${s.closed}/${s.participated} · wr ${(s.win_rate * 100).toFixed(0)}% · ${s.total_pnl >= 0 ? "+" : ""}$${s.total_pnl} · CLV ${s.avg_clv_pp >= 0 ? "+" : ""}${s.avg_clv_pp}pp · ${s.verdict}`);
        }
        await tg.sendTelegramMessage(lines.join("\n"), { parseMode: undefined });
      }
    } catch {}
  }

  return NextResponse.json(result);
}
