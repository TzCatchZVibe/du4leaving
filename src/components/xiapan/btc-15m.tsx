"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

type Resp = {
  ok: boolean;
  kalshi?: {
    eventTicker: string;
    title: string;
    subTitle: string;
    target: number | null;
    ticker: string;
    yes_bid: number;
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    last_price: number;
    volume: number;
    volume_24h: number;
    expected_expiration_time: string;
    yes_sub: string;
    no_sub: string;
  };
  spot?: { usd: number | null; source: string };
  analysis?: {
    direction: "above" | "below" | null;
    distance: number | null;
    distancePct: number | null;
    minutesLeft: number | null;
    yesImpliedP: number | null;
    suggestedSide: "yes" | "no" | "skip";
    confidence: string;
    story: string;
  };
};

export function Btc15mPanel() {
  const [data, setData] = useState<Resp | null>(null);
  const [history, setHistory] = useState<{ ts: number; price: number }[]>([]);
  const [betMsg, setBetMsg] = useState<string | null>(null);
  const [count, setCount] = useState(5);
  const fetchRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchOnce = () =>
      fetch("/api/xiapan/btc15m")
        .then((r) => r.json())
        .then((d: Resp) => {
          if (!alive) return;
          setData(d);
          if (d.ok && d.spot?.usd) {
            setHistory((h) => {
              const next = [
                ...h,
                { ts: Date.now(), price: d.spot!.usd! },
              ].slice(-60);
              return next;
            });
          }
        })
        .catch(() => {});
    fetchOnce();
    fetchRef.current = setInterval(fetchOnce, 3000);
    return () => {
      alive = false;
      if (fetchRef.current) clearInterval(fetchRef.current);
    };
  }, []);

  if (!data || !data.ok)
    return (
      <div className="bg-paper-bright border border-ink/10 rounded-md p-4 text-xs text-ink-dim">
        加载 BTC 15min 中… (等 Kalshi event 开盘)
      </div>
    );

  const k = data.kalshi!;
  const spot = data.spot?.usd;
  const a = data.analysis!;
  const target = k.target;
  const dir = a.direction;
  const dist = a.distance ?? 0;
  const distPct = a.distancePct ?? 0;
  const left = a.minutesLeft ?? 0;

  // 简易曲线 · 最近 60 个点
  const curveMin = history.length
    ? Math.min(...history.map((h) => h.price))
    : 0;
  const curveMax = history.length
    ? Math.max(...history.map((h) => h.price))
    : 0;
  const range = Math.max(50, curveMax - curveMin);

  async function placeBet(side: "yes" | "no") {
    setBetMsg("下单中…");
    try {
      const r = await fetch("/api/xiapan/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: k.ticker,
          side,
          count,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setBetMsg(
          `✓ 押 ${side.toUpperCase()} × ${count} @ ${d.price}¢ · 成本 $${d.cost_dollars.toFixed(2)}`
        );
      } else setBetMsg(`✕ ${d.error}`);
    } catch (e) {
      setBetMsg(`✕ ${String(e)}`);
    }
    setTimeout(() => setBetMsg(null), 6000);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-ink text-paper rounded-lg overflow-hidden border border-ink"
    >
      {/* 顶部 · 大字号实时价 */}
      <div className="px-4 py-3 border-b border-paper/10">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-paper/50">
              ₿ BTC 15min · Kalshi 短赌
            </div>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="text-3xl lg:text-4xl font-bold tabular-nums">
                ${spot?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "—"}
              </span>
              <span className="text-xs text-paper/50 font-mono">
                现价 · {data.spot?.source}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest text-paper/50">
              target
            </div>
            <div className="text-xl font-bold tabular-nums">
              ${target?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div
              className={`text-xs font-mono tabular-nums ${dir === "above" ? "text-amber" : "text-sage"}`}
            >
              {dir === "above" ? `还差 +$${dist.toFixed(0)}` : `已超 $${(-dist).toFixed(0)}`}
              {" · "}
              {distPct.toFixed(3)}%
            </div>
          </div>
        </div>
      </div>

      {/* 价格曲线 · 极简 60 点 */}
      <div className="px-4 py-2 border-b border-paper/10 bg-paper/5">
        <div className="text-[10px] text-paper/50 mb-1 flex justify-between font-mono">
          <span>近 {history.length} 个点 · 3s 一抓</span>
          <span>剩 {left}min 到 target deadline</span>
        </div>
        <svg viewBox={`0 0 ${Math.max(60, history.length)} 30`} preserveAspectRatio="none" className="w-full h-12">
          {/* target 横线 */}
          {target && history.length > 0 && (
            <line
              x1="0"
              x2={Math.max(60, history.length)}
              y1={30 - ((target - curveMin) / range) * 30}
              y2={30 - ((target - curveMin) / range) * 30}
              stroke="#d89937"
              strokeDasharray="2,2"
              strokeWidth="0.5"
            />
          )}
          {/* 价格曲线 */}
          {history.length > 1 && (
            <polyline
              fill="none"
              stroke="#6a8a6e"
              strokeWidth="0.8"
              points={history
                .map(
                  (h, i) =>
                    `${i},${30 - ((h.price - curveMin) / range) * 30}`
                )
                .join(" ")}
            />
          )}
          {/* 最新点 */}
          {history.length > 0 && spot && (
            <circle
              cx={history.length - 1}
              cy={30 - ((spot - curveMin) / range) * 30}
              r="0.8"
              fill="#c1272d"
            />
          )}
        </svg>
        <div className="flex justify-between text-[9px] text-paper/40 font-mono">
          <span>${curveMin.toFixed(0)}</span>
          <span>${curveMax.toFixed(0)}</span>
        </div>
      </div>

      {/* Kalshi 价格 + 决策建议 */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div className="bg-paper/5 rounded p-2.5">
          <div className="text-[10px] text-paper/50 uppercase font-mono">
            yes (押 BTC ≥ target)
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {k.yes_ask}¢
          </div>
          <div className="text-[10px] text-paper/40 font-mono">
            bid {k.yes_bid} · ask {k.yes_ask}
          </div>
        </div>
        <div className="bg-paper/5 rounded p-2.5">
          <div className="text-[10px] text-paper/50 uppercase font-mono">
            no (押 BTC &lt; target)
          </div>
          <div className="text-2xl font-bold tabular-nums">{k.no_ask}¢</div>
          <div className="text-[10px] text-paper/40 font-mono">
            bid {k.no_bid} · ask {k.no_ask}
          </div>
        </div>
      </div>

      {/* 决策故事 */}
      <div className="px-4 pb-3">
        <div className="bg-paper/5 rounded p-2.5 mb-2">
          <div className="text-xs text-paper">{a.story}</div>
          <div className="text-[11px] text-paper/60 mt-1">
            建议 ·{" "}
            <span
              className={
                a.suggestedSide === "yes"
                  ? "text-sage font-bold"
                  : a.suggestedSide === "no"
                    ? "text-red font-bold"
                    : "text-paper/60"
              }
            >
              {a.suggestedSide === "yes"
                ? "押 YES"
                : a.suggestedSide === "no"
                  ? "押 NO"
                  : "跳过"}
            </span>
            <span className="text-paper/50"> · {a.confidence}</span>
          </div>
        </div>

        {/* 下注 · 一键 */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-paper/60">
            数量
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
              className="w-14 px-2 py-1 bg-paper/10 border border-paper/20 rounded text-sm font-mono"
            />
          </label>
          <button
            onClick={() => placeBet("yes")}
            className="flex-1 px-3 py-2 bg-sage text-paper text-xs font-bold rounded hover:opacity-90"
          >
            ▲ 押 YES {count} · ${((k.yes_ask * count) / 100).toFixed(2)}
          </button>
          <button
            onClick={() => placeBet("no")}
            className="flex-1 px-3 py-2 bg-red text-paper text-xs font-bold rounded hover:opacity-90"
          >
            ▼ 押 NO {count} · ${((k.no_ask * count) / 100).toFixed(2)}
          </button>
        </div>
        {betMsg && (
          <div className="mt-2 text-[11px] font-mono text-paper/80">
            {betMsg}
          </div>
        )}
      </div>

      {/* 流动性 + 链接 */}
      <div className="px-4 py-2 border-t border-paper/10 flex items-baseline justify-between text-[10px] font-mono text-paper/50">
        <span>vol $ {k.volume.toFixed(0)} · 24h ${k.volume_24h.toFixed(0)}</span>
        <a
          href={`https://kalshi.com/markets/${k.ticker}`}
          target="_blank"
          rel="noopener"
          className="hover:text-paper"
        >
          Kalshi ↗
        </a>
      </div>
    </motion.div>
  );
}
