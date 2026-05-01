"use client";

// 客观概率对比 · 不信大盘 · 三方对比
// 大盘 (Kalshi 隐含) vs 模型 (Elo / 历史) vs Live (实时数据修正)
// 视觉 · 三个圆环 + 差值高亮 + 故事

import { motion } from "motion/react";

type Props = {
  marketP: number; // 0-1
  modelP: number;
  liveP?: number;
  story?: string;
  confidence?: number; // 0-1
  buySide?: string;
  bigName?: boolean; // 显示队名
  team1?: string;
  team2?: string;
};

function pct(x: number) {
  return Math.max(0, Math.min(100, Math.round(x * 100)));
}

function ProbRing({
  label,
  value,
  color,
  size = 64,
}: {
  label: string;
  value: number;
  color: string;
  size?: number;
}) {
  const circ = Math.PI * 2 * 28;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#e8dfc7"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 32 32)"
            strokeLinecap="round"
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums"
          style={{ color }}
        >
          {value}%
        </div>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
        {label}
      </div>
    </div>
  );
}

export function TrueProbCard({
  marketP,
  modelP,
  liveP,
  story,
  confidence = 0.7,
  buySide,
  team1,
  team2,
}: Props) {
  const m = pct(marketP);
  const mod = pct(modelP);
  const live = liveP != null ? pct(liveP) : null;
  const delta = mod - m;
  const deltaLive = live != null ? live - m : null;
  const showLive = live != null && Math.abs((live ?? 0) - mod) > 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-paper rounded p-3 border border-ink/10"
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-dim">
          客观概率 · {buySide ? `押 ${buySide} 赢` : ""}
        </span>
        <span className="text-[10px] text-ink-dim font-mono">
          可信度 {Math.round(confidence * 100)}%
        </span>
      </div>
      <div className="flex items-center justify-around gap-3">
        <ProbRing label="大盘说" value={m} color="#6a8a6e" />
        <div className="text-2xl text-ink-dim">→</div>
        <ProbRing label="模型说" value={mod} color="#c1272d" />
        {showLive && live != null && (
          <>
            <div className="text-2xl text-ink-dim">→</div>
            <ProbRing label="实时说" value={live} color="#d89937" />
          </>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-paper-deep/30 rounded p-2">
          <div className="text-[10px] text-ink-dim">模型 vs 大盘</div>
          <div
            className={`text-lg font-bold tabular-nums ${delta >= 5 ? "text-sage" : delta <= -5 ? "text-red" : "text-amber"}`}
          >
            {delta >= 0 ? "+" : ""}
            {delta} pp
          </div>
        </div>
        {showLive && deltaLive != null && (
          <div className="bg-paper-deep/30 rounded p-2">
            <div className="text-[10px] text-ink-dim">实时 vs 大盘</div>
            <div
              className={`text-lg font-bold tabular-nums ${deltaLive >= 5 ? "text-sage" : deltaLive <= -5 ? "text-red" : "text-amber"}`}
            >
              {deltaLive >= 0 ? "+" : ""}
              {deltaLive} pp
            </div>
          </div>
        )}
      </div>

      {story && (
        <div className="mt-2 text-[11px] text-ink-soft leading-relaxed">{story}</div>
      )}

      <div className="mt-2 text-[10px] text-ink-dim leading-relaxed">
        {Math.abs(delta) >= 5
          ? `▲ 大盘和我们差 ${Math.abs(delta)}pp · ${delta > 0 ? "我们模型说还低估" : "我们模型说被高估了"} · ${delta > 0 ? "押 yes" : "押 no"} 有 edge`
          : "差距小 · 大盘定价基本对 · 跳过"}
      </div>
    </motion.div>
  );
}
