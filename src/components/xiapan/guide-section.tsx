"use client";

// 【问】 5 种引导提问轮播 · 决策 / 复盘 / 学习 / 探索 / 实时

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import type { EdgeRow as SharedEdgeRow } from "@/lib/xiapan/types";
// Sprint 4
type EdgeRow = Pick<
  SharedEdgeRow,
  | "marketTicker"
  | "team1"
  | "team2"
  | "myEdgePp"
  | "direction"
  | "buySide"
  | "buyPriceC"
  | "level"
  | "kellySuggestStake"
  | "ts"
>;

type Position = {
  ticker: string;
  title?: string;
  qty: number;
  side: "yes" | "no";
  unrealized_pnl?: number;
  starts_at?: string;
};

type Fill = {
  ticker: string;
  side: string;
  count: number;
  price_cents: number;
  ts: string;
  action?: string;
};

type Story = {
  sport: string;
  team1: string;
  team2: string;
  story?: string;
  phase?: string;
};

type Props = {
  cash: number;
  todayPnl: number;
  monthPct: number;
  edges: EdgeRow[];
  positions: Position[];
  fills: Fill[];
  liveStories: Story[];
  onPlaceBet: (r: EdgeRow, count: number) => void;
};

type GuideKind = "decision" | "review" | "learn" | "explore" | "live";

const TERMS = [
  {
    word: "Kelly",
    explain:
      "押多少的公式 · 不贪不怯 · edge 越大押越多 · 你 $35 现金 · edge 8% → 推荐押 $4",
  },
  {
    word: "edge",
    explain:
      "便宜分 · 我们模型说 60% 赢 · Kalshi 卖 50¢ · edge = 10pp · 数学上长期赚",
  },
  {
    word: "EV",
    explain:
      "期望值 · 押 $10 · 模型 70% · 价 50¢ → EV +$4 · 长期每押 1 次平均赚 4 块",
  },
  {
    word: "spread",
    explain:
      "买卖价差 · yes 买 50¢ 卖 48¢ → 你 buy-sell 立刻亏 2¢ · spread 越小越好",
  },
  {
    word: "vol24",
    explain:
      "过去 24h 这个 market 成交多少 · vol24 越大流动性越好 · < $200 别下",
  },
  {
    word: "Brier",
    explain:
      "模型准确度 · 0 完美 · 0.25 随机 · 我们 0.196 算 OK · 长期能赚",
  },
];

const REVIEW_TAGS = ["edge 信号", "情绪盘", "跟风下", "直觉冲动", "凑热闹"];
const REVIEW_KEY = "xiapan:bet-log";

type LogEntry = {
  ts: string;
  ticker: string;
  reason: string;
  tag?: string;
};

function loadLog(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(REVIEW_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLog(arr: LogEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REVIEW_KEY, JSON.stringify(arr));
}

export function GuideSection({
  cash,
  todayPnl,
  monthPct,
  edges,
  positions,
  fills,
  liveStories,
  onPlaceBet,
}: Props) {
  const [active, setActive] = useState<GuideKind>("decision");
  const [mounted, setMounted] = useState(false);
  const [reviewLog, setReviewLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    setMounted(true);
    setReviewLog(loadLog());
  }, []);

  const strongEdge = edges.find((e) => e.level === "strong");
  const recentFill = fills[0];
  const term = TERMS[Math.floor(Date.now() / 86400000) % TERMS.length];
  const liveOnPosition = liveStories.find((s) =>
    positions.some((p) =>
      (p.title || "").toLowerCase().includes(s.team1.toLowerCase())
    )
  );

  const tabs: { key: GuideKind; label: string; emoji: string; show: boolean }[] = [
    { key: "decision", label: "该不该下", emoji: "▲", show: !!strongEdge },
    { key: "live", label: "比赛现况", emoji: "●", show: !!liveOnPosition || liveStories.length > 0 },
    { key: "review", label: "上次为啥", emoji: "↺", show: !!recentFill },
    { key: "learn", label: "这词啥意思", emoji: "?", show: true },
    { key: "explore", label: "还能玩啥", emoji: "◇", show: true },
  ];
  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <section className="bg-paper-bright border border-ink/10 rounded-lg overflow-hidden">
      <div className="px-5 py-2.5 border-b border-ink/10 flex items-baseline justify-between">
        <span className="text-sm font-bold">⊙ 边玩边问</span>
        <span className="text-[10px] text-ink-dim font-mono">
          软件主动问你 · 帮你做决策
        </span>
      </div>
      <div className="px-3 py-2 border-b border-ink/5 flex flex-wrap gap-1">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`text-[11px] font-mono px-2.5 py-1 rounded transition ${
              active === t.key
                ? "bg-ink text-paper"
                : "bg-paper-deep/30 hover:bg-paper-deep"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        <AnimatePresence mode="wait">
          {active === "decision" && strongEdge && (
            <DecisionCard
              key="d"
              edge={strongEdge}
              cash={cash}
              todayPnl={todayPnl}
              onBet={(c) => onPlaceBet(strongEdge, c)}
            />
          )}
          {active === "live" && liveStories.length > 0 && (
            <LiveCard key="l" story={liveOnPosition || liveStories[0]} hasPosition={!!liveOnPosition} />
          )}
          {active === "review" && recentFill && mounted && (
            <ReviewCard
              key="r"
              fill={recentFill}
              log={reviewLog}
              onSave={(entry) => {
                const next = [entry, ...reviewLog].slice(0, 50);
                setReviewLog(next);
                saveLog(next);
              }}
            />
          )}
          {active === "learn" && (
            <LearnCard key="ln" term={term} cash={cash} />
          )}
          {active === "explore" && (
            <ExploreCard
              key="e"
              edges={edges}
              monthPct={monthPct}
              todayPnl={todayPnl}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─────────── 1. 决策卡 ───────────
function DecisionCard({
  edge,
  cash,
  todayPnl,
  onBet,
}: {
  edge: EdgeRow;
  cash: number;
  todayPnl: number;
  onBet: (count: number) => void;
}) {
  const recommended = Math.max(
    1,
    Math.round(((edge.kellySuggestStake || 1) * 100) / Math.max(1, edge.buyPriceC || 1))
  );
  const cost = ((edge.buyPriceC || 0) * recommended) / 100;
  const cooldown = todayPnl <= -15;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-base font-bold leading-tight">
        现在 ·{" "}
        <span className="text-red">
          {edge.team1} vs {edge.team2}
        </span>{" "}
        值得下 · 你押不押?
      </div>
      <div className="text-xs text-ink-soft mt-1.5 leading-relaxed">
        模型说 <b>{edge.buySide}</b> 应该赢 · Kalshi 价 {edge.buyPriceC}¢ · 比模型便宜{" "}
        <b className="text-amber">{edge.myEdgePp?.toFixed(1)}pp</b>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div className="bg-paper rounded p-2 border border-ink/5">
          <div className="text-ink-dim">推荐</div>
          <div className="font-bold tabular-nums">{recommended} 张</div>
        </div>
        <div className="bg-paper rounded p-2 border border-ink/5">
          <div className="text-ink-dim">花</div>
          <div className="font-bold tabular-nums">${cost.toFixed(2)}</div>
        </div>
        <div className="bg-paper rounded p-2 border border-ink/5">
          <div className="text-ink-dim">赢拿</div>
          <div className="font-bold tabular-nums text-sage">
            ${(((100 - (edge.buyPriceC || 0)) * recommended) / 100).toFixed(2)}
          </div>
        </div>
      </div>
      {cooldown ? (
        <div className="mt-3 p-2.5 bg-red/10 rounded border border-red/30 text-xs">
          △ 你今日已亏 ${(-todayPnl).toFixed(2)} · 24h 冷静期 · 软件建议 [跳过]
        </div>
      ) : (
        <div className="mt-3 flex gap-1.5">
          <button
            onClick={() => onBet(recommended)}
            className="flex-1 px-3 py-2 bg-red text-paper text-sm font-bold rounded"
          >
            是 · 押 {recommended} 张 · ${cost.toFixed(2)}
          </button>
          <button className="px-3 py-2 bg-paper-deep border border-ink/10 text-xs rounded">
            不 · 等等
          </button>
        </div>
      )}
      <div className="mt-2 text-[10px] text-ink-dim">
        现金 ${cash.toFixed(2)} · 今日盈亏 {todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(2)}
      </div>
    </motion.div>
  );
}

// ─────────── 2. 实时秒级解读卡 ───────────
function LiveCard({ story, hasPosition }: { story: Story; hasPosition: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-base font-bold">
        {hasPosition ? "● 你押的比赛 · 实时" : "● 现在正在打"}
      </div>
      <div className="text-sm font-mono mt-1">
        {story.team1} vs {story.team2}
      </div>
      <div className="text-[11px] text-ink-dim font-mono mt-0.5">
        {story.phase}
      </div>
      <div className="mt-2 p-3 bg-paper rounded border border-ink/5 text-sm leading-relaxed">
        {story.story}
      </div>
      <div className="mt-2 text-[11px] text-ink-soft">
        下一步看什么 · {hasPosition ? "你已下单 · 看走势 · 浮亏 ≥ 50% 考虑卖锁损" : "再等一波价格变 · 或下小注体验"}
      </div>
    </motion.div>
  );
}

// ─────────── 3. 复盘卡 ───────────
function ReviewCard({
  fill,
  log,
  onSave,
}: {
  fill: Fill;
  log: LogEntry[];
  onSave: (entry: LogEntry) => void;
}) {
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const past = log.find((l) => l.ticker === fill.ticker);
  const hasReason = !!past;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-base font-bold">
        ↺ 你 {fill.ts.slice(11, 16)} 下了一单
      </div>
      <div className="text-xs font-mono mt-1 text-ink-soft">
        {fill.action?.toUpperCase?.() || ""} {fill.side.toUpperCase()} {fill.count.toFixed(0)} @ {fill.price_cents}¢
      </div>
      <div className="text-[11px] text-ink-dim font-mono mt-0.5">
        {fill.ticker}
      </div>
      {hasReason ? (
        <div className="mt-2 p-3 bg-paper rounded border border-ink/5">
          <div className="text-[11px] text-ink-dim mb-1">你当时写的理由</div>
          <div className="text-sm">{past!.reason}</div>
          {past!.tag && (
            <div className="mt-1 text-[11px]">
              标记 ·{" "}
              <span
                className={
                  past!.tag === "edge 信号"
                    ? "text-sage font-bold"
                    : "text-red"
                }
              >
                {past!.tag}
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-2">
            <div className="text-[11px] text-ink-dim mb-1">为啥下这单?</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="一句话写下来 · 后续复盘会问你"
              className="w-full px-2 py-1.5 bg-paper border border-ink/15 rounded text-xs"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {REVIEW_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  tag === t
                    ? "bg-ink text-paper"
                    : "bg-paper-deep/40 hover:bg-paper-deep"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (!reason.trim()) return;
              onSave({
                ts: fill.ts,
                ticker: fill.ticker,
                reason,
                tag: tag || undefined,
              });
              setReason("");
              setTag(null);
            }}
            disabled={!reason.trim()}
            className="mt-2 px-3 py-1.5 bg-ink text-paper text-xs rounded disabled:opacity-30"
          >
            保存复盘
          </button>
        </>
      )}
      {log.length > 0 && (
        <div className="mt-3 pt-2 border-t border-ink/5 text-[10px] text-ink-dim">
          已复盘 {log.length} 单 ·{" "}
          {(() => {
            const e = log.filter((l) => l.tag === "edge 信号").length;
            const o = log.filter((l) => l.tag && l.tag !== "edge 信号").length;
            return `${e} 边缘单 · ${o} 情绪/跟风`;
          })()}
        </div>
      )}
    </motion.div>
  );
}

// ─────────── 4. 学习卡 ───────────
function LearnCard({ term, cash }: { term: typeof TERMS[number]; cash: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-base font-bold">
        ? 今天学一个词 · <span className="text-red">{term.word}</span>
      </div>
      <div className="mt-2 p-3 bg-paper rounded border border-ink/5 text-sm leading-relaxed">
        {term.explain}
      </div>
      <div className="mt-2 text-[11px] text-ink-dim">
        你的本金 ${cash.toFixed(0)} · 知道这个 · 下次决策更稳
      </div>
    </motion.div>
  );
}

// ─────────── 5. 探索卡 ───────────
function ExploreCard({
  edges,
  monthPct,
  todayPnl,
}: {
  edges: EdgeRow[];
  monthPct: number;
  todayPnl: number;
}) {
  const watchCount = edges.filter((e) => e.level === "watch").length;
  const strongCount = edges.filter((e) => e.level === "strong").length;
  const messages: string[] = [];
  if (strongCount > 0) {
    messages.push(`★ ${strongCount} 单 STRONG · 现在能下`);
  }
  if (watchCount > 0) {
    messages.push(`◇ ${watchCount} 单 WATCH · 看价位再下`);
  }
  if (monthPct < 0.1 && todayPnl >= 0) {
    messages.push(
      `本月进度 ${(monthPct * 100).toFixed(1)}% · 慢了 · 多盯几场比赛`
    );
  } else if (monthPct >= 0.5) {
    messages.push(
      `本月进度 ${(monthPct * 100).toFixed(1)}% · 已过半 · 别贪 · 守住`
    );
  }
  if (todayPnl >= 5) {
    messages.push(`今天已赚 $${todayPnl.toFixed(0)} · 见好就收?`);
  }
  if (messages.length === 0) {
    messages.push(`没特别情况 · 等下一个 ★ 信号 · 或者去看比赛娱乐`);
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="text-base font-bold">◇ 还能玩啥</div>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
        {messages.map((m, i) => (
          <li key={i} className="leading-relaxed">
            · {m}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
