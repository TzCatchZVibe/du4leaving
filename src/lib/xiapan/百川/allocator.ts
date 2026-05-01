// 百川/allocator.ts · 月底资金分配 · cron 触发
// V0.72 · 每月 1 号 02:00 跑 ·
//   1. S 池算月化 ROI · 超 hurdle 8% 部分转入 C
//   2. C 池 net_gain 阶梯 cashout (30/50/70)
//   3. drawdown 熔断到期解除
//   4. 写月度快照到 pools.lifetime.month_history

import { readPools, writePools, POOLS_CONFIG, type PoolsState } from "./pools";

export interface AllocationResult {
  month: string;                        // YYYY-MM
  S_start: number;
  S_end: number;
  S_to_C_transfer: number;
  C_distribution: {
    cashout: number;
    reinvest: number;
    tier: "none" | "small" | "medium" | "large";
    net_gain: number;
  };
  drawdown_S_pct: number;
  circuit_state_after: string;
  notes: string[];
}

export function runMonthlyAllocation(now = new Date()): AllocationResult | null {
  const state = readPools();
  if (!state) return null;

  const notes: string[] = [];
  const month = now.toISOString().slice(0, 7); // YYYY-MM

  // ─── 1. S 池 hurdle 转账 ───
  const S_start = state.S.month_start_balance;
  const S_end = state.S.balance;
  const monthly_return = (S_end - S_start) / S_start;
  const hurdle = POOLS_CONFIG.HURDLE_RATE_MONTHLY;       // 0.667% 月化

  let S_to_C_transfer = 0;
  if (monthly_return < hurdle) {
    notes.push(
      `S 月化 ${(monthly_return * 100).toFixed(2)}% < hurdle ${(hurdle * 100).toFixed(2)}% · 全留 S`
    );
  } else {
    const hurdle_amount = S_start * hurdle;
    S_to_C_transfer = (S_end - S_start) - hurdle_amount;
    if (S_to_C_transfer > 0.01) {
      state.S.balance = S_start + hurdle_amount;
      state.C.balance += S_to_C_transfer;
      state.lifetime.total_C_deposits_from_S += S_to_C_transfer;
      notes.push(
        `S 月化 ${(monthly_return * 100).toFixed(2)}% · 超 hurdle · 转 C $${S_to_C_transfer.toFixed(2)}`
      );
    } else {
      S_to_C_transfer = 0;
      notes.push("S 超 hurdle 但金额 < $0.01 · 不转");
    }
  }

  // ─── 2. C 池阶梯 cashout ───
  const C_initial = state.C.balance_at_last_distribution;
  const C_current = state.C.balance;
  const net_gain = C_current - C_initial - S_to_C_transfer;
  // 注意 · 刚才的 transfer 不算 net_gain · 那是 inject 不是 win

  let cashout = 0;
  let reinvest = 0;
  let tier: "none" | "small" | "medium" | "large" = "none";

  const tiers = POOLS_CONFIG.CASHOUT_TIERS;

  if (net_gain >= tiers.large.min) {
    tier = "large";
    cashout = net_gain * tiers.large.cashout_pct;
    reinvest = net_gain - cashout;
  } else if (net_gain >= tiers.medium.min) {
    tier = "medium";
    cashout = net_gain * tiers.medium.cashout_pct;
    reinvest = net_gain - cashout;
  } else if (net_gain >= tiers.small.min) {
    tier = "small";
    cashout = net_gain * tiers.small.cashout_pct;
    reinvest = net_gain - cashout;
  }

  if (tier !== "none") {
    state.C.balance -= (cashout + reinvest);
    state.S.balance += reinvest;
    state.lifetime.total_cashout += cashout;
    state.lifetime.total_reinvest += reinvest;
    state.C.balance_at_last_distribution = state.C.balance;
    state.C.miss_streak_months = 0;
    notes.push(
      `C net_gain $${net_gain.toFixed(2)} · ${tier} tier · cashout $${cashout.toFixed(2)} / reinvest $${reinvest.toFixed(2)}`
    );
  } else {
    state.C.miss_streak_months += 1;
    notes.push(`C net_gain $${net_gain.toFixed(2)} < $50 · 累积 · streak ${state.C.miss_streak_months}`);
    if (state.C.miss_streak_months >= 5) {
      notes.push("⚠ C 连 5 月未触 cashout · 建议审 signal · 阈放宽 / retire");
    }
  }

  // ─── 3. 月度复位 + drawdown 熔断解除 ───
  const drawdown_S_pct = (S_start - S_end) / S_start;

  state.S.month_start_balance = state.S.balance;
  state.S.month_start_ts = now.toISOString();

  // C 暂停到期 · 月底自动恢复
  if (state.circuit_state === "paused_C") {
    state.circuit_state = "running";
    state.circuit_reason = "month_end_resume";
    notes.push("C 池暂停解除");
  }

  // ─── 4. 写月度历史 ───
  state.lifetime.month_history.push({
    month,
    S_start,
    S_end,
    S_to_C_transfer,
    C_distribution:
      tier !== "none"
        ? { cashout, reinvest, tier }
        : undefined,
    drawdown_S_pct,
  });

  writePools(state);

  return {
    month,
    S_start,
    S_end,
    S_to_C_transfer,
    C_distribution: { cashout, reinvest, tier, net_gain },
    drawdown_S_pct,
    circuit_state_after: state.circuit_state,
    notes,
  };
}

/// 实时检 · drawdown 触发熔断 · 不等月底
export function checkRealtimeCircuit(): { changed: boolean; state: PoolsState | null } {
  const state = readPools();
  if (!state) return { changed: false, state: null };
  const before = state.circuit_state;

  const dd = (state.S.month_start_balance - state.S.balance) / state.S.month_start_balance;

  if (dd >= POOLS_CONFIG.DRAWDOWN_FULL_PAUSE_PCT && state.circuit_state !== "paused_all") {
    state.circuit_state = "paused_all";
    state.circuit_reason = `realtime drawdown ${(dd * 100).toFixed(1)}%`;
    state.circuit_until = new Date(Date.now() + 7 * 86400_000).toISOString();
  } else if (
    dd >= POOLS_CONFIG.DRAWDOWN_C_PAUSE_PCT &&
    state.circuit_state === "running"
  ) {
    state.circuit_state = "paused_C";
    state.circuit_reason = `realtime drawdown ${(dd * 100).toFixed(1)}%`;
  }

  // 红线
  const total = state.S.balance + state.C.balance;
  if (total < state.P0 * POOLS_CONFIG.RED_LINE_PCT) {
    state.circuit_state = "red_line";
    state.circuit_reason = `total ${total.toFixed(2)} < P0 × 0.85`;
  }

  if (state.circuit_state !== before) {
    writePools(state);
    return { changed: true, state };
  }
  return { changed: false, state };
}
