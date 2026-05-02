// 百川/allocator-strategies.ts · 实时策略分配器
// V0.72 W3 Day 10
//
// 输入 · 当前市场状态 (各信号源信号数 · pool 余额)
// 输出 · 每策略 ·
//   · eligible · 当前能用?
//   · current_signals · 此时多少个信号活跃
//   · score · 综合评分 (信号数 × 期望 EV × confidence)
//   · suggested_pct · 建议分配 % · 总和 ≤ 100%
//   · suggested_usd · $400 × 该 %

import { STRATEGIES, type Strategy } from "./strategies";
import { readPools } from "./pools";
import { loadWeights } from "./weights";
import { readAllLessons } from "./lessons";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

export interface StrategyState {
  code: string;
  strategy: Strategy;
  eligible: boolean;
  reason: string;
  current_signals: number;
  current_weight: number;          // 来自 weights.json (Brier 自适应)
  recent_n_closed: number;
  recent_wr: number;
  expected_ev_pct: number;         // 估计本月化 EV (基于活跃度 + 历史)
  score: number;                   // 综合评分
  suggested_pct: number;           // 0-100
  suggested_usd: number;
}

interface SourceCounts {
  total: number;
  by_source: Record<string, number>;
}

async function pullSourceCounts(): Promise<SourceCounts> {
  const counts: Record<string, number> = {};
  let total = 0;
  // 并行拉所有 -edges endpoint
  const sources = ["btc-edges", "eth-edges", "sol-edges", "weather-edges", "nba-edges", "fed-edges", "fda-edges", "mention-edges", "contrarian-edges"];
  await Promise.all(
    sources.map(async (s) => {
      try {
        const r = await fetch(`${URL_PREFIX}/api/xiapan/${s}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        }).then((r) => r.json());
        if (!r.ok) return;
        for (const sig of (r.signals ?? []) as Array<{ source: string }>) {
          counts[sig.source] = (counts[sig.source] ?? 0) + 1;
          total++;
        }
      } catch {}
    })
  );
  return { total, by_source: counts };
}

interface AllocateOpts {
  bankroll: number;                // S 池余额 (主要分配池)
  max_pct_per_strategy?: number;   // 单策略上限 (默认 25%)
  min_strategies?: number;         // 最少分散到几个 (默认 5)
}

export async function allocateStrategies(opts: AllocateOpts): Promise<{
  bankroll: number;
  strategies: StrategyState[];
  allocation_total_pct: number;
  diversification: { total_eligible: number; allocated: number };
  warnings: string[];
}> {
  const max_pct = opts.max_pct_per_strategy ?? 25;
  const min_strats = opts.min_strategies ?? 5;
  const warnings: string[] = [];

  const counts = await pullSourceCounts();
  const weights = loadWeights();
  const lessons = readAllLessons();
  const closed = lessons.filter((l) => l.actual === 0 || l.actual === 1);

  const states: StrategyState[] = STRATEGIES.map((strategy) => {
    const current_signals = counts.by_source[strategy.code] ?? 0;
    const current_weight = weights[strategy.code] ?? 1.0;

    // recent stats from this source
    const part = closed.filter((l) => (l.signals_active ?? []).includes(strategy.code));
    const recent_n = part.length;
    const wins = part.filter((l) => l.actual === 1).length;
    const recent_wr = recent_n > 0 ? wins / recent_n : 0;

    // eligible · 当前有信号 OR 是套利型 (随机活跃)
    const eligible = current_signals > 0 || strategy.bucket === "stable";

    // expected EV · 基于历史 wr (如有) 或 strategy 元数据 (好月化)
    const ev_from_history = recent_n >= 10 ? (recent_wr - 0.5) * 100 : NaN;
    const ev_from_meta = (strategy.good_month_pct + strategy.bad_month_pct) / 2;
    const expected_ev_pct = isNaN(ev_from_history) ? ev_from_meta : ev_from_history;

    // score · 综合评分 (信号活跃度 × EV × Brier 权重)
    // 活跃 (current_signals ≥ 1) 加大权 · 否则按基础值
    const activity_factor = current_signals === 0 ? 0.3 : Math.min(1, current_signals / 5);
    const score = Math.max(0, expected_ev_pct) * activity_factor * current_weight;

    return {
      code: strategy.code,
      strategy,
      eligible,
      reason: eligible
        ? (current_signals > 0 ? `${current_signals} 信号活跃 · 历史 wr ${(recent_wr * 100).toFixed(0)}%` : "套利型 · 长期可触发")
        : "前置条件不满足",
      current_signals,
      current_weight,
      recent_n_closed: recent_n,
      recent_wr,
      expected_ev_pct,
      score,
      suggested_pct: 0,
      suggested_usd: 0,
    };
  });

  // 按 score 排序 · 仅 eligible
  const eligible = states.filter((s) => s.eligible).sort((a, b) => b.score - a.score);
  const total_eligible = eligible.length;

  // 配额分配 · 按 score 比例 · 但单策略 ≤ max_pct
  const total_score = eligible.reduce((s, x) => s + x.score, 0);
  if (total_score > 0) {
    let remaining = 100;
    for (const e of eligible) {
      const raw_pct = (e.score / total_score) * 100;
      const capped = Math.min(raw_pct, max_pct, remaining);
      e.suggested_pct = capped;
      e.suggested_usd = (opts.bankroll * capped) / 100;
      remaining -= capped;
      if (remaining <= 0) break;
    }
  }

  // 检 · 至少 5 策略分配 (diversification)
  const allocated = eligible.filter((e) => e.suggested_pct > 0).length;
  if (allocated < min_strats) {
    warnings.push(`仅 ${allocated} 策略分配 · 低于建议 ${min_strats} · 信号源活跃度低`);
  }

  // 检 · 任一策略占 ≥ 50%
  const max_alloc = Math.max(...eligible.map((e) => e.suggested_pct));
  if (max_alloc > 50) {
    warnings.push(`单策略 ${max_alloc.toFixed(0)}% · 集中度过高`);
  }

  const allocation_total_pct = states.reduce((s, x) => s + x.suggested_pct, 0);

  return {
    bankroll: opts.bankroll,
    strategies: states.sort((a, b) => b.score - a.score),
    allocation_total_pct,
    diversification: { total_eligible, allocated },
    warnings,
  };
}
