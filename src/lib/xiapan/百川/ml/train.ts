// 百川/ml/train.ts · 每板块训练 · 自进化大脑
// V0.72 W3 Day 9
//
// 流程 ·
//   1. 读 lessons.jsonl · 仅已结算 (actual ∈ {0,1})
//   2. 按 board (btc/eth/sol/weather/nba/fed/fda/other) 分组
//   3. 数据 ≥ 100 才训 · 否则跳
//   4. 训练 logistic regression · 标准化 · L2 正则
//   5. 验证 brier vs naive (历史平均胜率) · 改进 ≥ 0.01 才保存
//   6. 模型存 ~/.du4leaving/百川/ml/{board}.json

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readAllLessons } from "../lessons";
import { extractFeatures, FEATURE_KEYS, featuresToVector, inferBoard } from "./features";
import { trainLogReg, type LogRegModel } from "./logreg";

const HOME = os.homedir();
const ML_DIR = path.join(HOME, ".du4leaving", "百川", "ml");

function ensureDir() {
  if (!fs.existsSync(ML_DIR)) fs.mkdirSync(ML_DIR, { recursive: true });
}

export interface TrainResult {
  board: string;
  status: "trained" | "skipped" | "rejected";
  n_samples: number;
  reason?: string;
  model?: LogRegModel;
  improvement_over_naive?: number;
}

const MIN_SAMPLES = 100;             // 数据门槛
const MIN_IMPROVEMENT = 0.01;        // 比 naive baseline 至少改进 0.01 brier

export function trainAllBoards(): TrainResult[] {
  ensureDir();
  const lessons = readAllLessons();
  const closed = lessons.filter((l) => l.actual === 0 || l.actual === 1);
  if (closed.length === 0) {
    return [{ board: "all", status: "skipped", n_samples: 0, reason: "0 closed lessons" }];
  }

  // 按 board 分
  const groups = new Map<string, typeof closed>();
  for (const l of closed) {
    const b = inferBoard(l.ticker);
    const arr = groups.get(b) ?? [];
    arr.push(l);
    groups.set(b, arr);
  }

  const results: TrainResult[] = [];

  for (const [board, lessonsForBoard] of groups) {
    if (lessonsForBoard.length < MIN_SAMPLES) {
      results.push({
        board,
        status: "skipped",
        n_samples: lessonsForBoard.length,
        reason: `< ${MIN_SAMPLES} samples`,
      });
      continue;
    }

    // 准备 X / y
    const X = lessonsForBoard.map((l) => featuresToVector(extractFeatures(l)));
    const y: number[] = lessonsForBoard.map((l) => (l.actual === 1 ? 1 : 0));

    let model: LogRegModel;
    try {
      model = trainLogReg({
        X, y,
        feature_keys: [...FEATURE_KEYS],
        l2: 0.01,
        lr: 0.1,
        epochs: 200,
        batch_size: 32,
        val_frac: 0.2,
      });
    } catch (e) {
      results.push({
        board,
        status: "skipped",
        n_samples: lessonsForBoard.length,
        reason: (e as Error).message,
      });
      continue;
    }

    // baseline · naive predict (历史平均胜率) brier
    const meanY = y.reduce((s, v) => s + v, 0) / y.length;
    const naive_brier = y.reduce((s, v) => s + (meanY - v) ** 2, 0) / y.length;
    const improvement = naive_brier - model.metrics.val_brier;

    if (improvement < MIN_IMPROVEMENT) {
      results.push({
        board,
        status: "rejected",
        n_samples: lessonsForBoard.length,
        improvement_over_naive: improvement,
        reason: `improvement ${improvement.toFixed(3)} < ${MIN_IMPROVEMENT}`,
      });
      continue;
    }

    // 保存
    const file = path.join(ML_DIR, `${board}.json`);
    fs.writeFileSync(file, JSON.stringify(model, null, 2), "utf8");
    results.push({
      board,
      status: "trained",
      n_samples: lessonsForBoard.length,
      improvement_over_naive: improvement,
      model,
    });
  }

  // 写训练记录到 audit log
  const audit = {
    ts: new Date().toISOString(),
    results: results.map((r) => ({
      board: r.board,
      status: r.status,
      n: r.n_samples,
      reason: r.reason,
      improvement: r.improvement_over_naive,
    })),
  };
  const auditFile = path.join(ML_DIR, "training-history.jsonl");
  fs.appendFileSync(auditFile, JSON.stringify(audit) + "\n");

  return results;
}

export function loadBoardModel(board: string): LogRegModel | null {
  const file = path.join(ML_DIR, `${board}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as LogRegModel;
  } catch {
    return null;
  }
}

export const ML_PATHS = { ML_DIR };
