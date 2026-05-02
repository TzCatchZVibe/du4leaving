// /api/xiapan/baichuan/backtest
// V0.72 W3 Day 6 · 回放 lessons.jsonl 找最优参数
//
// 不重新跑信号 (信号数据没存 · 只有 lessons 已下决定)
// 而是基于已有 lessons 的 actual 结果 ·
// 模拟"如果当时阈值更高 / 更低 · 会赚 / 亏多少"
//
// 可调参 ·
//   min_edge_pp_stable    [3, 5, 7, 10]
//   min_edge_pp_convex    [8, 12, 16]
//   min_n_active_stable   [2, 3]
//   min_signal_conf_clip  (0.51-0.65)

import { NextResponse } from "next/server";
import { readAllLessons, type LessonRecord } from "@/lib/xiapan/百川/lessons";

export const dynamic = "force-dynamic";

interface BacktestParam {
  min_edge_pp_stable: number;
  min_edge_pp_convex: number;
  min_n_active_stable: number;
}

interface BacktestResult {
  param: BacktestParam;
  n_trades: number;            // 多少 lessons 通过新阈值
  closed: number;
  wins: number;
  win_rate: number;
  total_pnl: number;
  total_stake: number;
  roi_pct: number;
  avg_pnl: number;
}

function evaluateParam(lessons: LessonRecord[], p: BacktestParam): BacktestResult {
  let n = 0;
  let closed = 0;
  let wins = 0;
  let pnl = 0;
  let stake = 0;
  for (const l of lessons) {
    const minEdge = l.bucket === "stable" ? p.min_edge_pp_stable : p.min_edge_pp_convex;
    if (Math.abs(l.edge_pp) < minEdge) continue;
    if (l.bucket === "stable" && l.n_active < p.min_n_active_stable) continue;
    n++;
    stake += l.stake;
    if (l.actual !== undefined && l.actual !== null) {
      closed++;
      if (l.actual === 1) wins++;
      pnl += l.pnl ?? 0;
    }
  }
  return {
    param: p,
    n_trades: n,
    closed,
    wins,
    win_rate: closed > 0 ? wins / closed : 0,
    total_pnl: Number(pnl.toFixed(2)),
    total_stake: Number(stake.toFixed(2)),
    roi_pct: stake > 0 ? Number(((pnl / stake) * 100).toFixed(2)) : 0,
    avg_pnl: closed > 0 ? Number((pnl / closed).toFixed(3)) : 0,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "0", 10);
  const sinceMs = days > 0 ? Date.now() - days * 86400_000 : 0;
  const all = readAllLessons();
  const window = sinceMs > 0 ? all.filter((l) => new Date(l.ts).getTime() >= sinceMs) : all;
  const closed = window.filter((l) => l.actual !== undefined && l.actual !== null);

  if (closed.length < 10) {
    return NextResponse.json({
      ok: true,
      message: `仅 ${closed.length} 单已结算 · 不够 backtest (需 ≥ 10)`,
      lessons_total: all.length,
      window_closed: closed.length,
    });
  }

  // 当前 baseline
  const current: BacktestParam = {
    min_edge_pp_stable: 5,
    min_edge_pp_convex: 12,
    min_n_active_stable: 2,
  };

  // 网格搜索
  const grid: BacktestParam[] = [];
  for (const minEdgeS of [3, 5, 7, 10]) {
    for (const minEdgeC of [8, 12, 16]) {
      for (const minN of [1, 2, 3]) {
        grid.push({
          min_edge_pp_stable: minEdgeS,
          min_edge_pp_convex: minEdgeC,
          min_n_active_stable: minN,
        });
      }
    }
  }

  const results = grid.map((p) => evaluateParam(window, p));
  // 按 ROI 排
  results.sort((a, b) => b.roi_pct - a.roi_pct);

  const baseline = evaluateParam(window, current);
  const best = results[0];
  const improvement_pp = best.roi_pct - baseline.roi_pct;

  return NextResponse.json({
    ok: true,
    window_days: days || "全",
    sample_size: closed.length,
    baseline,
    best,
    top_5: results.slice(0, 5),
    improvement_pp: Number(improvement_pp.toFixed(2)),
    recommendation:
      improvement_pp > 5
        ? `调阈值能提 ROI ${improvement_pp.toFixed(1)}pp · 考虑改 fusion.ts`
        : improvement_pp > 1
        ? `轻微改进 (+${improvement_pp.toFixed(1)}pp) · 不急`
        : `当前阈值已近优 · 不动`,
  });
}
