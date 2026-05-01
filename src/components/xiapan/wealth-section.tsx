"use client";

// 【钱】 顶部第一眼看到 · 财报 + PnL 曲线 + 月进度

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  dailyReturns,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
  maxDrawdown,
} from "@/lib/xiapan/economics";

type Props = {
  netWorth: number;
  cash: number;
  exposure: number;
  unrealized: number;
  todayPnl: number;
  startBalance: number;
  monthTarget?: number;
  monthWindow?: string; // 例 "4.29-5.29" · 由 dashboard 传入 · 默认硬编码兜底
};

const PNL_KEY = "xiapan:pnl-history";
type Snap = { date: string; netWorth: number };

function loadSnap(): Snap[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(PNL_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveSnap(arr: Snap[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PNL_KEY, JSON.stringify(arr));
}

export function WealthSection({
  netWorth,
  cash,
  exposure,
  unrealized,
  todayPnl,
  startBalance,
  monthTarget = 400,
  monthWindow = "4.28-5.28",
}: Props) {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [range, setRange] = useState<7 | 30>(7);
  const [mounted, setMounted] = useState(false);

  // 每日一次落 snap
  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().slice(0, 10);
    const arr = loadSnap();
    const last = arr[arr.length - 1];
    if (!last || last.date !== today) {
      arr.push({ date: today, netWorth });
      saveSnap(arr.slice(-90));
    } else {
      arr[arr.length - 1] = { date: today, netWorth };
      saveSnap(arr);
    }
    setSnaps(arr.slice(-range));
  }, [netWorth, range]);

  const recent = snaps.slice(-range);
  const minV = recent.length ? Math.min(...recent.map((s) => s.netWorth), netWorth) : netWorth;
  const maxV = recent.length ? Math.max(...recent.map((s) => s.netWorth), netWorth) : netWorth;
  const span = Math.max(1, maxV - minV);
  const monthPct = startBalance > 0
    ? Math.max(0, Math.min(1, (netWorth - startBalance) / monthTarget))
    : 0;

  // 警告 · 浮动 ≥ 30% bankroll
  const drawdown = unrealized < 0 && Math.abs(unrealized) / Math.max(netWorth, 1) > 0.3;

  return (
    <motion.section
      layout
      className={`bg-paper-bright border rounded-lg overflow-hidden ${
        drawdown ? "border-red shadow-md" : "border-ink/10"
      }`}
    >
      {/* 三大主卡 */}
      <div className="grid grid-cols-3 divide-x divide-ink/10">
        <div className="px-5 py-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
            净值
          </div>
          <div className="text-3xl lg:text-4xl font-bold mt-1 tabular-nums">
            ${netWorth.toFixed(2)}
          </div>
          <div className="text-[10px] text-ink-dim mt-0.5">
            起 ${startBalance.toFixed(0)}{" "}
            <span className={netWorth >= startBalance ? "text-sage" : "text-red"}>
              ({netWorth >= startBalance ? "+" : ""}
              {((netWorth - startBalance) / Math.max(startBalance, 1) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
            今日盈亏
          </div>
          <div
            className={`text-3xl lg:text-4xl font-bold mt-1 tabular-nums ${todayPnl >= 0 ? "text-sage" : "text-red"}`}
          >
            {todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(2)}
          </div>
          <div className="text-[10px] text-ink-dim mt-0.5">含浮动 + 已结算</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
            正在比赛中
          </div>
          <div
            className={`text-3xl lg:text-4xl font-bold mt-1 tabular-nums ${unrealized >= 0 ? "text-sage" : "text-red"}`}
          >
            {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}
          </div>
          <div className="text-[10px] text-ink-dim mt-0.5">
            如果现在卖能拿 · 现金 ${cash.toFixed(2)} · 仓位 ${exposure.toFixed(2)}
          </div>
        </div>
      </div>

      {/* PnL 曲线 + 月进度 */}
      <div className="border-t border-ink/10 px-5 py-3 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-center">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] text-ink-dim font-mono">
              净值曲线 · {range} 天
            </span>
            <div className="flex gap-1">
              {[7, 30].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r as 7 | 30)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${range === r ? "bg-ink text-paper" : "bg-paper-deep/30 hover:bg-paper-deep"}`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
          {mounted && recent.length > 1 ? (
            <svg viewBox={`0 0 ${recent.length * 4} 30`} preserveAspectRatio="none" className="w-full h-12">
              <polyline
                fill="none"
                stroke="#6a8a6e"
                strokeWidth="0.8"
                points={recent
                  .map((s, i) => `${i * 4},${30 - ((s.netWorth - minV) / span) * 28}`)
                  .join(" ")}
              />
              {/* 起始基准线 */}
              {startBalance > 0 && (
                <line
                  x1="0"
                  x2={recent.length * 4}
                  y1={30 - ((startBalance - minV) / span) * 28}
                  y2={30 - ((startBalance - minV) / span) * 28}
                  stroke="#c1272d"
                  strokeDasharray="2,2"
                  strokeWidth="0.4"
                />
              )}
            </svg>
          ) : (
            <div className="text-[11px] text-ink-dim font-mono">
              {mounted ? "数据少 · 多记几天才有曲线" : "加载中…"}
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] text-ink-dim font-mono mb-1.5">
            月度目标 · {monthWindow} · ${monthTarget}
          </div>
          <div className="h-2 bg-paper-deep/40 rounded overflow-hidden mb-1">
            <div
              className={`h-full ${monthPct > 0 ? "bg-sage" : "bg-red/40"}`}
              style={{ width: `${Math.max(2, monthPct * 100)}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between text-[11px] tabular-nums">
            <span className={netWorth - startBalance >= 0 ? "text-sage font-bold" : "text-red font-bold"}>
              {netWorth - startBalance >= 0 ? "+" : ""}${(netWorth - startBalance).toFixed(2)}
            </span>
            <span className="text-ink-dim">
              / ${monthTarget} · {(monthPct * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {drawdown && (
        <div className="border-t border-red px-5 py-2 bg-red/5">
          <div className="text-xs font-bold text-red-deep">
            △ 警告 · 浮动亏损已超净值 30% · 建议立刻平仓 · 或暂停下单 24h
          </div>
        </div>
      )}

      {/* 对冲基金指标 · Sharpe / Sortino / Calmar / MaxDD */}
      {snaps.length >= 5 && (
        <HedgeFundMetrics snaps={snaps} />
      )}
    </motion.section>
  );
}

function HedgeFundMetrics({ snaps }: { snaps: Snap[] }) {
  const daily = dailyReturns(snaps);
  const sharpe = sharpeRatio(daily);
  const sortino = sortinoRatio(daily);
  const calmar = calmarRatio(daily, snaps);
  const mdd = maxDrawdown(snaps);
  const tier = (s: number, good: number, ok: number) =>
    s >= good ? "text-sage" : s >= ok ? "text-amber" : "text-red";
  return (
    <div className="border-t border-ink/10 px-5 py-2.5 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
      <div title="Sharpe Ratio · 风险调整后回报 · 越高越好">
        <span className="text-ink-dim">Sharpe</span>{" "}
        <span className={`font-bold tabular-nums ${tier(sharpe, 1, 0)}`}>
          {sharpe.toFixed(2)}
        </span>
        <span className="text-[10px] text-ink-dim ml-1">
          {sharpe >= 1 ? "好" : sharpe >= 0 ? "凑合" : "差"}
        </span>
      </div>
      <div title="Sortino · 只看下行波动的 Sharpe · 更适合赌博">
        <span className="text-ink-dim">Sortino</span>{" "}
        <span className={`font-bold tabular-nums ${tier(sortino, 1.5, 0.5)}`}>
          {sortino.toFixed(2)}
        </span>
      </div>
      <div title="Calmar · 年化回报 / 最大回撤 · 单一最实用指标">
        <span className="text-ink-dim">Calmar</span>{" "}
        <span className={`font-bold tabular-nums ${tier(calmar, 1, 0)}`}>
          {calmar.toFixed(2)}
        </span>
      </div>
      <div title="Max Drawdown · 历史最深回撤 %">
        <span className="text-ink-dim">MaxDD</span>{" "}
        <span className="font-bold tabular-nums text-red">
          -{(mdd.pct * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
