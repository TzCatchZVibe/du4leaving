"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

type Crypto = {
  key: string;
  ticker: string;
  spotSym: string;
  label: string;
  name: string;
  emoji: string;
  spot: number | null;
  available: boolean;
  reason?: string;
  target?: number | null;
  yes_ask?: number;
  yes_bid?: number;
  no_ask?: number;
  no_bid?: number;
  volume_24h?: number;
  minutesLeft?: number;
  distance?: number | null;
  distancePct?: number | null;
  story?: string;
  advice?: string;
  suggested?: "yes" | "no" | "skip";
};

type Resp = { ok: boolean; cryptos: Crypto[] };

export function CryptoCorner() {
  const [data, setData] = useState<Resp | null>(null);
  const [history, setHistory] = useState<Record<string, { ts: number; p: number }[]>>({});
  const [betMsg, setBetMsg] = useState<string | null>(null);
  const [count, setCount] = useState(5);
  const [activeKey, setActiveKey] = useState<string>("btc");

  useEffect(() => {
    let alive = true;
    const fetchOnce = () =>
      fetch("/api/xiapan/crypto15m")
        .then((r) => r.json())
        .then((d: Resp) => {
          if (!alive) return;
          setData(d);
          if (d.ok) {
            setHistory((h) => {
              const next: typeof h = { ...h };
              for (const c of d.cryptos) {
                if (c.spot != null) {
                  next[c.key] = [...(next[c.key] || []), { ts: Date.now(), p: c.spot }].slice(-60);
                }
              }
              return next;
            });
          }
        })
        .catch(() => {});
    fetchOnce();
    const id = setInterval(fetchOnce, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!data || !data.ok)
    return (
      <div className="bg-ink text-paper rounded-lg p-4 text-xs">加载 9 种 crypto…</div>
    );

  const active = data.cryptos.find((c) => c.key === activeKey);

  async function placeBet(c: Crypto, side: "yes" | "no") {
    if (!c.ticker || !c.available) return;
    setBetMsg("下单中…");
    try {
      const r = await fetch("/api/xiapan/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: c.ticker, side, count }),
      });
      const d = await r.json();
      setBetMsg(
        d.ok
          ? `✓ ${c.label} ${side.toUpperCase()} × ${count} @ ${d.price}¢ · ${d.cost_dollars.toFixed(2)} 美刀`
          : `✕ ${d.error}`
      );
    } catch (e) {
      setBetMsg(`✕ ${String(e)}`);
    }
    setTimeout(() => setBetMsg(null), 6000);
  }

  return (
    <motion.div
      layout
      className="bg-ink text-paper rounded-lg overflow-hidden"
    >
      {/* 顶部 9 个 crypto tab */}
      <div className="px-3 py-2 border-b border-paper/10 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold">币圈短赌 · 15min</span>
          <span className="text-[10px] text-paper/50 font-mono">4s 刷</span>
        </div>
        <span className="text-[10px] text-paper/50 font-mono">
          一站式 · 不用切 Kalshi
        </span>
      </div>
      <div className="px-3 py-2 border-b border-paper/10 flex flex-wrap gap-1">
        {data.cryptos.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveKey(c.key)}
            disabled={!c.available && !c.spot}
            className={`px-2 py-1 text-[11px] font-mono rounded transition disabled:opacity-30 ${
              activeKey === c.key
                ? "bg-paper text-ink"
                : "bg-paper/10 hover:bg-paper/20"
            }`}
          >
            {c.emoji} {c.label}
            {c.spot && (
              <span className="ml-1 text-[9px] opacity-60">
                ${c.spot < 1 ? c.spot.toFixed(4) : c.spot.toFixed(0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 焦点 crypto · 详情 */}
      {active && <CryptoDetailPanel
        c={active}
        history={history[active.key] || []}
        count={count}
        setCount={setCount}
        onBet={(side) => placeBet(active, side)}
      />}
      {betMsg && (
        <div className="px-3 pb-2 text-[11px] font-mono text-paper/80">
          {betMsg}
        </div>
      )}
    </motion.div>
  );
}

function CryptoDetailPanel({
  c,
  history,
  count,
  setCount,
  onBet,
}: {
  c: Crypto;
  history: { ts: number; p: number }[];
  count: number;
  setCount: (n: number) => void;
  onBet: (side: "yes" | "no") => void;
}) {
  const min = history.length ? Math.min(...history.map((h) => h.p)) : 0;
  const max = history.length ? Math.max(...history.map((h) => h.p)) : 0;
  const range = Math.max(min * 0.0001, max - min);

  if (!c.available) {
    return (
      <div className="px-4 py-6 text-center">
        <div className="text-3xl mb-1">{c.emoji}</div>
        <div className="text-sm font-bold">{c.name}</div>
        <div className="text-xs text-paper/60 mt-1">
          现价 · {c.spot ? `$${c.spot}` : "—"}
        </div>
        <div className="text-[11px] text-paper/40 mt-2">
          {c.reason || "Kalshi 这 15min 没开盘 · 等下一档"}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 大字号 现价 + target */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-paper/50">
            {c.emoji} 现价
          </div>
          <div className="text-3xl font-bold tabular-nums">
            ${c.spot && c.spot < 1 ? c.spot.toFixed(4) : c.spot?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-paper/50">{c.name}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-widest text-paper/50">
            target
          </div>
          <div className="text-xl font-bold tabular-nums">
            ${c.target?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div
            className={`text-xs font-mono tabular-nums ${(c.distance ?? 0) > 0 ? "text-amber" : "text-sage"}`}
          >
            {(c.distance ?? 0) > 0 ? "差 +" : "超 "}
            ${Math.abs(c.distance ?? 0).toFixed(2)} ·{" "}
            {(c.distancePct ?? 0).toFixed(3)}%
          </div>
          <div className="text-[10px] text-paper/40 font-mono">
            {c.minutesLeft}min 剩
          </div>
        </div>
      </div>

      {/* 价格曲线 */}
      <div className="px-3 py-2 border-y border-paper/10 bg-paper/5">
        <svg viewBox={`0 0 ${Math.max(60, history.length)} 30`} preserveAspectRatio="none" className="w-full h-12">
          {c.target && history.length > 0 && (
            <line
              x1="0"
              x2={Math.max(60, history.length)}
              y1={30 - ((c.target - min) / range) * 30}
              y2={30 - ((c.target - min) / range) * 30}
              stroke="#d89937"
              strokeDasharray="2,2"
              strokeWidth="0.5"
            />
          )}
          {history.length > 1 && (
            <polyline
              fill="none"
              stroke="#6a8a6e"
              strokeWidth="0.8"
              points={history
                .map((h, i) => `${i},${30 - ((h.p - min) / range) * 30}`)
                .join(" ")}
            />
          )}
          {history.length > 0 && c.spot && (
            <circle
              cx={history.length - 1}
              cy={30 - ((c.spot - min) / range) * 30}
              r="0.8"
              fill="#c1272d"
            />
          )}
        </svg>
      </div>

      {/* 故事性人话 */}
      <div className="px-4 py-2.5 bg-paper/5">
        <div className="text-xs leading-relaxed">{c.story}</div>
        <div className="text-[11px] text-paper/60 mt-1">
          建议 ·{" "}
          <span
            className={
              c.suggested === "yes"
                ? "text-sage font-bold"
                : c.suggested === "no"
                  ? "text-red font-bold"
                  : "text-paper/60"
            }
          >
            {c.suggested === "yes"
              ? "押 YES"
              : c.suggested === "no"
                ? "押 NO"
                : "跳过"}
          </span>{" "}
          · {c.advice}
        </div>
      </div>

      {/* 一键下单 */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <div className="bg-paper/5 rounded p-2">
          <div className="text-[10px] text-paper/50 uppercase font-mono">
            yes 押 ≥ target
          </div>
          <div className="text-2xl font-bold tabular-nums">{c.yes_ask}¢</div>
          <div className="text-[10px] text-paper/40">bid {c.yes_bid}</div>
        </div>
        <div className="bg-paper/5 rounded p-2">
          <div className="text-[10px] text-paper/50 uppercase font-mono">
            no 押 &lt; target
          </div>
          <div className="text-2xl font-bold tabular-nums">{c.no_ask}¢</div>
          <div className="text-[10px] text-paper/40">bid {c.no_bid}</div>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center gap-2">
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
          onClick={() => onBet("yes")}
          className="flex-1 px-3 py-2 bg-sage text-paper text-xs font-bold rounded hover:opacity-90"
        >
          ▲ 押 YES · ${(((c.yes_ask || 0) * count) / 100).toFixed(2)}
        </button>
        <button
          onClick={() => onBet("no")}
          className="flex-1 px-3 py-2 bg-red text-paper text-xs font-bold rounded hover:opacity-90"
        >
          ▼ 押 NO · ${(((c.no_ask || 0) * count) / 100).toFixed(2)}
        </button>
      </div>

      <div className="px-4 py-2 border-t border-paper/10 text-[10px] font-mono text-paper/50 flex items-baseline justify-between">
        <span>vol24 ${(c.volume_24h || 0).toFixed(0)}</span>
        <span>{c.ticker}</span>
      </div>
    </div>
  );
}
