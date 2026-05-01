// 百川/options-pricing.ts · Black-Scholes 二元期权定价
// V0.72 · BTC / ETH / SOL 等加密二元市场公允价
//
// 数学 ·
//   binary call (cash-or-nothing) · P_yes = N(d2)
//   binary put · P_no = N(-d2) = 1 - N(d2)
//   range · P(K1 < S_T < K2) = N(d2_K1) - N(d2_K2)
//
// 其中 ·
//   d2 = [ ln(S/K) + (r - σ²/2) × T ] / (σ × √T)

// 标准正态 CDF · Abramowitz & Stegun 26.2.17 近似
export function normalCDF(x: number): number {
  // 误差 < 7.5e-8 · 够二元期权用
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const xa = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * xa);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-xa * xa);
  return 0.5 * (1 + sign * y);
}

export interface BSInput {
  spot: number;            // 现货 (e.g. BTC $66500)
  strike: number;          // 行权价 ($68000)
  T_years: number;         // 距到期 · 年化 (天/365)
  sigma_annual: number;    // 年化波动率 (e.g. 0.55 = 55%)
  r?: number;              // 无风险利率 · 默认 4.5%
}

/// 二元 CALL · "S_T ≥ K 的概率"
export function binaryCallFairP(opts: BSInput): number {
  const { spot, strike, T_years, sigma_annual, r = 0.045 } = opts;
  if (T_years <= 0) {
    return spot >= strike ? 1.0 : 0.0;
  }
  if (sigma_annual <= 0) return spot >= strike ? 1.0 : 0.0;
  if (spot <= 0 || strike <= 0) return 0.5;

  const d2 =
    (Math.log(spot / strike) + (r - 0.5 * sigma_annual * sigma_annual) * T_years) /
    (sigma_annual * Math.sqrt(T_years));
  return normalCDF(d2);
}

/// 二元 PUT · "S_T < K 的概率"
export function binaryPutFairP(opts: BSInput): number {
  return 1 - binaryCallFairP(opts);
}

/// 范围 · "K1 < S_T < K2 的概率"
export function rangeFairP(spot: number, K1: number, K2: number, T: number, sigma: number, r = 0.045): number {
  if (K1 > K2) [K1, K2] = [K2, K1];
  const pK1 = binaryCallFairP({ spot, strike: K1, T_years: T, sigma_annual: sigma, r });
  const pK2 = binaryCallFairP({ spot, strike: K2, T_years: T, sigma_annual: sigma, r });
  return pK1 - pK2;
}

// ─────────────────── Realized Vol (annualized) ───────────────────

/// 从历史 close 价数组算年化波动率
/// prices · 时间序列 · periodsPerYear · 1d=365 / 1h=8760 / 1m=525600
export function realizedVol(prices: number[], periodsPerYear = 365): number {
  if (prices.length < 5) return 0.6;       // 不够 · 默认 60% (BTC 历史均值)
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  if (returns.length < 4) return 0.6;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * periodsPerYear);
}

/// 双时间尺度 vol · 取 max (短期飙时跟短期)
export function adaptiveVol(opts: {
  prices_30d: number[];           // 30 个日 close
  prices_7d?: number[];           // 7 个日 close (可选)
}): number {
  const v30 = realizedVol(opts.prices_30d, 365);
  if (!opts.prices_7d || opts.prices_7d.length < 4) return v30 * 1.05;
  const v7 = realizedVol(opts.prices_7d, 365);
  // 短期 vol 飙时 · 用短期 + buffer · 防止 BS 滞后
  return Math.max(v30, v7 * 1.20) * 1.05;
}

// ─────────────────── 反推隐含 vol ───────────────────

/// 已知市场 P · 反推隐含 sigma (二分查找)
/// 用于 vol 套利信号 (隐含 vs 实现)
export function impliedVol(opts: {
  market_p: number;            // 市场 P_yes
  spot: number;
  strike: number;
  T_years: number;
  r?: number;
  side?: "call" | "put";
}): number {
  const { market_p, spot, strike, T_years, r = 0.045, side = "call" } = opts;
  let lo = 0.01;
  let hi = 5.0;                  // 500% 上限
  const target = market_p;
  const fn = side === "call" ? binaryCallFairP : binaryPutFairP;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const p = fn({ spot, strike, T_years, sigma_annual: mid, r });
    if (Math.abs(p - target) < 1e-5) return mid;
    // call P 单调递增 σ ? 当 K > S 时 yes · 当 K < S 时 ↓ (call 反过来)
    // 简化 · 用方向修正
    if (spot < strike) {                // OTM call · σ↑ → P↑
      if (p < target) lo = mid;
      else hi = mid;
    } else {                            // ITM call · σ↑ → P 趋向 0.5
      if (p > target) lo = mid;
      else hi = mid;
    }
  }
  return (lo + hi) / 2;
}
