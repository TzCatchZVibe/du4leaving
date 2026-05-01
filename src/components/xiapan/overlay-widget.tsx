"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

type Account = {
  ok: boolean;
  balance: number;
  totalExposure: number;
  totalPnl: number;
  positions: Array<{
    ticker: string;
    side: "yes" | "no";
    qty: number;
    exposure: number;
    avg_cents: number;
    realized_pnl: number;
    fees: number;
  }>;
  fills: Array<{
    ticker: string;
    side: string;
    action: string;
    count: number;
    price_cents: number;
    fee: number;
    ts: string;
  }>;
};

import type { EdgeRow as SharedEdgeRow } from "@/lib/xiapan/types";
// Sprint 4
type EdgeRow = Pick<
  SharedEdgeRow,
  | "team1"
  | "team2"
  | "myEdgePp"
  | "direction"
  | "buySide"
  | "buyPriceC"
  | "level"
  | "ts"
  | "marketTicker"
>;

export function OverlayWidget() {
  const [account, setAccount] = useState<Account | null>(null);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [a, e] = await Promise.all([
        fetch("/api/xiapan/account").then((r) => r.json()),
        fetch("/api/xiapan/live-edge?hours=8").then((r) => r.json()),
      ]);
      if (a.ok) setAccount(a);
      if (e.ok) setEdges(e.rows || []);
      setTick((t) => t + 1);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const strong = edges.filter((e) => e.level === "strong").slice(0, 2);
  const netWorth = account ? account.balance + account.totalExposure : 0;

  return (
    <div className="min-h-screen bg-ink/95 text-paper p-3 font-cjk overflow-hidden">
      {/* Header · drag handle 风 */}
      <div className="flex items-center justify-between mb-2 select-none">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">DU4</span>
          <span className="text-xs font-mono uppercase tracking-widest text-paper/60">
            浮窗
          </span>
        </div>
        <span className="text-[9px] font-mono text-paper/40">
          {tick > 0 ? "● live" : "…"}
        </span>
      </div>

      {/* 余额条 */}
      <motion.div
        key={netWorth}
        initial={{ opacity: 0.6, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="grid grid-cols-2 gap-1.5 mb-2"
      >
        <Stat label="净值" value={`$${netWorth.toFixed(2)}`} />
        <Stat
          label="持仓"
          value={`$${(account?.totalExposure ?? 0).toFixed(2)}`}
          dim
        />
        <Stat
          label="今日盈亏"
          value={`${(account?.totalPnl ?? 0) >= 0 ? "+" : ""}$${(account?.totalPnl ?? 0).toFixed(2)}`}
          color={(account?.totalPnl ?? 0) >= 0 ? "sage" : "red"}
        />
        <Stat
          label="现金"
          value={`$${(account?.balance ?? 0).toFixed(2)}`}
          dim
        />
      </motion.div>

      {/* STRONG edge */}
      <div className="text-[10px] font-mono uppercase tracking-widest text-paper/50 mt-2 mb-1">
        ▲ 锐 ({strong.length})
      </div>
      <AnimatePresence mode="popLayout">
        {strong.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[11px] text-paper/50 bg-paper/5 rounded p-2"
          >
            当前无 STRONG 信号 · 30s 后再扫
          </motion.div>
        ) : (
          strong.map((r) => (
            <motion.div
              key={r.marketTicker}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-paper/8 rounded p-2 mb-1.5 hover:bg-paper/15 transition"
            >
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-sm">
                  {r.team1} <span className="text-paper/40">vs</span> {r.team2}
                </span>
                <span
                  className={`font-mono font-bold tabular-nums ${(r.myEdgePp || 0) >= 5 ? "text-red" : "text-amber"}`}
                >
                  {r.myEdgePp?.toFixed(1)}pp
                </span>
              </div>
              <div className="text-[10px] text-paper/60 mt-0.5">
                {r.direction === "no" ? "◇ 反 " : "▲ "}
                买 {r.direction?.toUpperCase()} ({r.buySide}) @ {r.buyPriceC}¢
              </div>
              <div className="text-[10px] text-paper/40 mt-0.5">
                ↗ 切桌面 dashboard 一键下
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>

      {/* 持仓简版 */}
      {account && account.positions.length > 0 && (
        <>
          <div className="text-[10px] font-mono uppercase tracking-widest text-paper/50 mt-3 mb-1">
            ▣ 在仓 ({account.positions.length})
          </div>
          <ul className="space-y-1 text-[11px] font-mono">
            {account.positions.slice(0, 5).map((p) => (
              <motion.li
                key={p.ticker}
                layout
                className="flex justify-between bg-paper/5 rounded px-2 py-1"
              >
                <span className="truncate flex-1" title={p.ticker}>
                  {p.ticker.split("-")[0].slice(0, 12)}
                </span>
                <span className="text-paper/60 tabular-nums">
                  ${p.exposure.toFixed(2)}
                </span>
              </motion.li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-3 pt-2 border-t border-paper/10 text-[10px] text-paper/40 text-center">
        每 30s 自动刷 · 拖角落看比赛
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  dim,
}: {
  label: string;
  value: string;
  color?: "sage" | "red";
  dim?: boolean;
}) {
  const valColor = color === "sage" ? "text-sage" : color === "red" ? "text-red" : dim ? "text-paper/70" : "text-paper";
  return (
    <div className="bg-paper/5 rounded px-2 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-widest text-paper/40">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${valColor}`}>{value}</div>
    </div>
  );
}
