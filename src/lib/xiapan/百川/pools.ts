// 百川/pools.ts · TZ 两池模型 v2 · 状态机
// V0.72 ·
//   P0 (本金 · 红线) 永不动
//   S 池 (稳赚) 起步 90% · 跑套利 / 公允价
//   C 池 (以小搏大) 起步 10% · 跑凸性押注
//   月底 hurdle 8% · 阶梯 cashout 30/50/70

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const POOLS_DIR = path.join(HOME, ".du4leaving", "百川");
const POOLS_FILE = path.join(POOLS_DIR, "pools.json");

export type CircuitState = "running" | "paused_C" | "paused_all" | "red_line";

export interface PoolsState {
  P0: number;                       // 本金 · 红线
  P0_set_at: string;
  S: {
    balance: number;
    month_start_balance: number;
    month_start_ts: string;
    peak: number;
    consecutive_loss_count: number;
  };
  C: {
    balance: number;
    balance_at_last_distribution: number;  // 用于算 net_gain
    open_trades: number;
    miss_streak_months: number;            // 连续未击中月数
  };
  lifetime: {
    total_cashout: number;
    total_reinvest: number;
    total_C_deposits_from_S: number;
    month_history: Array<{
      month: string;                       // YYYY-MM
      S_start: number;
      S_end: number;
      S_to_C_transfer: number;
      C_distribution?: { cashout: number; reinvest: number; tier: string };
      drawdown_S_pct: number;
    }>;
  };
  circuit_state: CircuitState;
  circuit_reason: string | null;
  circuit_until: string | null;
}

const HURDLE_RATE_ANNUAL = 0.08;        // 8% 年化
const HURDLE_RATE_MONTHLY = HURDLE_RATE_ANNUAL / 12;

const CASHOUT_TIERS = {
  small: { min: 50, max: 300, cashout_pct: 0.30 },     // 30/70
  medium: { min: 300, max: 1000, cashout_pct: 0.50 },  // 50/50
  large: { min: 1000, max: Infinity, cashout_pct: 0.70 }, // 70/30
};

const DRAWDOWN_C_PAUSE_PCT = 0.05;       // S -5% 月暂停 C
const DRAWDOWN_FULL_PAUSE_PCT = 0.15;    // S -15% 月全停
const RED_LINE_PCT = 0.85;               // 总仓 < P0 × 0.85 红线

const STARTING_S_PCT = 0.90;             // 起步 90/10
const STARTING_C_PCT = 0.10;

function ensureDir() {
  if (!fs.existsSync(POOLS_DIR)) fs.mkdirSync(POOLS_DIR, { recursive: true });
}

export function readPools(): PoolsState | null {
  if (!fs.existsSync(POOLS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(POOLS_FILE, "utf8")) as PoolsState;
  } catch {
    return null;
  }
}

export function writePools(state: PoolsState): void {
  ensureDir();
  fs.writeFileSync(POOLS_FILE, JSON.stringify(state, null, 2), "utf8");
}

/// 初始化 · 仅首次调用 · 后续幂等
export function initPools(P0: number): PoolsState {
  const existing = readPools();
  if (existing) return existing;

  const now = new Date().toISOString();
  const s_init = P0 * STARTING_S_PCT;
  const c_init = P0 * STARTING_C_PCT;

  const state: PoolsState = {
    P0,
    P0_set_at: now,
    S: {
      balance: s_init,
      month_start_balance: s_init,
      month_start_ts: now,
      peak: s_init,
      consecutive_loss_count: 0,
    },
    C: {
      balance: c_init,
      balance_at_last_distribution: c_init,
      open_trades: 0,
      miss_streak_months: 0,
    },
    lifetime: {
      total_cashout: 0,
      total_reinvest: 0,
      total_C_deposits_from_S: 0,
      month_history: [],
    },
    circuit_state: "running",
    circuit_reason: null,
    circuit_until: null,
  };
  writePools(state);
  return state;
}

// ─────────────────── 操作 · 实时 ───────────────────

/// 单笔下单后调 · 扣 stake
export function debitFromPool(
  pool: "S" | "C",
  stake: number
): { ok: boolean; reason?: string } {
  const state = readPools();
  if (!state) return { ok: false, reason: "pools not initialized" };

  // 红线检查
  const total = state.S.balance + state.C.balance;
  if (total < state.P0 * RED_LINE_PCT) {
    state.circuit_state = "red_line";
    state.circuit_reason = `total ${total.toFixed(2)} < P0 × 0.85`;
    writePools(state);
    return { ok: false, reason: "red line triggered" };
  }

  if (state.circuit_state === "paused_all") {
    return { ok: false, reason: `paused_all · ${state.circuit_reason}` };
  }
  if (pool === "C" && state.circuit_state === "paused_C") {
    return { ok: false, reason: `C paused · ${state.circuit_reason}` };
  }

  if (pool === "S") {
    if (state.S.balance < stake) return { ok: false, reason: "S insufficient" };
    state.S.balance -= stake;
  } else {
    if (state.C.balance < stake) return { ok: false, reason: "C insufficient" };
    state.C.balance -= stake;
    state.C.open_trades += 1;
  }

  writePools(state);
  return { ok: true };
}

/// 平仓后调 · 入 payoff (含 stake 退还)
export function creditToPool(
  pool: "S" | "C",
  payoff: number,
  pnl: number
): void {
  const state = readPools();
  if (!state) return;

  if (pool === "S") {
    state.S.balance += payoff;
    state.S.peak = Math.max(state.S.peak, state.S.balance);
    if (pnl < 0) state.S.consecutive_loss_count += 1;
    else state.S.consecutive_loss_count = 0;
  } else {
    state.C.balance += payoff;
    state.C.open_trades = Math.max(0, state.C.open_trades - 1);
  }

  // 检 drawdown 熔断
  checkDrawdownCircuit(state);
  writePools(state);
}

function checkDrawdownCircuit(state: PoolsState): void {
  const dd = (state.S.month_start_balance - state.S.balance) / state.S.month_start_balance;

  if (dd >= DRAWDOWN_FULL_PAUSE_PCT) {
    state.circuit_state = "paused_all";
    state.circuit_reason = `S month drawdown ${(dd * 100).toFixed(1)}% ≥ 15%`;
    state.circuit_until = new Date(Date.now() + 7 * 86400_000).toISOString();
  } else if (dd >= DRAWDOWN_C_PAUSE_PCT && state.circuit_state === "running") {
    state.circuit_state = "paused_C";
    state.circuit_reason = `S month drawdown ${(dd * 100).toFixed(1)}% ≥ 5%`;
    // C 暂停 1 月 · 月底 allocator 解除
  }
}

/// 红线 / 全停 解除 · 人工调用 (Telegram /resume) 或月底
export function resumeCircuit(reason: string): void {
  const state = readPools();
  if (!state) return;
  state.circuit_state = "running";
  state.circuit_reason = `resumed: ${reason}`;
  state.circuit_until = null;
  writePools(state);
}

export const POOLS_CONFIG = {
  HURDLE_RATE_ANNUAL,
  HURDLE_RATE_MONTHLY,
  CASHOUT_TIERS,
  DRAWDOWN_C_PAUSE_PCT,
  DRAWDOWN_FULL_PAUSE_PCT,
  RED_LINE_PCT,
  STARTING_S_PCT,
  STARTING_C_PCT,
  PATHS: {
    POOLS_DIR,
    POOLS_FILE,
  },
};
