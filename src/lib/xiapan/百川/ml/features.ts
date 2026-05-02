// 百川/ml/features.ts · lesson → 特征向量
// V0.72 W3 Day 9 · 自进化模型 · 训练数据特征化

import type { LessonRecord } from "../lessons";

export const ALL_SOURCES = [
  "btc-bs", "btc-cross-tenor", "btc-cross-platform",
  "eth-bs", "eth-cross-tenor", "eth-cross-platform",
  "sol-bs", "sol-cross-tenor", "sol-cross-platform",
  "weather-nws", "weather-meteo",
  "contrarian",
  "nba-elo",
  "fed-cross-platform",
  "fda-adcom",
  "mention-engine",
] as const;

export interface Features {
  edge_pp: number;
  n_active: number;
  market_implied_p: number;
  predicted_p: number;
  edge_abs: number;
  predicted_p_squared: number;        // 非线性 · 极端 P 预测信号弱
  is_convex: number;                  // 0/1
  hour: number;                       // 0-23
  day_of_week: number;                // 0-6 (Sun=0)
  stake: number;                      // log scale
  // 信号源 one-hot (16 个 source)
  src_btc_bs: number;
  src_btc_cross_tenor: number;
  src_btc_cross_platform: number;
  src_eth_bs: number;
  src_eth_cross_tenor: number;
  src_eth_cross_platform: number;
  src_sol_bs: number;
  src_sol_cross_tenor: number;
  src_sol_cross_platform: number;
  src_weather_nws: number;
  src_weather_meteo: number;
  src_contrarian: number;
  src_nba_elo: number;
  src_fed_cross_platform: number;
  src_fda_adcom: number;
  src_mention_engine: number;
}

export const FEATURE_KEYS: Array<keyof Features> = [
  "edge_pp", "n_active", "market_implied_p", "predicted_p",
  "edge_abs", "predicted_p_squared", "is_convex",
  "hour", "day_of_week", "stake",
  "src_btc_bs", "src_btc_cross_tenor", "src_btc_cross_platform",
  "src_eth_bs", "src_eth_cross_tenor", "src_eth_cross_platform",
  "src_sol_bs", "src_sol_cross_tenor", "src_sol_cross_platform",
  "src_weather_nws", "src_weather_meteo",
  "src_contrarian",
  "src_nba_elo",
  "src_fed_cross_platform",
  "src_fda_adcom",
  "src_mention_engine",
];

export function extractFeatures(l: LessonRecord): Features {
  const ts = new Date(l.ts);
  const sources = new Set(l.signals_active ?? []);
  const has = (s: string) => (sources.has(s) ? 1 : 0);
  const stake_log = Math.log10(Math.max(0.01, l.stake));

  return {
    edge_pp: l.edge_pp,
    n_active: l.n_active,
    market_implied_p: l.market_implied_p,
    predicted_p: l.predicted_p,
    edge_abs: Math.abs(l.edge_pp),
    predicted_p_squared: l.predicted_p * l.predicted_p,
    is_convex: l.bucket === "convex" ? 1 : 0,
    hour: ts.getUTCHours(),
    day_of_week: ts.getUTCDay(),
    stake: stake_log,
    src_btc_bs: has("btc-bs"),
    src_btc_cross_tenor: has("btc-cross-tenor"),
    src_btc_cross_platform: has("btc-cross-platform"),
    src_eth_bs: has("eth-bs"),
    src_eth_cross_tenor: has("eth-cross-tenor"),
    src_eth_cross_platform: has("eth-cross-platform"),
    src_sol_bs: has("sol-bs"),
    src_sol_cross_tenor: has("sol-cross-tenor"),
    src_sol_cross_platform: has("sol-cross-platform"),
    src_weather_nws: has("weather-nws"),
    src_weather_meteo: has("weather-meteo"),
    src_contrarian: has("contrarian"),
    src_nba_elo: has("nba-elo"),
    src_fed_cross_platform: has("fed-cross-platform"),
    src_fda_adcom: has("fda-adcom"),
    src_mention_engine: has("mention-engine"),
  };
}

/// ticker → board 分类 · 决定用哪个模型
export function inferBoard(ticker: string): string {
  const t = ticker.toUpperCase();
  if (t.startsWith("KXBTC")) return "btc";
  if (t.startsWith("KXETH")) return "eth";
  if (t.startsWith("KXSOL")) return "sol";
  if (t.startsWith("KXHIGH") || t.startsWith("KXLOW") || t.startsWith("KXPRECIP")) return "weather";
  if (t.startsWith("KXNBA")) return "nba";
  if (t.startsWith("KXFED") || t.startsWith("KXCPI") || t.startsWith("KXJOBS") || t.startsWith("KXGDP")) return "fed";
  if (t.startsWith("KXFDA")) return "fda";
  return "other";
}

export function featuresToVector(f: Features): number[] {
  return FEATURE_KEYS.map((k) => f[k]);
}
