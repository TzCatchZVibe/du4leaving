// 虾盘 · 自适应策略引擎
// 钱生钱核心 · 根据近期表现动态调 Kelly 系数 / edge 阈值 / 仓位
//
// 逻辑 ·
//   1. 每日跑一次 (前端 effect 触发) · 算近 7 天 ROI / streak
//   2. 决定下一阶段的 Kelly 系数 + edge 阈值
//   3. 自动 cashout 检查 (达阈值高亮提醒)
//   4. 利润复利再投: 60% 留场, 40% cashout

export type DailyResult = {
  date: string; // YYYY-MM-DD
  pnl: number; // $
  turnover: number; // 总下注 $
  trades: number;
  wins: number;
  losses: number;
};

export type StrategyState = {
  kellyMultiplier: number; // 0.25 / 0.5 / 0.75 / 1.0
  edgeThresholdStrong: number; // pp
  edgeThresholdWatch: number; // pp
  maxSinglePositionPctBankroll: number; // 0.05-0.125
  reasoning: string[];
  recommendedAction: "play" | "play_reduced" | "watch_only" | "cooldown";
  sevenDayPnl: number;
  sevenDayRoi: number;
  recentStreak: { type: "win" | "loss" | "none"; count: number };
};

const DEFAULT_STATE: StrategyState = {
  kellyMultiplier: 0.75,
  edgeThresholdStrong: 5,
  edgeThresholdWatch: 3,
  maxSinglePositionPctBankroll: 0.1,
  reasoning: ["首次启动 · 默认中庸策略 · 7 天后自适应"],
  recommendedAction: "play",
  sevenDayPnl: 0,
  sevenDayRoi: 0,
  recentStreak: { type: "none", count: 0 },
};

export function computeStrategy(opts: {
  dailyResults: DailyResult[]; // 最近 30 天
  recentTrades: ("win" | "loss")[]; // 最近 10 单
  currentBankroll: number;
}): StrategyState {
  const { dailyResults, recentTrades, currentBankroll } = opts;

  // 没数据 → 默认
  if (dailyResults.length === 0 && recentTrades.length === 0) {
    return DEFAULT_STATE;
  }

  // 1. 近 7 天 ROI
  const last7 = dailyResults.slice(-7);
  const sevenDayPnl = last7.reduce((s, d) => s + d.pnl, 0);
  const totalTurnover = last7.reduce((s, d) => s + d.turnover, 0);
  const sevenDayRoi =
    totalTurnover > 0 ? (sevenDayPnl / totalTurnover) * 100 : 0;

  // 2. streak
  let streakType: "win" | "loss" | "none" = "none";
  let streakCount = 0;
  if (recentTrades.length > 0) {
    streakType = recentTrades[recentTrades.length - 1];
    for (let i = recentTrades.length - 1; i >= 0; i--) {
      if (recentTrades[i] === streakType) streakCount++;
      else break;
    }
  }

  // 3. 决定 multiplier
  const reasoning: string[] = [];
  let mult = 0.75;
  let action: StrategyState["recommendedAction"] = "play";
  let edgeStrong = 5;
  let edgeWatch = 3;
  let maxPct = 0.1;

  if (streakType === "loss" && streakCount >= 3) {
    mult = 0.25;
    action = "cooldown";
    edgeStrong = 8;
    edgeWatch = 6;
    maxPct = 0.05;
    reasoning.push(`连输 ${streakCount} 单 · 系数降至 0.25 · edge 阈值提高`);
    reasoning.push("建议暂停 30min · 防情绪追损");
  } else if (sevenDayRoi >= 5 && sevenDayPnl > 0) {
    mult = 1.0;
    action = "play";
    edgeStrong = 4;
    edgeWatch = 2.5;
    maxPct = 0.125;
    reasoning.push(`近 7d ROI +${sevenDayRoi.toFixed(1)}% · 模型表现好`);
    reasoning.push("Kelly 系数 1.0 · edge 阈值降低 (敢下小 edge)");
  } else if (sevenDayRoi < -5) {
    mult = 0.4;
    action = "play_reduced";
    edgeStrong = 7;
    edgeWatch = 5;
    maxPct = 0.075;
    reasoning.push(`近 7d ROI ${sevenDayRoi.toFixed(1)}% · 减仓 60%`);
    reasoning.push("拉高 edge 阈值 · 只下高确定性");
  } else if (sevenDayRoi >= 0) {
    mult = 0.75;
    action = "play";
    reasoning.push(`近 7d ROI ${sevenDayRoi.toFixed(1)}% · 中庸策略`);
  } else {
    mult = 0.5;
    action = "play_reduced";
    edgeStrong = 6;
    edgeWatch = 4;
    reasoning.push(`近 7d ROI ${sevenDayRoi.toFixed(1)}% · 系数 0.5 减半`);
  }

  // streak 修饰
  if (streakType === "win" && streakCount >= 5) {
    mult = Math.min(mult, 0.75);
    reasoning.push(`连赢 ${streakCount} 单 · 锁系数 ≤ 0.75 防过度自信`);
  }

  // 4. bankroll 大小修饰 (小 bankroll 强制保守)
  if (currentBankroll < 50) {
    mult = Math.min(mult, 0.5);
    maxPct = Math.min(maxPct, 0.075);
    reasoning.push("Bankroll < $50 · 系数封 0.5 · 防一夜亏完");
  }

  return {
    kellyMultiplier: mult,
    edgeThresholdStrong: edgeStrong,
    edgeThresholdWatch: edgeWatch,
    maxSinglePositionPctBankroll: maxPct,
    reasoning,
    recommendedAction: action,
    sevenDayPnl,
    sevenDayRoi,
    recentStreak: { type: streakType, count: streakCount },
  };
}

// 自动 cashout 触发条件
export type CashoutSignal = {
  trigger: boolean;
  amount: number;
  reason: string;
  priority: "high" | "medium" | "low";
};

export function checkCashoutTriggers(state: {
  balanceUsd: number;
  weekStartBalanceUsd: number;
  monthStartBalanceUsd: number;
  workingFundCap: number; // 工作仓上限 (e.g. $200)
}): CashoutSignal[] {
  const sigs: CashoutSignal[] = [];

  // 工作仓溢出 → 强制提
  if (state.balanceUsd > state.workingFundCap) {
    sigs.push({
      trigger: true,
      amount: Math.floor(state.balanceUsd - state.workingFundCap),
      reason: `余额超工作仓上限 $${state.workingFundCap} · 强制提溢出 → Capital One`,
      priority: "high",
    });
  }

  // 周末利润提一半
  const weekPnl = state.balanceUsd - state.weekStartBalanceUsd;
  if (weekPnl >= 50) {
    sigs.push({
      trigger: true,
      amount: Math.floor(weekPnl * 0.5),
      reason: `本周净赚 $${weekPnl.toFixed(0)} · 提 50% 锁定利润 · 钱生钱核心`,
      priority: "medium",
    });
  }

  // 月底大胜
  if (state.balanceUsd >= 500) {
    const target = 300;
    sigs.push({
      trigger: true,
      amount: Math.floor(state.balanceUsd - target),
      reason: `余额 ≥ $500 · 提到 $${target} 工作仓 · 复利再投 60% / cashout 40%`,
      priority: "medium",
    });
  }

  return sigs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

// 钱生钱 · 复利再投比例
export function reinvestmentSplit(profitUsd: number): {
  reinvest: number;
  cashout: number;
} {
  // 60% 留场复利 / 40% cashout 锁利
  return {
    reinvest: Math.round(profitUsd * 0.6 * 100) / 100,
    cashout: Math.round(profitUsd * 0.4 * 100) / 100,
  };
}
