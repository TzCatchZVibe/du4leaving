// 虾盘 · 经济学/投资学/对冲基金核心数学 lib
// 综合 25 个 PM 操作模式 · 共用计算

// ─────────── Kelly 系列 ───────────
export function kellyFrac(modelP: number, costPriceCents: number, scale = 0.25): number {
  const cost = costPriceCents / 100;
  if (cost <= 0 || cost >= 1) return 0;
  const raw = (modelP - cost) / (1 - cost);
  return Math.max(0, Math.min(0.5, raw)) * scale;
}

// ─────────── EV / 期望值 ───────────
export function expectedValue(modelP: number, costPriceCents: number): number {
  const cost = costPriceCents / 100;
  if (cost <= 0 || cost >= 1) return 0;
  return modelP / cost - 1; // per dollar staked
}

// ─────────── Sharpe / Sortino / Calmar ───────────
export function annualizedReturn(daily: number[]): number {
  if (daily.length < 2) return 0;
  const total = daily.reduce((a, b) => a * (1 + b), 1);
  const days = daily.length;
  return Math.pow(total, 365 / days) - 1;
}

export function dailyReturns(snaps: { netWorth: number }[]): number[] {
  if (snaps.length < 2) return [];
  const r: number[] = [];
  for (let i = 1; i < snaps.length; i++) {
    if (snaps[i - 1].netWorth > 0) {
      r.push((snaps[i].netWorth - snaps[i - 1].netWorth) / snaps[i - 1].netWorth);
    }
  }
  return r;
}

export function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function sharpeRatio(daily: number[], rfDaily = 0.0001): number {
  if (daily.length < 2) return 0;
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const sd = stdev(daily);
  if (sd === 0) return 0;
  return ((mean - rfDaily) / sd) * Math.sqrt(252);
}

export function sortinoRatio(daily: number[], rfDaily = 0.0001): number {
  if (daily.length < 2) return 0;
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const downside = daily.filter((r) => r < 0);
  const dSd = stdev(downside);
  if (dSd === 0) return 0;
  return ((mean - rfDaily) / dSd) * Math.sqrt(252);
}

export function maxDrawdown(snaps: { netWorth: number }[]): {
  pct: number;
  amount: number;
  peakIdx: number;
  troughIdx: number;
} {
  if (snaps.length < 2)
    return { pct: 0, amount: 0, peakIdx: 0, troughIdx: 0 };
  let peak = snaps[0].netWorth;
  let peakIdx = 0;
  let maxDD = 0;
  let maxDDAmount = 0;
  let troughIdx = 0;
  for (let i = 1; i < snaps.length; i++) {
    if (snaps[i].netWorth > peak) {
      peak = snaps[i].netWorth;
      peakIdx = i;
    }
    const dd = (peak - snaps[i].netWorth) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDAmount = peak - snaps[i].netWorth;
      troughIdx = i;
    }
  }
  return { pct: maxDD, amount: maxDDAmount, peakIdx, troughIdx };
}

export function calmarRatio(daily: number[], snaps: { netWorth: number }[]): number {
  const mdd = maxDrawdown(snaps).pct;
  if (mdd === 0) return 0;
  const ann = annualizedReturn(daily);
  return ann / mdd;
}

// ─────────── VaR (95% 单日最大可亏) ───────────
// Historical VaR · 取 5% 分位数
export function historicalVaR(daily: number[], confidence = 0.95, bankroll = 1): number {
  if (daily.length < 5) return 0;
  const sorted = [...daily].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return -sorted[idx] * bankroll; // 正数表示可亏多少
}

// Parametric VaR (假设正态)
export function parametricVaR(daily: number[], confidence = 0.95, bankroll = 1): number {
  if (daily.length < 5) return 0;
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const sd = stdev(daily);
  // z(0.95) = 1.645 · z(0.99) = 2.326
  const z = confidence >= 0.99 ? 2.326 : 1.645;
  return -(mean - z * sd) * bankroll;
}

// ─────────── Risk of Ruin ───────────
// 简单公式 · 给定 win rate p · win amount W · loss amount L · bankroll B · 单笔 stake S
// RoR ≈ ((1-edge) / (1+edge))^(B/S)  (近似 · 假设 W=L)
export function riskOfRuin(opts: {
  winRate: number; // 0-1
  edgePerBet: number; // 0-1 (e.g. 0.05 = 5%)
  bankroll: number;
  stakePerBet: number;
}): number {
  const { winRate, edgePerBet, bankroll, stakePerBet } = opts;
  if (winRate <= 0.5) return 1; // 负 edge 必破产
  if (stakePerBet <= 0 || bankroll <= 0) return 0;
  const a = (1 - edgePerBet) / (1 + edgePerBet);
  const n = bankroll / stakePerBet;
  return Math.min(1, Math.pow(a, n));
}

// ─────────── Convexity (凸/凹利) ───────────
// 凸 = 低成本高 payoff (eg 5¢ 押冷门) · 凹 = 高成本低 payoff (95¢ 大热)
export function convexityScore(buyPriceCents: number): {
  type: "convex" | "concave" | "neutral";
  score: number; // -1 to 1
  description: string;
} {
  if (buyPriceCents < 20) {
    return {
      type: "convex",
      score: 1 - buyPriceCents / 20,
      description: "凸利 · 低成本高 payoff · tail bet · 黑天鹅保险",
    };
  }
  if (buyPriceCents > 80) {
    return {
      type: "concave",
      score: -((buyPriceCents - 80) / 20),
      description: "凹利 · 高成本低 payoff · 大热门陷阱 · 收益小风险大",
    };
  }
  return {
    type: "neutral",
    score: 0,
    description: "中性 · 价格中段 · 风险回报对称",
  };
}

// ─────────── 信心评分 (Conviction Sizing) ───────────
export function convictionScore(opts: {
  edgePp: number;
  vol24Usd: number;
  spreadCents: number | null;
  isReverse: boolean;
  modelBrier: number; // 模型 Brier · 越低越准
}): { score: number; tier: "low" | "med" | "high" | "max"; reasons: string[] } {
  const { edgePp, vol24Usd, spreadCents, isReverse, modelBrier } = opts;
  let score = 50; // 基础 50
  const reasons: string[] = [];

  if (edgePp >= 8) {
    score += 25;
    reasons.push(`edge ${edgePp.toFixed(1)}pp 大 +25`);
  } else if (edgePp >= 5) {
    score += 15;
    reasons.push(`edge ${edgePp.toFixed(1)}pp +15`);
  } else if (edgePp < 3) {
    score -= 15;
    reasons.push(`edge 太小 -15`);
  }

  if (vol24Usd >= 5000) {
    score += 10;
    reasons.push("流动性强 +10");
  } else if (vol24Usd < 200) {
    score -= 20;
    reasons.push("流动性差 -20");
  }

  if (spreadCents != null) {
    if (spreadCents <= 2) {
      score += 5;
      reasons.push("价差紧 +5");
    } else if (spreadCents > 5) {
      score -= 10;
      reasons.push(`价差 ${spreadCents}¢ -10`);
    }
  }

  if (isReverse) {
    score -= 15;
    reasons.push("反向单 -15 (sharp 已 price)");
  }

  if (modelBrier < 0.20) {
    score += 10;
    reasons.push("模型校准好 +10");
  } else if (modelBrier > 0.24) {
    score -= 10;
    reasons.push("模型边缘 -10");
  }

  score = Math.max(0, Math.min(100, score));
  const tier =
    score >= 80 ? "max" : score >= 60 ? "high" : score >= 40 ? "med" : "low";
  return { score, tier, reasons };
}

// ─────────── 集中度 / 多元化 ───────────
export function concentrationCheck(positions: Array<{ exposure: number; ticker: string }>): {
  hhi: number; // Herfindahl Index 0-10000
  topShare: number; // 0-1
  warning: string | null;
} {
  if (positions.length === 0)
    return { hhi: 0, topShare: 0, warning: null };
  const total = positions.reduce((s, p) => s + p.exposure, 0);
  if (total === 0) return { hhi: 0, topShare: 0, warning: null };
  const shares = positions.map((p) => p.exposure / total);
  const hhi = shares.reduce((s, x) => s + (x * 100) ** 2, 0);
  const topShare = Math.max(...shares);
  let warning: string | null = null;
  if (topShare > 0.5)
    warning = `单笔占总仓 ${(topShare * 100).toFixed(0)}% · 集中度过高 · 分散`;
  else if (hhi > 5000) warning = "总体过于集中 · 加仓其他赛事";
  return { hhi, topShare, warning };
}

// ─────────── 压力测试 ───────────
export function stressTest(opts: {
  bankroll: number;
  stakePerBet: number;
  loseStreak: number;
}): { worstCase: number; pctLoss: number; survived: boolean } {
  const totalLoss = opts.stakePerBet * opts.loseStreak;
  const after = opts.bankroll - totalLoss;
  return {
    worstCase: after,
    pctLoss: opts.bankroll > 0 ? totalLoss / opts.bankroll : 0,
    survived: after > 0,
  };
}

// ─────────── Stop-Loss 建议 ───────────
export function stopLossSuggest(opts: {
  unrealizedPnl: number;
  exposure: number;
  threshold?: number; // 默认 -50% 浮亏
}): { shouldSell: boolean; reason: string; severity: "info" | "warn" | "critical" } {
  const { unrealizedPnl, exposure, threshold = -0.5 } = opts;
  if (exposure <= 0) return { shouldSell: false, reason: "无持仓", severity: "info" };
  const pct = unrealizedPnl / exposure;
  if (pct <= -0.8)
    return { shouldSell: true, reason: "浮亏 80%+ · 强烈建议立刻平仓 · 不抗", severity: "critical" };
  if (pct <= threshold)
    return { shouldSell: true, reason: `浮亏 ${(-pct * 100).toFixed(0)}% · 建议 sell 锁亏 · 不要扛`, severity: "warn" };
  if (pct >= 0.5)
    return { shouldSell: false, reason: `浮盈 ${(pct * 100).toFixed(0)}% · 可考虑提早 sell 锁利`, severity: "info" };
  return { shouldSell: false, reason: "继续持有", severity: "info" };
}

// ─────────── 行为偏差警告 ───────────
export function biasWarnings(opts: {
  recentResults: ("win" | "loss")[];
  todayPnl: number;
  betsToday: number;
}): string[] {
  const out: string[] = [];
  const last5 = opts.recentResults.slice(-5);
  const wins = last5.filter((x) => x === "win").length;
  const losses = last5.filter((x) => x === "loss").length;
  if (wins >= 4)
    out.push("⚠ Recency Bias · 你刚连赢 4 单 · 别加仓 · 大数定律会回归");
  if (losses >= 3)
    out.push("⚠ Loss Aversion · 你连输 3 单 · 别情绪追损 · 24h 冷静");
  if (opts.betsToday >= 8)
    out.push("⚠ Overtrading · 今天已下 8+ 单 · 决策质量下降 · 停手");
  if (opts.todayPnl < -15)
    out.push("⚠ 今日亏损 > $15 · 强制冷静期 · 不下了");
  if (opts.todayPnl > 30)
    out.push("⚠ 今日已赚 $30+ · House Money Effect · 别梭哈赢的钱");
  return out;
}
