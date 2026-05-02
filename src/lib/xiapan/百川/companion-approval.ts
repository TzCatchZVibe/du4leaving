// 百川/companion-approval.ts · 4 同伴 BG3-style approval
// V0.72 W3 Day 10 · TZ 单玩家 · 后续 SaaS 可升级

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readAllLessons } from "./lessons";
import { readPools } from "./pools";

const HOME = os.homedir();
const FILE = path.join(HOME, ".du4leaving", "百川", "companion-approval.json");

export interface CompanionScore {
  name: string;
  emoji: string;
  archetype: string;            // INT/STR/DEX/WIS
  approval: number;             // -100 到 +100
  current_mood: "thrilled" | "happy" | "neutral" | "concerned" | "angry";
  last_quote: string;
  blind_spot: string | null;    // 这个 agent 最近发现你的盲点
}

const COMPANIONS = [
  { code: "max", name: "Max", emoji: "▲", archetype: "STR · 风险偏好" },
  { code: "rio", name: "Rio", emoji: "●", archetype: "DEX · 速度执行" },
  { code: "iris", name: "Iris", emoji: "◆", archetype: "INT · 数据复盘" },
  { code: "theo", name: "Theo", emoji: "◇", archetype: "WIS · 风控纪律" },
];

function ensureDir() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadState(): Record<string, number> {
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(s: Record<string, number>): void {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2), "utf8");
}

function moodFromApproval(n: number): CompanionScore["current_mood"] {
  if (n >= 60) return "thrilled";
  if (n >= 20) return "happy";
  if (n >= -20) return "neutral";
  if (n >= -60) return "concerned";
  return "angry";
}

/// 实时计算 4 agent 的 approval (基于近 30 天 lessons + 当前 pools)
export function computeApproval(): CompanionScore[] {
  const lessons = readAllLessons();
  const closed = lessons.filter((l) => l.actual === 0 || l.actual === 1);
  const pools = readPools();

  // Max (STR · 风险偏好) ·
  //   赞 · paper 数 / 多源 confirm 多
  //   贬 · 单笔超 1.4% / 集中下注
  let max_score = 0;
  const recent = closed.slice(-30);
  if (recent.length > 0) {
    const wr = recent.filter((l) => l.actual === 1).length / recent.length;
    max_score += (wr - 0.5) * 200;     // wr 60% → +20 · wr 40% → -20
  }
  if (pools && pools.S.balance < pools.P0 * 0.95) max_score -= 10;   // 赔了不开心

  // Rio (DEX · 速度) ·
  //   赞 · 信号触发后立刻下 (现在 cron 5min · 一直够速)
  //   贬 · 长期没下 (上游挂)
  let rio_score = 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = lessons.filter((l) => l.ts.startsWith(today)).length;
  if (todayCount >= 5) rio_score += 30;
  else if (todayCount === 0) rio_score -= 30;
  else rio_score += 5;

  // Iris (INT · 数据) ·
  //   赞 · CLV > 0 · n_active 高
  //   贬 · 信号源退役多 / 模型未训
  let iris_score = 0;
  if (closed.length >= 30) {
    const avg_n_active = closed.reduce((s, l) => s + l.n_active, 0) / closed.length;
    iris_score += (avg_n_active - 2) * 15;   // n=3 → +15 · n=2 → 0 · n=1 → -15
  }

  // Theo (WIS · 风控) ·
  //   赞 · drawdown 低 · 单笔上限遵守
  //   贬 · circuit_state 不是 running · 大 drawdown
  let theo_score = 0;
  if (pools) {
    if (pools.circuit_state === "running") theo_score += 20;
    else if (pools.circuit_state === "paused_C") theo_score -= 15;
    else theo_score -= 50;
    const dd = pools.S.peak > 0 ? (pools.S.peak - pools.S.balance) / pools.S.peak : 0;
    theo_score -= Math.round(dd * 200);     // dd 5% → -10
  }

  // 持久化 + 平滑
  const old = loadState();
  const newState: Record<string, number> = {};
  const out: CompanionScore[] = [];
  for (const c of COMPANIONS) {
    const cur = c.code === "max" ? max_score : c.code === "rio" ? rio_score : c.code === "iris" ? iris_score : theo_score;
    const blended = old[c.code] !== undefined ? Math.round(old[c.code] * 0.7 + cur * 0.3) : cur;
    const clamped = Math.max(-100, Math.min(100, blended));
    newState[c.code] = clamped;

    const mood = moodFromApproval(clamped);
    const quotes = quotesByMoodArchetype(c.code, mood);
    const idx = Math.floor(Math.random() * quotes.length);
    out.push({
      name: c.name,
      emoji: c.emoji,
      archetype: c.archetype,
      approval: clamped,
      current_mood: mood,
      last_quote: quotes[idx],
      blind_spot: blindSpot(c.code, lessons),
    });
  }
  saveState(newState);
  return out;
}

function quotesByMoodArchetype(code: string, mood: string): string[] {
  const map: Record<string, Record<string, string[]>> = {
    max: {
      thrilled: ["数据真香 · 你这单又精准", "wr 真上 60% · 我开始信你了"],
      happy: ["稳着跑 · 别浪", "今天还行 · 继续"],
      neutral: ["数据还少 · 看几周再说", "中规中矩"],
      concerned: ["你最近选的票边缘小 · 注意点", "wr 在掉 · 调阈值?"],
      angry: ["你又超仓了 · 我不喜欢", "再这样玩 · 我罢工"],
    },
    rio: {
      thrilled: ["今天信号一波接一波 · 我跑爽了", "5 min 一扫 · 我喜欢"],
      happy: ["速度过关", "节奏稳"],
      neutral: ["一般 · 信号源不算热", "再等等"],
      concerned: ["上游 API 慢 · 我们错了几个机会", "今天信号偏少"],
      angry: ["8 小时没新单 · 系统挂了?", "速度死了 · 检查 cron"],
    },
    iris: {
      thrilled: ["CLV 漂亮 · 你方向真对", "数据开始有信号 · 持续看"],
      happy: ["稳", "数据慢慢来 · 别急"],
      neutral: ["数据不够 · 还看不出", "还要 4 周"],
      concerned: ["某些信号源 Brier 在升 · 注意", "n_active 偏低 · 信号源不够"],
      angry: ["这套规则不行 · 7 天 wr 不到 50%", "复盘吧"],
    },
    theo: {
      thrilled: ["drawdown 控制完美 · 你纪律满分", "风险全在阈值内 · 漂亮"],
      happy: ["风控运转良好", "稳着跑"],
      neutral: ["还行 · 没破任何线", "在阈值内"],
      concerned: ["S 池在跌 · 不到熔断 但注意", "circuit paused_C · 检 drawdown"],
      angry: ["熔断了 · 立刻停下来", "系统失控 · 你必须复盘"],
    },
  };
  return map[code]?.[mood] ?? ["..."];
}

function blindSpot(code: string, lessons: ReturnType<typeof readAllLessons>): string | null {
  const closed = lessons.filter((l) => l.actual === 0 || l.actual === 1);
  if (closed.length < 30) return null;        // 数据不够 · 不报盲点

  if (code === "max") {
    // 看是否过度集中某板块
    const boards = new Map<string, number>();
    for (const l of closed) {
      const b = l.ticker.slice(0, 5);
      boards.set(b, (boards.get(b) ?? 0) + 1);
    }
    const sorted = [...boards.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > closed.length * 0.6) {
      return `60%+ 仓位集中在 ${sorted[0][0]} · 多源失衡`;
    }
  }
  if (code === "iris") {
    const n_active_low = closed.filter((l) => l.n_active < 2).length;
    if (n_active_low / closed.length > 0.3) {
      return `30%+ 单只 1 信号源 · 缺乏多源 confirm`;
    }
  }
  return null;
}
