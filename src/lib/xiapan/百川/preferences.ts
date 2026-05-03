// preferences.ts · TZ 偏好配置 · 哪些品类 AI 自动跑 · 哪些 TZ 手动玩
// V0.73 W1 Day 3 · C 模式 · 自动品类隔离

import fs from "node:fs";
import path from "node:path";

const PREF_PATH = path.join(process.env.HOME || "/tmp", ".du4leaving", "preferences.json");

export interface UserPreferences {
  // 用户偏好品类 · AI 不碰 · TZ 自己玩
  user_categories: string[];
  // AI 自动跑的品类
  auto_categories: string[];
  // 上次更新
  updated_at: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  // TZ 现在玩网球 (Panshina vs Wong)
  user_categories: ["tennis", "soccer", "election", "esports"],
  // AI 跑这些 · 系统已有信号源
  auto_categories: ["btc", "eth", "sol", "weather", "fed", "fda", "mention", "nba"],
  updated_at: "2026-05-03T00:00:00Z",
};

export function readPreferences(): UserPreferences {
  try {
    if (!fs.existsSync(PREF_PATH)) {
      writePreferences(DEFAULT_PREFERENCES);
      return DEFAULT_PREFERENCES;
    }
    const raw = fs.readFileSync(PREF_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      user_categories: parsed.user_categories || DEFAULT_PREFERENCES.user_categories,
      auto_categories: parsed.auto_categories || DEFAULT_PREFERENCES.auto_categories,
      updated_at: parsed.updated_at || DEFAULT_PREFERENCES.updated_at,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(p: UserPreferences): void {
  try {
    const dir = path.dirname(PREF_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PREF_PATH, JSON.stringify(p, null, 2));
  } catch (e) {
    console.error("写 preferences 失败 ·", (e as Error).message);
  }
}

// 给 strategy.board 判断是不是该自动跑
export function isAutoCategory(board: string): boolean {
  const p = readPreferences();
  // "all" board · 由两侧都包含的策略 · 让它自动跑
  if (board === "all") return true;
  if (p.user_categories.includes(board)) return false;
  if (p.auto_categories.includes(board)) return true;
  // 默认 · 不在白名单 · 自动跑 (谨慎默认)
  return true;
}

// 给策略列表过滤 · 只保留自动品类
export function filterAutoStrategies<T extends { strategy?: { board: string }; board?: string }>(
  list: T[]
): T[] {
  return list.filter((s) => {
    const board = s.strategy?.board || s.board || "all";
    return isAutoCategory(board);
  });
}
