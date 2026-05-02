// 百川/ml/predict.ts · 加载 · 预测 · 缓存
// V0.72 W3 Day 9 · 推理时被 fusion 调

import { loadBoardModel } from "./train";
import { extractFeatures, featuresToVector, inferBoard } from "./features";
import { logistic_predict_raw, type LogRegModel } from "./logreg";
import type { LessonRecord } from "../lessons";

// 进程内缓存 · 1 小时
const CACHE_TTL_MS = 60 * 60_000;
let _cache = new Map<string, { ts: number; model: LogRegModel | null }>();

export function getModel(board: string): LogRegModel | null {
  const c = _cache.get(board);
  if (c && Date.now() - c.ts < CACHE_TTL_MS) return c.model;
  const m = loadBoardModel(board);
  _cache.set(board, { ts: Date.now(), model: m });
  return m;
}

export function clearCache() {
  _cache.clear();
}

export interface MLPrediction {
  board: string;
  has_model: boolean;
  ml_p: number | null;            // ML 给出的 P(yes)
  brier_val: number | null;       // 验证集 brier · 越低越准
  n_train: number;
  ts_trained?: string;
}

/// 给一个 lesson-like (含 ticker · 信号特征) · 输出 ML 估值
export function predictML(lessonLike: LessonRecord): MLPrediction {
  const board = inferBoard(lessonLike.ticker);
  const m = getModel(board);
  if (!m) {
    return { board, has_model: false, ml_p: null, brier_val: null, n_train: 0 };
  }
  const x = featuresToVector(extractFeatures(lessonLike));
  const p = logistic_predict_raw(m, x);
  return {
    board,
    has_model: true,
    ml_p: p,
    brier_val: m.metrics.val_brier,
    n_train: m.n_train,
    ts_trained: m.trained_at,
  };
}
