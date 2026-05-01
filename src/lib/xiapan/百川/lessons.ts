// 百川/lessons.ts · 服务端 lessons.jsonl
// V0.72 · 取代 native UserDefaults · 让所有 agent 共读
//
// 写 · 每平仓 / 关键事件 一行 JSON
// 读 · brierBySource() / Iris 复盘 / Theo 历史引用

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const LESSONS_DIR = path.join(HOME, ".du4leaving", "百川");
const LESSONS_FILE = path.join(LESSONS_DIR, "lessons.jsonl");

export interface LessonRecord {
  ts: string;                          // ISO open time
  ticker: string;
  category?: string;                   // "btc" | "nba" | "weather" | ...
  bucket: "stable" | "convex";         // 70% / 20% 桶
  side: "yes" | "no";
  signals_active: string[];            // ["btc-bs", "cross-arb"]
  predicted_p: number;                 // fusion 算出的 P_consensus
  fusion_p: number;                    // 同上 (字段冗余 · 兼容旧记录)
  market_implied_p: number;
  edge_pp: number;
  n_active: number;
  stake: number;
  qty: number;
  entry_c: number;

  // 平仓后 update
  ts_close?: string;
  exit_c?: number;
  actual?: 0 | 1;                      // 1 = yes 中
  pnl?: number;
  holding_min?: number;

  // 元
  source?: string;                     // "agent_max" | "manual" | etc
  reason?: string;
  notes?: string;
}

function ensureDir() {
  if (!fs.existsSync(LESSONS_DIR)) fs.mkdirSync(LESSONS_DIR, { recursive: true });
}

export function appendLesson(rec: LessonRecord): void {
  ensureDir();
  fs.appendFileSync(LESSONS_FILE, JSON.stringify(rec) + "\n", "utf8");
}

export function readAllLessons(limit?: number): LessonRecord[] {
  if (!fs.existsSync(LESSONS_FILE)) return [];
  try {
    const text = fs.readFileSync(LESSONS_FILE, "utf8");
    const lines = text.split("\n").filter(Boolean);
    const slice = limit ? lines.slice(-limit) : lines;
    return slice.map((l) => JSON.parse(l) as LessonRecord);
  } catch {
    return [];
  }
}

/// 根据 ticker + ts 找一笔 · 平仓时 update
export function updateLessonOnClose(opts: {
  ticker: string;
  ts_open: string;
  exit_c: number;
  actual: 0 | 1;
  pnl: number;
}): boolean {
  const all = readAllLessons();
  const idx = all.findIndex((l) => l.ticker === opts.ticker && l.ts === opts.ts_open);
  if (idx < 0) return false;

  const lesson = all[idx];
  lesson.ts_close = new Date().toISOString();
  lesson.exit_c = opts.exit_c;
  lesson.actual = opts.actual;
  lesson.pnl = opts.pnl;
  lesson.holding_min = Math.round(
    (new Date(lesson.ts_close).getTime() - new Date(lesson.ts).getTime()) / 60_000
  );

  // 全文重写 (jsonl 简单粗暴 · 量级 ≤ 10k 没问题)
  ensureDir();
  fs.writeFileSync(
    LESSONS_FILE,
    all.map((l) => JSON.stringify(l)).join("\n") + "\n",
    "utf8"
  );
  return true;
}

/// 计算每信号源的 Brier · 仅算已平仓
export function brierBySource(lessons?: LessonRecord[]): Record<string, { brier: number; n: number }> {
  const data = lessons ?? readAllLessons();
  const groups = new Map<string, LessonRecord[]>();
  for (const l of data) {
    if (l.actual === undefined || l.actual === null) continue;
    if (l.predicted_p === undefined || l.predicted_p === null) continue;
    for (const src of l.signals_active ?? []) {
      const arr = groups.get(src) ?? [];
      arr.push(l);
      groups.set(src, arr);
    }
  }
  const out: Record<string, { brier: number; n: number }> = {};
  for (const [src, ls] of groups) {
    if (ls.length < 5) continue;
    const brier = ls.reduce((s, l) => s + (l.predicted_p! - l.actual!) ** 2, 0) / ls.length;
    out[src] = { brier, n: ls.length };
  }
  return out;
}

/// CLV (closing line value) 跟踪 · 每月评估
export function avgCLV(lessons?: LessonRecord[]): number {
  const data = lessons ?? readAllLessons();
  const closed = data.filter((l) => l.exit_c !== undefined && l.entry_c !== undefined);
  if (closed.length === 0) return 0;
  const sum = closed.reduce((s, l) => s + ((l.exit_c! - l.entry_c) * (l.side === "yes" ? 1 : -1)), 0);
  return sum / closed.length;
}

export const PATHS = {
  LESSONS_DIR,
  LESSONS_FILE,
};
