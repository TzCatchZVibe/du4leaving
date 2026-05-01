// paper-trade.ts · V0.67 [A] 模拟挂单引擎
//
// 全自动投注 3 阶段第 1 阶段 ·
// 老虎选 picks score ≥ 75 → 写到 paper-trades 表 (本地 JSON)
// 跑模拟止盈 / 止损 / 时限 / 设置 → 跟真 Kalshi 数据对账 → 算 PnL
// 跑 100 笔够稳 · 才考虑进 [B] 真单
//
// 风控 (硬写死) ·
//   单笔 ≤ 0.5% bankroll · 默认 $1/单 (虚拟)
//   总暴露 ≤ 5% bankroll · 默认 $20 (虚拟)
//   24h PnL ≤ -3% bankroll → 自动暂停 24h
//
// 文件存 ~/.du4leaving/paper-trades/<YYYY-MM-DD>.jsonl

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const TRADE_DIR = path.join(HOME, ".du4leaving", "paper-trades");

// 风控常量 (LLM 改不了)
export const PAPER_BANKROLL = 400;          // 默认 paper $400
export const PAPER_PER_TRADE = 2;           // $2 per trade max
export const PAPER_DAILY_LIMIT = 20;        // $20 daily exposure max
export const PAPER_MIN_SCORE = 75;          // picks score ≥ 75 才下
export const PAPER_PAUSE_PNL_PCT = -0.03;   // -3% bankroll → 暂停 24h

export interface PaperTrade {
  id: string;
  ticker: string;
  title: string;
  side: "yes" | "no";
  entry_price_c: number;        // 0-100 cents
  qty: number;                  // 张数
  cost_dollars: number;
  opened_at: string;            // ISO
  closed_at?: string;
  exit_price_c?: number;
  exit_reason?: "take_profit" | "stop_loss" | "time_exit" | "settled" | "manual";
  pnl_dollars?: number;
  pnl_pct?: number;
  source: "agent_laohu" | "manual" | "test";
  picks_score?: number;
  reasons?: string[];
}

function ensureDir() {
  if (!fs.existsSync(TRADE_DIR)) fs.mkdirSync(TRADE_DIR, { recursive: true });
}

function dailyFile(d: Date = new Date()): string {
  ensureDir();
  return path.join(TRADE_DIR, `${d.toISOString().slice(0, 10)}.jsonl`);
}

/// 写入新模拟单
export function recordTrade(trade: PaperTrade): void {
  ensureDir();
  fs.appendFileSync(dailyFile(), JSON.stringify(trade) + "\n", "utf8");
}

/// 读所有 (按日期范围 · default 最近 7 天)
export function readAllTrades(days = 7): PaperTrade[] {
  ensureDir();
  const out: PaperTrade[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const f = dailyFile(d);
    if (!fs.existsSync(f)) continue;
    try {
      const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
      for (const ln of lines) {
        try { out.push(JSON.parse(ln) as PaperTrade); } catch {}
      }
    } catch {}
  }
  return out.sort((a, b) => b.opened_at.localeCompare(a.opened_at));
}

/// 读今日总暴露 (用于风控)
export function todayExposureDollars(): number {
  const f = dailyFile();
  if (!fs.existsSync(f)) return 0;
  try {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
    let total = 0;
    for (const ln of lines) {
      try {
        const t = JSON.parse(ln) as PaperTrade;
        if (!t.closed_at) total += t.cost_dollars;
      } catch {}
    }
    return total;
  } catch { return 0; }
}

/// 读今日已平 PnL
export function todayPnlDollars(): number {
  const f = dailyFile();
  if (!fs.existsSync(f)) return 0;
  try {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
    let total = 0;
    for (const ln of lines) {
      try {
        const t = JSON.parse(ln) as PaperTrade;
        if (t.pnl_dollars !== undefined) total += t.pnl_dollars;
      } catch {}
    }
    return total;
  } catch { return 0; }
}

/// 风控检查 · 能否下新单
export interface RiskGate {
  allowed: boolean;
  reason?: string;
}

/// V0.70 · 同 ticker + 同 side · 1 小时内有 open 单 · 不再重复下
export function hasOpenDuplicate(ticker: string, side: string): boolean {
  const trades = readAllTrades(2);
  const now = Date.now();
  return trades.some((t) =>
    !t.closed_at
    && t.ticker === ticker
    && t.side === side
    && (now - new Date(t.opened_at).getTime()) < 3600_000
  );
}

export function canPlaceTrade(costDollars: number, ticker?: string, side?: string): RiskGate {
  if (ticker && side && hasOpenDuplicate(ticker, side)) {
    return { allowed: false, reason: `同 ticker+side 1h 内已有 open 单 · 去重` };
  }
  if (costDollars > PAPER_PER_TRADE) {
    return { allowed: false, reason: `单笔 $${costDollars.toFixed(2)} > 上限 $${PAPER_PER_TRADE}` };
  }
  const exposure = todayExposureDollars();
  if (exposure + costDollars > PAPER_DAILY_LIMIT) {
    return { allowed: false, reason: `今日总暴露 $${exposure.toFixed(2)} + $${costDollars} > 限 $${PAPER_DAILY_LIMIT}` };
  }
  const pnl = todayPnlDollars();
  if (pnl <= PAPER_BANKROLL * PAPER_PAUSE_PNL_PCT) {
    return { allowed: false, reason: `今日已亏 $${pnl.toFixed(2)} ≥ ${PAPER_PAUSE_PNL_PCT * 100}% bankroll · 24h 自动暂停` };
  }
  return { allowed: true };
}

/// 拉一个 Kalshi market 当前价 (用来 mark-to-market)
export async function fetchMarketPrice(ticker: string): Promise<{ yes_bid: number; yes_ask: number; status?: string } | null> {
  try {
    const r = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const m = d.market;
    if (!m) return null;
    return {
      yes_bid: m.yes_bid ?? 0,
      yes_ask: m.yes_ask ?? 0,
      status: m.status,
    };
  } catch {
    return null;
  }
}

/// V0.71 · 平仓后顺手推 Telegram (动态 import 避免循环依赖)
async function notifyTelegramClose(t: PaperTrade) {
  try {
    const tg = await import("./telegram");
    if (!tg.tgEnabled()) return;
    const pnl = t.pnl_dollars ?? 0;
    const icon = pnl >= 0 ? "✓" : "△";
    const reasonLabel: Record<string, string> = {
      take_profit: "止盈",
      stop_loss: "止损",
      time_exit: "时限",
      settled: "结算",
    };
    const r = reasonLabel[t.exit_reason ?? ""] ?? t.exit_reason ?? "";
    await tg.sendTelegramAlertDedupe(
      `paper-close-${t.id}`,
      `${icon} 模拟单 ${r} · ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
      `${t.title.slice(0, 80)}\n${t.side.toUpperCase()} ×${t.qty} @ ${t.entry_price_c}¢ → ${t.exit_price_c}¢`
    );
  } catch {
    // 静默
  }
}

/// 跑一遍 mark-to-market · 自动平止盈/止损/时限
/// 返回新关闭的单
export async function tickAllOpenTrades(): Promise<PaperTrade[]> {
  const all = readAllTrades(14);
  const open = all.filter((t) => !t.closed_at);
  const closed: PaperTrade[] = [];

  for (const t of open) {
    const px = await fetchMarketPrice(t.ticker);
    if (!px) continue;

    // 卖出价 (yes 仓 → yes_bid · no 仓 → 100 - yes_ask)
    const exit_c = t.side === "yes" ? px.yes_bid : (100 - px.yes_ask);
    if (exit_c <= 0) continue;

    const mark_value = (exit_c * t.qty) / 100;
    const pnl = mark_value - t.cost_dollars;
    const pnl_pct = t.cost_dollars > 0 ? pnl / t.cost_dollars : 0;

    let reason: PaperTrade["exit_reason"] | undefined;

    // 止盈 +20%
    if (pnl_pct >= 0.20) reason = "take_profit";
    // 止损 -15%
    else if (pnl_pct <= -0.15) reason = "stop_loss";
    // 状态结算
    else if (px.status === "closed" || px.status === "settled" || px.status === "finalized") reason = "settled";
    // 时限 (持仓 ≥ 4h 未触止盈/止损 · 强平)
    else {
      const ageH = (Date.now() - new Date(t.opened_at).getTime()) / 3600_000;
      if (ageH >= 4) reason = "time_exit";
    }

    if (!reason) continue;

    const updated: PaperTrade = {
      ...t,
      closed_at: new Date().toISOString(),
      exit_price_c: exit_c,
      exit_reason: reason,
      pnl_dollars: Number(pnl.toFixed(2)),
      pnl_pct: Number(pnl_pct.toFixed(3)),
    };

    // 重写 jsonl (替换原行)
    rewriteUpdated(t, updated);
    closed.push(updated);

    // V0.71 · 推 Telegram (异步 · 不阻塞)
    notifyTelegramClose(updated).catch(() => {});
  }

  return closed;
}

function rewriteUpdated(orig: PaperTrade, updated: PaperTrade) {
  const f = dailyFile(new Date(orig.opened_at));
  if (!fs.existsSync(f)) return;
  try {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
    const newLines = lines.map((ln) => {
      try {
        const t = JSON.parse(ln) as PaperTrade;
        if (t.id === orig.id) return JSON.stringify(updated);
        return ln;
      } catch { return ln; }
    });
    fs.writeFileSync(f, newLines.join("\n") + "\n", "utf8");
  } catch {}
}

/// 综合统计
export function summary(days = 7): {
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  total_pnl: number;
  win_rate: number;
  avg_pnl: number;
} {
  const all = readAllTrades(days);
  const closed = all.filter((t) => t.closed_at);
  const wins = closed.filter((t) => (t.pnl_dollars ?? 0) > 0).length;
  const losses = closed.filter((t) => (t.pnl_dollars ?? 0) < 0).length;
  const total_pnl = closed.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0);
  return {
    total: all.length,
    open: all.filter((t) => !t.closed_at).length,
    closed: closed.length,
    wins,
    losses,
    total_pnl: Number(total_pnl.toFixed(2)),
    win_rate: closed.length > 0 ? wins / closed.length : 0,
    avg_pnl: closed.length > 0 ? Number((total_pnl / closed.length).toFixed(2)) : 0,
  };
}
