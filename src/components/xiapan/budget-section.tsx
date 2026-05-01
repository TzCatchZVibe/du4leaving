"use client";

// 【额度】 今天能再花多少 · 推荐下几单 · 平台抽水累计

import { motion } from "motion/react";
import {
  riskOfRuin,
  parametricVaR,
  concentrationCheck,
} from "@/lib/xiapan/economics";

type Fill = {
  ticker: string;
  side: string;
  count: number;
  price_cents: number;
  fee: number;
  ts: string;
};

type Position = { exposure: number; ticker: string };

type Props = {
  cash: number;
  todayDeposited: number;
  weekDeposited: number;
  monthDeposited: number;
  todayPnl: number;
  fills: Fill[];
  positions?: Position[];
  pnlHistory?: { netWorth: number }[];
  onCashout: () => void;
  onDeposit: () => void;
};

export function BudgetSection({
  cash,
  todayDeposited,
  weekDeposited,
  monthDeposited,
  todayPnl,
  fills,
  positions = [],
  pnlHistory = [],
  onCashout,
  onDeposit,
}: Props) {
  // 对冲基金指标
  const dailyR = (() => {
    if (pnlHistory.length < 2) return [];
    const r: number[] = [];
    for (let i = 1; i < pnlHistory.length; i++) {
      if (pnlHistory[i - 1].netWorth > 0)
        r.push(
          (pnlHistory[i].netWorth - pnlHistory[i - 1].netWorth) /
            pnlHistory[i - 1].netWorth
        );
    }
    return r;
  })();
  const var95 = parametricVaR(dailyR, 0.95, cash + positions.reduce((s, p) => s + p.exposure, 0));
  // 简化 RoR 假设近期 win rate
  const ror = riskOfRuin({
    winRate: 0.55,
    edgePerBet: 0.05,
    bankroll: cash + positions.reduce((s, p) => s + p.exposure, 0),
    stakePerBet: cash * 0.125,
  });
  const conc = concentrationCheck(positions);
  // 充值额度算法
  let allowed = 0;
  let reason = "";
  if (todayPnl <= -15) {
    allowed = 0;
    reason = "今日亏损 ≥ $15 · 24h 冷静期 · 不让你情绪追损";
  } else if (weekDeposited >= 100) {
    allowed = 0;
    reason = "本周已充满 $100 · 周封顶";
  } else if (monthDeposited >= 300) {
    allowed = 0;
    reason = "本月已充满 $300 · 月封顶";
  } else if (cash >= 30) {
    allowed = 0;
    reason = "余额 ≥ $30 · 不需补水";
  } else if (cash >= 15) {
    allowed = Math.min(10, 100 - weekDeposited);
    reason = "余额 $15-30 · 推荐 $10";
  } else {
    allowed = Math.min(20 - todayDeposited, 100 - weekDeposited);
    reason = `余额 < $15 · 可充至 $${Math.max(0, 20 - todayDeposited)}`;
  }

  // 今天能下几单 · Kelly 12.5% × cash
  const maxSingle = cash * 0.125;
  const recommendedBets = Math.max(0, Math.min(5, Math.floor(cash / Math.max(1, maxSingle))));

  // 平台抽水累计 (今天 / 月)
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const todayFee = fills
    .filter((f) => f.ts?.slice(0, 10) === todayKey)
    .reduce((s, f) => s + (f.fee || 0), 0);
  const monthFee = fills
    .filter((f) => f.ts?.slice(0, 7) === monthKey)
    .reduce((s, f) => s + (f.fee || 0), 0);

  return (
    <motion.section
      layout
      className="bg-paper-bright border border-ink/10 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-ink/10 flex items-baseline justify-between">
        <span className="text-sm font-bold">¥ 今天怎么花</span>
        <span className="text-[10px] text-ink-dim font-mono">
          预算 · 充值 · 提现
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-ink/10">
        {/* 现在能下 */}
        <div className="px-5 py-3.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
            现在能下
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            约 {recommendedBets} 单
          </div>
          <div className="text-[11px] text-ink-soft mt-0.5">
            单笔上限 ${maxSingle.toFixed(2)} · 12.5% × 现金
          </div>
          <div className="text-[10px] text-ink-dim mt-1.5 leading-relaxed">
            按你 Kelly 限制算 · 不超就稳
          </div>
        </div>

        {/* 充值额度 */}
        <div className="px-5 py-3.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
            还能充
          </div>
          <div
            className={`text-2xl font-bold mt-1 tabular-nums ${allowed === 0 ? "text-red" : "text-amber"}`}
          >
            ${allowed}
          </div>
          <div className="text-[11px] text-ink-soft mt-0.5">{reason}</div>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={onDeposit}
              disabled={allowed === 0}
              className="text-[10px] font-mono px-2 py-1 bg-amber/20 hover:bg-amber/40 rounded disabled:opacity-30"
            >
              去充值 ↗
            </button>
            <span className="text-[10px] text-ink-dim font-mono self-center">
              今 ${todayDeposited}/$20 · 周 ${weekDeposited}/$100 · 月 ${monthDeposited}/$300
            </span>
          </div>
        </div>

        {/* 提现建议 */}
        <div className="px-5 py-3.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
            什么时候提
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            {cash >= 300 ? "$100" : cash >= 150 ? "$50" : "—"}
          </div>
          <div className="text-[11px] text-ink-soft mt-0.5">
            {cash >= 300
              ? "余额 > $300 · 提 $100 锁利"
              : cash >= 150
                ? "余额 > $150 · 提 $50"
                : "继续工作 · 复利再投"}
          </div>
          <div className="mt-2">
            <button
              onClick={onCashout}
              disabled={cash < 100}
              className="text-[10px] font-mono px-2 py-1 bg-sage/20 hover:bg-sage/40 rounded disabled:opacity-30"
            >
              去提现 ↗
            </button>
          </div>
        </div>
      </div>

      {/* 对冲基金风险指标 */}
      <div className="border-t border-ink/10 px-5 py-2.5 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div title="VaR 95% · 95% 概率单日不会亏超过这个数">
          <span className="text-ink-dim">VaR 95%</span>{" "}
          <span className="font-bold tabular-nums text-amber">
            -${var95.toFixed(2)}
          </span>
        </div>
        <div title="Risk of Ruin · 按当前节奏多大概率破产">
          <span className="text-ink-dim">破产概率</span>{" "}
          <span
            className={`font-bold tabular-nums ${ror > 0.1 ? "text-red" : "text-sage"}`}
          >
            {(ror * 100).toFixed(1)}%
          </span>
        </div>
        <div title="集中度 · 单笔占总仓比例">
          <span className="text-ink-dim">集中度</span>{" "}
          <span
            className={`font-bold tabular-nums ${conc.topShare > 0.5 ? "text-red" : "text-sage"}`}
          >
            {(conc.topShare * 100).toFixed(0)}%
          </span>
        </div>
        <div title="单笔最大可压">
          <span className="text-ink-dim">单笔上限</span>{" "}
          <span className="font-bold tabular-nums">${(cash * 0.125).toFixed(2)}</span>
        </div>
      </div>
      {conc.warning && (
        <div className="px-5 py-1.5 bg-amber/10 text-[11px] text-ink-soft">
          △ {conc.warning}
        </div>
      )}

      {/* 平台抽水 (反 Kalshi) · V3 S8 · 加红色警告 + 真实 ROI 估 */}
      {(() => {
        // 抽水率分母用 cash + exposure (净值) · 不是 monthDeposited (无入金时为 0 误报)
        const denom = Math.max(cash + positions.reduce((s, p) => s + p.exposure, 0), 1);
        const feeRate = monthDeposited > 0 ? monthFee / monthDeposited : monthFee / denom;
        const monthNetPnl = todayPnl; // 简化 · 实战可改月度净盈亏
        const realRoi = monthDeposited > 0
          ? (monthNetPnl - monthFee) / monthDeposited
          : 0;
        const high = monthDeposited > 0 && feeRate > 0.05;
        const veryHigh = monthDeposited > 0 && feeRate > 0.1;
        return (
          <>
            <div
              className={`border-t px-5 py-2 flex items-baseline justify-between flex-wrap gap-2 ${
                veryHigh ? "border-red bg-red/10" : "border-ink/10"
              }`}
            >
              <span
                className={`text-[11px] ${veryHigh ? "text-red-deep font-bold" : "text-ink-dim"}`}
              >
                平台抽水 · 今日 ${todayFee.toFixed(2)} · 本月 ${monthFee.toFixed(2)}
              </span>
              <span
                className={`text-[10px] ${veryHigh ? "text-red font-bold" : high ? "text-amber font-bold" : "text-ink-dim"}`}
              >
                {monthFee > 0
                  ? monthDeposited > 0
                    ? `${(feeRate * 100).toFixed(1)}% 抽水率 · ${
                        veryHigh
                          ? "△ 警告 · > 10% · 你在给 Kalshi 打工"
                          : high
                            ? "高频成本 · 减少手数"
                            : "正常区间"
                      }`
                    : "等首次充值后算抽水率"
                  : "还没成交 · 没抽水"}
              </span>
            </div>
            {monthDeposited > 0 && (
              <div className="border-t border-ink/10 px-5 py-1.5 text-[10px] text-ink-dim font-mono flex items-baseline justify-between flex-wrap gap-2">
                <span>
                  本月真实 ROI · 净盈亏 ${monthNetPnl.toFixed(2)} − 抽水 ${monthFee.toFixed(2)} = ${(monthNetPnl - monthFee).toFixed(2)}
                </span>
                <span
                  className={
                    realRoi >= 0 ? "text-sage font-bold" : "text-red font-bold"
                  }
                >
                  {(realRoi * 100).toFixed(1)}% (扣抽水)
                </span>
              </div>
            )}
          </>
        );
      })()}
    </motion.section>
  );
}
