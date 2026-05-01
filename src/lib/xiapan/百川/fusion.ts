// 百川/fusion.ts · Bayesian log-odds 信号融合核心
// V0.72 · Benter 公式 · log-odds 加法 · 自然 Bayesian 联合更新
//
// 单元测试在 fusion.test.ts (todo)

export interface Signal {
  source: string;             // 'btc-bs' | 'elo-nba' | 'whale-follow' | ...
  ticker: string;
  direction: 1 | -1;          // +1 yes / -1 no
  predicted_p: number;        // 该信号给出的 P(yes)
  confidence: number;         // 0.51-0.85 · 历史准确率 (Brier 调)
  reason: string;
  ts: string;
  data?: Record<string, unknown>;
}

export interface FusionInput {
  ticker: string;
  market_implied_p: number;             // [0, 1]
  signals: Signal[];
  signal_weights?: Record<string, number>;  // source → 当前权重 (默认 1.0)
}

export interface FusionResult {
  ticker: string;
  market_implied_p: number;
  p_consensus: number;                  // [0, 1]
  edge_pp: number;                      // (p_consensus - market) × 100
  side: 1 | -1;                         // +1 押 yes · -1 押 no
  n_active: number;
  signals_used: string[];               // 参与的 source
  conflict: boolean;                    // 信号方向冲突 (失效)
  kelly_full: number;                   // 全 Kelly · 未折扣
  log_odds: {
    prior: number;
    posterior: number;
    contributions: Array<{ source: string; value: number }>;
  };
}

const CLIP_MIN = 0.51;
const CLIP_MAX = 0.85;
const EPS = 1e-9;

function logit(p: number): number {
  const clamped = Math.max(EPS, Math.min(1 - EPS, p));
  return Math.log(clamped / (1 - clamped));
}

function sigmoid(x: number): number {
  if (x > 50) return 1 - EPS;
  if (x < -50) return EPS;
  return 1 / (1 + Math.exp(-x));
}

export function fuse(input: FusionInput): FusionResult {
  const { ticker, market_implied_p, signals } = input;
  const weights = input.signal_weights ?? {};

  // log-odds prior (市场是 prior)
  const prior_lo = logit(market_implied_p);
  let post_lo = prior_lo;

  const contributions: Array<{ source: string; value: number }> = [];
  const directions = new Set<number>();
  const usedSources: string[] = [];

  for (const s of signals) {
    const w = weights[s.source] ?? 1.0;
    if (w <= 0) continue;                              // 退役 source

    const a = Math.max(CLIP_MIN, Math.min(CLIP_MAX, s.confidence));
    const contribution = s.direction * w * Math.log(a / (1 - a));
    post_lo += contribution;
    contributions.push({ source: s.source, value: contribution });
    directions.add(s.direction);
    usedSources.push(s.source);
  }

  const p_consensus = sigmoid(post_lo);
  const edge_pp = (p_consensus - market_implied_p) * 100;
  const side: 1 | -1 = edge_pp >= 0 ? 1 : -1;
  const n_active = usedSources.length;
  const conflict = directions.size > 1;

  // 冲突时 · edge 失效 · kelly = 0
  if (conflict) {
    return {
      ticker,
      market_implied_p,
      p_consensus,
      edge_pp: 0,
      side,
      n_active,
      signals_used: usedSources,
      conflict: true,
      kelly_full: 0,
      log_odds: { prior: prior_lo, posterior: post_lo, contributions },
    };
  }

  // 全 Kelly · 未缩
  const p_correct = side === 1 ? p_consensus : 1 - p_consensus;
  const cost = side === 1 ? market_implied_p : 1 - market_implied_p;
  let kelly_full = 0;
  if (cost > 0 && cost < 1) {
    kelly_full = (p_correct - cost) / (1 - cost);
    kelly_full = Math.max(0, Math.min(0.5, kelly_full));
  }

  return {
    ticker,
    market_implied_p,
    p_consensus,
    edge_pp,
    side,
    n_active,
    signals_used: usedSources,
    conflict: false,
    kelly_full,
    log_odds: { prior: prior_lo, posterior: post_lo, contributions },
  };
}

// ──────────────────── 决策 + 仓位 ────────────────────

export interface DecideInput {
  fusion: FusionResult;
  vol_24: number;
  spread_c: number;
  bankroll: number;
  current_drawdown_pct?: number;          // 0-1 · 当前 vs 峰值 · 默认 0
  bucket?: "stable" | "convex";           // 70% / 20% 桶
}

export interface Decision {
  act: boolean;
  reason: string;
  stake_usd: number;
  qty: number;
  kelly_use: number;
  shrinks: {
    thorp: number;
    signals: number;
    drawdown: number;
    edge: number;
  };
}

const RISK = {
  STABLE: {
    SINGLE_TRADE_PCT: 0.014,    // 1.4% bankroll
    MIN_EDGE_PP: 5,
    MIN_VOL: 500,
    MAX_SPREAD: 3,
    MIN_N_ACTIVE: 2,
  },
  CONVEX: {
    SINGLE_TRADE_PCT: 0.005,    // 0.5%
    MIN_EDGE_PP: 12,            // 高门槛
    MIN_VOL: 200,               // 容许较低流动性 (long-shot)
    MAX_SPREAD: 5,
    MIN_N_ACTIVE: 1,            // 凸性允许孤注
  },
};

const MAX_DRAWDOWN_HARD_STOP = 0.30;
const MIN_STAKE_USD = 1;

export function decide(input: DecideInput): Decision {
  const { fusion, vol_24, spread_c, bankroll } = input;
  const drawdown = input.current_drawdown_pct ?? 0;
  const bucket = input.bucket ?? "stable";
  const cfg = bucket === "convex" ? RISK.CONVEX : RISK.STABLE;

  // 五条门 (顺序检 · 第一条 fail 就返回)
  if (fusion.conflict) {
    return zeroDecision("signals conflict");
  }
  if (Math.abs(fusion.edge_pp) < cfg.MIN_EDGE_PP) {
    return zeroDecision(`edge ${fusion.edge_pp.toFixed(1)}pp < ${cfg.MIN_EDGE_PP}`);
  }
  if (fusion.p_consensus < 0.05 || fusion.p_consensus > 0.95) {
    return zeroDecision("tail event · p<5% or p>95%");
  }
  if (vol_24 < cfg.MIN_VOL) {
    return zeroDecision(`low liquidity vol_24=$${vol_24}`);
  }
  if (spread_c > cfg.MAX_SPREAD) {
    return zeroDecision(`wide spread ${spread_c}¢`);
  }
  if (fusion.n_active < cfg.MIN_N_ACTIVE) {
    return zeroDecision(`single signal · need ≥ ${cfg.MIN_N_ACTIVE}`);
  }
  if (drawdown >= MAX_DRAWDOWN_HARD_STOP) {
    return zeroDecision(`drawdown ${(drawdown * 100).toFixed(0)}% · pause`);
  }

  // Kelly 多重缩
  const shrink_thorp = 0.25;
  const shrink_signals = bucket === "convex"
    ? 1.0
    : Math.min(fusion.n_active / 3, 1) ** 2;
  const shrink_drawdown = (1 - drawdown) ** 2;
  const shrink_edge = Math.min(Math.abs(fusion.edge_pp) / 15, 1);

  const kelly_use =
    fusion.kelly_full * shrink_thorp * shrink_signals * shrink_drawdown * shrink_edge;

  // 仓位计算
  const stake_kelly = bankroll * kelly_use;
  const stake_capped = Math.min(stake_kelly, bankroll * cfg.SINGLE_TRADE_PCT);
  const stake_usd = Math.max(0, stake_capped);

  if (stake_usd < MIN_STAKE_USD) {
    return zeroDecision(`stake $${stake_usd.toFixed(2)} < min $${MIN_STAKE_USD}`);
  }

  const cost_c = fusion.side === 1
    ? Math.round(fusion.market_implied_p * 100)
    : Math.round((1 - fusion.market_implied_p) * 100);
  const qty = Math.max(1, Math.floor((stake_usd * 100) / Math.max(1, cost_c)));

  return {
    act: true,
    reason: "pass all gates",
    stake_usd: Number(stake_usd.toFixed(2)),
    qty,
    kelly_use,
    shrinks: {
      thorp: shrink_thorp,
      signals: shrink_signals,
      drawdown: shrink_drawdown,
      edge: shrink_edge,
    },
  };
}

function zeroDecision(reason: string): Decision {
  return {
    act: false,
    reason,
    stake_usd: 0,
    qty: 0,
    kelly_use: 0,
    shrinks: { thorp: 0, signals: 0, drawdown: 0, edge: 0 },
  };
}
