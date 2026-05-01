"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Story = {
  sport: string;
  sportLabel: string;
  team1: string;
  team2: string;
  score1: number | string;
  score2: number | string;
  phase: string;
  story: string;
  rule: string;
  kalshiHint?: string;
  lastUpdate: string;
};

type Resp = { ok: boolean; stories: Story[]; count: number };

const SPORT_BADGE: Record<string, { emoji: string; color: string }> = {
  lol: { emoji: "電", color: "text-red" },
  nba: { emoji: "篮", color: "text-amber" },
  mlb: { emoji: "棒", color: "text-sage" },
  nfl: { emoji: "球", color: "text-red" },
  nhl: { emoji: "冰", color: "text-amber" },
  tennis: { emoji: "网", color: "text-sage" },
  soccer: { emoji: "足", color: "text-amber" },
  golf: { emoji: "杆", color: "text-sage" },
};

// V3 S6 · 下一步看什么 · sport + phase + 分差 推导 · Domer 视角
function nextWatch(s: Story): string {
  const p = (s.phase || "").toLowerCase();
  const n1 = Number(s.score1) || 0;
  const n2 = Number(s.score2) || 0;
  const lead = Math.abs(n1 - n2);
  switch (s.sport) {
    case "lol": {
      if (/(game ?1|第\s*1)/.test(p))
        return "前 6 分钟看大龙刷 · 哪边先抓资源 · 反向比分小心追";
      if (/(game ?2|第\s*2)/.test(p))
        return "Game 2 翻盘频率高 · 1-1 走决胜局概率约 60%";
      if (/(game ?3|第\s*3)/.test(p))
        return "决胜局 · 看 BP 风格变化 · 已盘的别加仓";
      return "大龙 5 分钟刷一次 · BO5 节奏更稳 · 单局别 all-in";
    }
    case "nba":
      if (/(4th|q4|第\s*4)/.test(p))
        return lead <= 5
          ? "5 分以内 · 后 5 分钟罚球+暂停 · spread 飞涨"
          : "≥10 分领先 · 大概率不翻 · spread 缩水";
      return lead <= 8
        ? "比分胶着 · 第 4 节决定 · 看暂停后第一回合"
        : "差距拉开 · 等垃圾时间 · 不下";
    case "mlb":
      return "前 6 局变数大 · 7 局后下注更准 · 看 SP 出场情况";
    case "nfl":
      return "节末 2min 时间管理决定 spread · 看暂停剩余";
    case "nhl":
      return "OT 概率 1/4 · 看第 3 节最后 5 分钟换人";
    case "tennis":
      return "盘点 break 决定走势 · 看发球方一发率";
    case "soccer":
      return "70min 后看角球+黄牌 · 临场进球分布";
    case "golf":
      return "Round 4 后 9 洞才定胜负 · 现在过渡 · 不下";
    default:
      return "看比分变化 · 持仓的看止损线 · 没仓的等更便宜";
  }
}

export function LiveMatchCard({ compact = false }: { compact?: boolean }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const fetchOnce = () =>
      fetch("/api/xiapan/live")
        .then((r) => r.json())
        .then((d: Resp) => {
          if (alive && d.ok) {
            setStories(d.stories || []);
            setTick((t) => t + 1);
          }
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    fetchOnce();
    const id = setInterval(fetchOnce, 8_000); // 8s 自动刷
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (loading)
    return (
      <div className="text-[11px] text-ink-dim font-mono p-3">
        加载实时比赛…
      </div>
    );

  if (stories.length === 0)
    return (
      <div className="bg-paper rounded p-3 border border-ink/10">
        <div className="text-xs font-bold mb-1">⊙ 现在没比赛在打</div>
        <div className="text-[11px] text-ink-soft leading-relaxed">
          所有联赛刚结束今晚的赛程 · 等明天的比赛开打
          <br />
          <span className="text-ink-dim">Kalshi 上仍有 70+ 场未来 14 天可下</span>
        </div>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold">
          ⊙ 现在 {stories.length} 场在打
        </span>
        <span className="text-[10px] text-ink-dim font-mono">
          {tick > 0 ? "● live · 8s 自动刷" : "…"}
        </span>
      </div>
      <AnimatePresence>
        {stories.slice(0, compact ? 4 : 12).map((s, i) => (
          <motion.div
            key={`${s.sport}-${s.team1}-${s.team2}-${i}`}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-paper rounded p-3 border border-ink/10"
          >
            {/* sport + 队名 + 大比分 */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2 min-w-0 flex-1">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 bg-paper-deep rounded ${SPORT_BADGE[s.sport]?.color || ""}`}
                >
                  [{SPORT_BADGE[s.sport]?.emoji || "·"}] {s.sportLabel}
                </span>
                <span className="text-sm font-bold truncate">
                  {s.team1}{" "}
                  <span className="text-ink-dim text-xs mx-0.5">vs</span>{" "}
                  {s.team2}
                </span>
              </div>
              <span className="font-mono font-bold tabular-nums text-base shrink-0">
                {s.score1}
                <span className="text-ink-dim mx-0.5">-</span>
                {s.score2}
              </span>
            </div>
            {/* 阶段 */}
            <div className="text-[11px] text-ink-dim mt-1 font-mono">
              {s.phase}
            </div>
            {/* 故事 */}
            <div className="text-xs text-ink-soft mt-1.5 leading-relaxed">
              {s.story}
            </div>
            {/* 规则 */}
            {!compact && s.rule && (
              <div className="text-[11px] text-ink-dim mt-1.5 leading-relaxed bg-paper-deep/30 px-2 py-1 rounded">
                <span className="text-ink-soft">规则 ·</span> {s.rule}
              </div>
            )}
            {/* Kalshi 提示 */}
            {s.kalshiHint && (
              <div className="text-[11px] text-amber mt-1 leading-relaxed">
                <span className="font-bold">押注提示 ·</span> {s.kalshiHint}
              </div>
            )}
            {/* V3 S6 · 下一步看什么 · 客户端推导 · Domer 视角 */}
            {!compact && (
              <div className="text-[11px] text-sage mt-1 leading-relaxed">
                <span className="font-bold">▷ 下一步看 ·</span> {nextWatch(s)}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
