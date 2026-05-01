"use client";

// 副屏模式 · 主屏看比赛 · 副屏 = 一半资讯 + 一半下注
// 紧凑窄屏布局 · 适合 macOS Split View 或独立小窗口

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LiveMatchCard } from "./live-match";

type Position = {
  ticker: string;
  side: "yes" | "no";
  qty: number;
  exposure: number;
  avg_cents: number;
  realized_pnl: number;
  fees: number;
  title?: string;
  yes_sub?: string;
  no_sub?: string;
  current_yes_bid?: number;
  current_no_bid?: number;
  mark_value?: number;
  unrealized_pnl?: number;
  unrealized_pct?: number;
};

import type { EdgeRow as SharedEdgeRow } from "@/lib/xiapan/types";
// Sprint 4
type EdgeRow = Pick<
  SharedEdgeRow,
  | "ts"
  | "marketTicker"
  | "team1"
  | "team2"
  | "yesSubTitle"
  | "noSubTitle"
  | "modelPYes"
  | "myEdgePp"
  | "direction"
  | "buySide"
  | "buyPriceC"
  | "vol24"
  | "level"
  | "kellySuggestStake"
>;

type Account = {
  balance: number;
  totalExposure: number;
  totalUnrealized?: number;
  positions: Position[];
};

const SIDEBAR_GUIDE: { phase: string; tip: string }[] = [
  { phase: "0-15min", tip: "ban/pick · 看阵容 · 反 carry 出错就反向单" },
  { phase: "15-25min", tip: "小龙节奏 · 一方控双龙 · 加仓他赢" },
  { phase: "25-30min", tip: "大龙窗口 · 拿大龙 = 80% 胜率 · 趁还没飙价进" },
  { phase: "30min+", tip: "看高地 · 一波打完快锁利 · 别等结算" },
  { phase: "暂停/换人", tip: "立刻平仓 · 信息不对称 · 别赌" },
];

export function SidebarMode({
  account,
  edges,
  onBet,
  onSell,
  onExit,
}: {
  account: Account | null;
  edges: EdgeRow[];
  onBet: (r: EdgeRow, count: number) => void;
  onSell: (p: Position) => void;
  onExit: () => void;
}) {
  const [tab, setTab] = useState<"info" | "bet">("bet");
  const strong = edges.filter((e) => e.level === "strong");
  const watch = edges.filter((e) => e.level === "watch");
  const upnl = account?.totalUnrealized ?? 0;
  const netWorth = account ? account.balance + account.totalExposure : 0;

  return (
    <div className="min-h-screen bg-paper text-ink font-cjk">
      {/* Top bar 紧凑 */}
      <div className="px-3 py-2 border-b border-ink/10 flex items-center justify-between bg-paper-bright">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold tracking-tight">DU4</span>
          <span className="text-[10px] font-mono text-ink-dim">副屏 · 主屏看比赛</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span>净 ${netWorth.toFixed(2)}</span>
          <span className={upnl >= 0 ? "text-sage" : "text-red"}>
            {upnl >= 0 ? "+" : ""}${upnl.toFixed(2)}
          </span>
          <button
            onClick={onExit}
            className="ml-2 px-2 py-0.5 border border-ink/20 rounded hover:bg-paper-deep"
          >
            退
          </button>
        </div>
      </div>

      {/* 上半 · 实时资讯 (live 比赛 + 持仓 + 阶段指南) */}
      <div className="border-b-2 border-ink/15 bg-paper-bright">
        <div className="px-3 py-2">
          <LiveMatchCard compact />
        </div>
        <div className="px-3 py-2 flex items-baseline justify-between border-t border-ink/5">
          <span className="text-xs font-bold">你正在压的</span>
          <span className="text-[10px] text-ink-dim">30s 自动刷</span>
        </div>

        {/* 持仓 + 浮动 */}
        <div className="px-3 pb-2 space-y-1.5">
          {(account?.positions || []).slice(0, 5).map((p) => {
            const sellPriceC =
              p.side === "yes" ? p.current_yes_bid : p.current_no_bid;
            const upnlP = p.unrealized_pnl ?? 0;
            return (
              <div
                key={p.ticker}
                className="bg-paper rounded p-2 border border-ink/5"
              >
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold truncate flex-1" title={p.title}>
                    {(p.title || p.ticker).slice(0, 38)}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${upnlP >= 0 ? "text-sage" : "text-red"}`}
                  >
                    {upnlP >= 0 ? "+" : ""}${upnlP.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-ink-dim mt-0.5">
                  <span>
                    {p.side.toUpperCase()} {p.qty.toFixed(0)} @ {p.avg_cents}¢
                    · 现 {sellPriceC ?? "?"}¢
                  </span>
                  <button
                    onClick={() => onSell(p)}
                    className="text-ink hover:underline"
                  >
                    卖锁 ${(p.mark_value || 0).toFixed(2)}
                  </button>
                </div>
              </div>
            );
          })}
          {(account?.positions || []).length === 0 && (
            <div className="text-[11px] text-ink-dim">还没下单</div>
          )}
        </div>

        {/* 小白阶段指南 (LOL) */}
        <div className="px-3 pb-3">
          <div className="text-[10px] font-bold text-ink-dim mb-1">
            🎮 LOL 看比赛要看什么 · 阶段速查
          </div>
          <div className="bg-paper rounded p-2 space-y-1">
            {SIDEBAR_GUIDE.map((g, i) => (
              <div key={i} className="flex gap-2 text-[10px]">
                <span className="font-mono text-ink-dim w-14 shrink-0">
                  {g.phase}
                </span>
                <span className="text-ink-soft">{g.tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 下半 · 下注 (▲ 锐 列表) */}
      <div className="bg-paper">
        <div className="px-3 py-2 border-b border-ink/5 flex items-baseline justify-between">
          <span className="text-xs font-bold">★ 现在能下</span>
          <span className="text-[10px] text-ink-dim">{strong.length + watch.length} 单</span>
        </div>
        <div className="px-3 py-2 space-y-2 max-h-[60vh] overflow-y-auto">
          <AnimatePresence>
            {[...strong, ...watch].map((r) => (
              <SidebarEdgeCard
                key={r.marketTicker}
                row={r}
                onBet={(c) => onBet(r, c)}
              />
            ))}
          </AnimatePresence>
          {strong.length === 0 && watch.length === 0 && (
            <div className="text-[11px] text-ink-dim text-center py-4">
              这会儿没便宜单 · 看比赛就好
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarEdgeCard({
  row: r,
  onBet,
}: {
  row: EdgeRow;
  onBet: (count: number) => void;
}) {
  const [count, setCount] = useState(() => {
    const k = r.kellySuggestStake;
    const p = r.buyPriceC;
    if (!k || !p) return 1;
    return Math.max(1, Math.round((k * 100) / p));
  });
  const isReverse = r.direction === "no";
  const cost = ((r.buyPriceC || 0) * count) / 100;
  const date = new Date(r.ts);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date)
  )}`;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="bg-paper-bright rounded p-2 border border-ink/10"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">
          {r.team1} <span className="text-ink-dim">vs</span> {r.team2}
        </span>
        <span
          className={`text-xs font-mono tabular-nums ${(r.myEdgePp || 0) >= 5 ? "text-red" : "text-amber"}`}
        >
          {r.myEdgePp?.toFixed(1)}pp
        </span>
      </div>
      <div className="text-[10px] text-ink-dim mt-0.5">
        {dateStr} CT · {isReverse ? "反着买 " : "押 "}
        <b>{r.buySide}</b> 赢 @ {r.buyPriceC}¢
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
          className="w-12 px-1.5 py-0.5 bg-paper border border-ink/20 rounded text-xs font-mono"
        />
        <span className="text-[10px] text-ink-dim flex-1">
          ${cost.toFixed(2)}
        </span>
        <button
          onClick={() => onBet(count)}
          className={`px-2.5 py-0.5 rounded text-xs font-bold ${isReverse ? "bg-amber/30" : "bg-red text-paper"}`}
        >
          {isReverse ? "反" : "押"}
        </button>
      </div>
    </motion.div>
  );
}
