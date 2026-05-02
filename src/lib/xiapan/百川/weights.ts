// 百川/weights.ts · 信号权重持久化
// V0.72 · Brier 自适应 · 每周更新

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const WEIGHTS_DIR = path.join(HOME, ".du4leaving", "百川");
const WEIGHTS_FILE = path.join(WEIGHTS_DIR, "weights.json");

export interface WeightsState {
  ts: string;
  weights: Record<string, number>;          // source → weight (0-1.5)
  brier_history: Array<{
    ts: string;
    by_source: Record<string, { brier: number; n: number }>;
  }>;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  "btc-bs": 1.0,
  "btc-cross-tenor": 1.0,
  "btc-cross-platform": 1.0,
  "eth-bs": 1.0,
  "eth-cross-tenor": 1.0,
  "eth-cross-platform": 1.0,
  "sol-bs": 1.0,
  "sol-cross-tenor": 1.0,
  "sol-cross-platform": 1.0,
  "weather-nws": 1.0,
  "weather-meteo": 1.0,
  "fed-futures": 1.0,
  "earnings-consensus": 1.0,
  "fda-adcom": 1.0,
  "mention-engine": 1.0,
  "contrarian": 1.0,
  "nba-elo": 1.0,
};

function ensureDir() {
  if (!fs.existsSync(WEIGHTS_DIR)) fs.mkdirSync(WEIGHTS_DIR, { recursive: true });
}

export function loadWeights(): Record<string, number> {
  if (!fs.existsSync(WEIGHTS_FILE)) return { ...DEFAULT_WEIGHTS };
  try {
    const state = JSON.parse(fs.readFileSync(WEIGHTS_FILE, "utf8")) as WeightsState;
    // 默认 + 已有 · 已有覆盖默认
    return { ...DEFAULT_WEIGHTS, ...state.weights };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export function loadWeightsState(): WeightsState | null {
  if (!fs.existsSync(WEIGHTS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(WEIGHTS_FILE, "utf8")) as WeightsState;
  } catch {
    return null;
  }
}

export function saveWeights(weights: Record<string, number>, brier?: Record<string, { brier: number; n: number }>): void {
  ensureDir();
  const existing = loadWeightsState();
  const state: WeightsState = {
    ts: new Date().toISOString(),
    weights,
    brier_history: existing?.brier_history ?? [],
  };
  if (brier) {
    state.brier_history.push({ ts: state.ts, by_source: brier });
    // 仅留近 26 周
    state.brier_history = state.brier_history.slice(-26);
  }
  fs.writeFileSync(WEIGHTS_FILE, JSON.stringify(state, null, 2), "utf8");
}

/// Brier → 权重映射 (反 Brier · 良 Brier 权重高)
export function brierToWeight(brier: number): number {
  if (brier <= 0.18) return 1.5;        // 优 (60%+)
  if (brier <= 0.22) return 1.2;        // 良
  if (brier <= 0.27) return 1.0;        // 中
  if (brier <= 0.32) return 0.7;        // 差
  if (brier <= 0.40) return 0.4;        // 烂
  return 0.0;                            // 退役
}

export const PATHS = { WEIGHTS_DIR, WEIGHTS_FILE };
