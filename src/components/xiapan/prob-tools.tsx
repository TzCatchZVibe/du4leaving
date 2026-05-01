"use client";

import { useMemo, useState } from "react";

// ────────── 数学 ──────────
function bo3WinProb(p: number): number {
  // P(win 2-0) = p^2
  // P(win 2-1) = 2 * p^2 * (1-p)
  return p * p + 2 * p * p * (1 - p);
}
function bo5WinProb(p: number): number {
  // P(win 3-0) = p^3
  // P(win 3-1) = 3 * p^3 * (1-p)
  // P(win 3-2) = 6 * p^3 * (1-p)^2
  return p ** 3 + 3 * p ** 3 * (1 - p) + 6 * p ** 3 * (1 - p) ** 2;
}

// Bayes: posterior = (prior * likelihood) / marginal
function bayesUpdate(prior: number, likelihoodIfTrue: number, likelihoodIfFalse: number) {
  const num = prior * likelihoodIfTrue;
  const den = num + (1 - prior) * likelihoodIfFalse;
  if (den === 0) return prior;
  return num / den;
}

// Hedge calc · 已下 buy yes @ entryC count, 现价 yes_bid → 一键卖锁利
function hedgeProfit(opts: {
  entryYesC: number;
  count: number;
  currentYesBidC: number;
}): { profit: number; pct: number } {
  const cost = (opts.entryYesC / 100) * opts.count;
  const sellRevenue = (opts.currentYesBidC / 100) * opts.count;
  const profit = sellRevenue - cost;
  return { profit, pct: cost > 0 ? (profit / cost) * 100 : 0 };
}

// CLV (Closing Line Value)
function clv(entryC: number, closingC: number) {
  const ev = closingC / 100 - entryC / 100;
  return { ev, pct: entryC > 0 ? (ev / (entryC / 100)) * 100 : 0 };
}

// Risk of ruin (full Kelly fraction f)
function riskOfRuin(p: number, b: number, fractionOfKelly: number) {
  const q = 1 - p;
  const edgeRatio = (b * p - q) / b;
  if (edgeRatio <= 0) return 1;
  const f = fractionOfKelly * edgeRatio;
  if (f <= 0 || f >= 1) return 1;
  return Math.pow(q / p, f * 10000) || 0;
}

// ────────── UI ──────────
export function ProbTools() {
  const [tab, setTab] = useState<"hedge" | "ev">("hedge");
  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-ink/10">
        <div className="text-sm font-bold">🧮 实战工具</div>
        <div className="text-[10px] text-ink-dim mt-0.5">
          直接用得上 · 砍掉花架子
        </div>
      </div>
      <div className="flex gap-1 p-2 border-b border-ink/10 text-[11px] font-mono">
        {[
          ["hedge", "对冲锁利"],
          ["ev", "长期 EV"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as typeof tab)}
            className={`px-2.5 py-1 rounded ${tab === k ? "bg-ink text-paper" : "hover:bg-paper-deep"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-3.5 text-xs space-y-2">
        {tab === "hedge" && <ToolHedge />}
        {tab === "ev" && <ToolEV />}
      </div>
    </div>
  );
}

function ToolBO() {
  const [p, setP] = useState(60);
  const single = p / 100;
  const bo3 = bo3WinProb(single);
  const bo5 = bo5WinProb(single);
  return (
    <div className="space-y-2.5">
      <div className="text-ink-dim">
        给我单局胜率 → 算 BO3 / BO5 系列胜率
      </div>
      <div>
        <label className="text-[11px] text-ink-dim">单局胜率 %</label>
        <input
          type="range"
          min={1}
          max={99}
          value={p}
          onChange={(e) => setP(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-base font-bold tabular-nums">{p}%</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-paper rounded p-2 border border-ink/5">
          <div className="text-[10px] text-ink-dim">BO3 胜率</div>
          <div className="text-xl font-bold tabular-nums">
            {(bo3 * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-paper rounded p-2 border border-ink/5">
          <div className="text-[10px] text-ink-dim">BO5 胜率</div>
          <div className="text-xl font-bold tabular-nums">
            {(bo5 * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="text-[11px] text-ink-soft pt-1">
        💡 Kalshi LOL Map 1 winner 价 = 单局胜率
        <br />
        BO3 winner 价 = BO3 胜率 · 用这个对比是否定价合理
      </div>
    </div>
  );
}

function ToolHedge() {
  const [entry, setEntry] = useState(50);
  const [count, setCount] = useState(10);
  const [bid, setBid] = useState(75);
  const r = hedgeProfit({
    entryYesC: entry,
    count,
    currentYesBidC: bid,
  });
  return (
    <div className="space-y-2">
      <div className="text-ink-dim">
        已 BUY YES · 现在 SELL 锁利或止损?
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Inp label="入场价 ¢" v={entry} setV={setEntry} />
        <Inp label="数量" v={count} setV={setCount} />
        <Inp label="当前 yes_bid ¢" v={bid} setV={setBid} />
      </div>
      <div className="bg-paper rounded p-2.5 border border-ink/5">
        <div className="text-[10px] text-ink-dim">
          立刻 sell 锁定盈亏
        </div>
        <div
          className={`text-xl font-bold tabular-nums ${r.profit >= 0 ? "text-sage" : "text-red"}`}
        >
          {r.profit >= 0 ? "+" : ""}${r.profit.toFixed(2)}
        </div>
        <div
          className={`text-xs ${r.pct >= 0 ? "text-sage" : "text-red"}`}
        >
          {r.pct >= 0 ? "+" : ""}
          {r.pct.toFixed(1)}% ROI
        </div>
      </div>
      <div className="text-[11px] text-ink-soft">
        💡 比赛 50% 时 yes 跳到 75¢ → 提早 sell 锁 25¢ × 张数
      </div>
    </div>
  );
}

function ToolBayes() {
  const [prior, setPrior] = useState(60);
  const [likeT, setLikeT] = useState(80);
  const [likeF, setLikeF] = useState(30);
  const post = bayesUpdate(prior / 100, likeT / 100, likeF / 100);
  return (
    <div className="space-y-2">
      <div className="text-ink-dim">
        新信息进来 (e.g. 主 carry 状态好) → 模型胜率怎么调
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Inp label="原胜率 %" v={prior} setV={setPrior} />
        <Inp label="Win 时观察到 %" v={likeT} setV={setLikeT} />
        <Inp label="Lose 时观察到 %" v={likeF} setV={setLikeF} />
      </div>
      <div className="bg-paper rounded p-2.5 border border-ink/5">
        <div className="text-[10px] text-ink-dim">更新后胜率</div>
        <div className="text-xl font-bold tabular-nums">
          {(post * 100).toFixed(1)}%
        </div>
        <div className="text-xs text-ink-dim">
          {post * 100 > prior ? "↑" : "↓"} {Math.abs(post * 100 - prior).toFixed(1)}pp
        </div>
      </div>
      <div className="text-[11px] text-ink-soft">
        💡 例 · T1 模型 60% · 比赛日 Faker 推特状态拉满 (强强信号 80% 出现) 弱时只 30%
        <br />→ 后验 78% · 加 18pp 信心
      </div>
    </div>
  );
}

function ToolCLV() {
  const [entry, setEntry] = useState(75);
  const [closing, setClosing] = useState(80);
  const c = clv(entry, closing);
  return (
    <div className="space-y-2">
      <div className="text-ink-dim">
        Closing Line Value · 你下单价 vs 收盘价 · 长期赚钱关键指标
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Inp label="你的入场价 ¢" v={entry} setV={setEntry} />
        <Inp label="收盘价 ¢ (关市前)" v={closing} setV={setClosing} />
      </div>
      <div className="bg-paper rounded p-2.5 border border-ink/5">
        <div className="text-[10px] text-ink-dim">CLV per dollar</div>
        <div
          className={`text-xl font-bold tabular-nums ${c.pct >= 0 ? "text-sage" : "text-red"}`}
        >
          {c.pct >= 0 ? "+" : ""}
          {c.pct.toFixed(1)}%
        </div>
      </div>
      <div className="text-[11px] text-ink-soft">
        💡 顶级 sharp 长期 CLV +2-5% · 你打 +5% 以上 = 已经赚钱
        <br />
        CLV &gt; 0 长期一定盈利, &lt; 0 长期一定亏 (短期运气)
      </div>
    </div>
  );
}

function ToolEV() {
  const [stake, setStake] = useState(10);
  const [edge, setEdge] = useState(5);
  const [bets, setBets] = useState(100);
  const evPerBet = stake * (edge / 100);
  const totalEv = evPerBet * bets;
  const stdDev = stake * Math.sqrt(bets);
  return (
    <div className="space-y-2">
      <div className="text-ink-dim">
        长期模拟 · 100 单同 edge 下你的预期净赚 + 标准差
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Inp label="单笔 $" v={stake} setV={setStake} />
        <Inp label="edge %" v={edge} setV={setEdge} />
        <Inp label="单数" v={bets} setV={setBets} />
      </div>
      <div className="bg-paper rounded p-2.5 border border-ink/5">
        <div className="text-[10px] text-ink-dim">{bets} 单后预期净赚</div>
        <div className="text-xl font-bold tabular-nums text-sage">
          +${totalEv.toFixed(2)}
        </div>
        <div className="text-[10px] text-ink-dim">
          ± ${stdDev.toFixed(2)} (1σ 波动) · 95% 概率落在 ±2σ
        </div>
      </div>
      <div className="text-[11px] text-ink-soft">
        💡 单笔 EV 可能负, 但 100 单后大数定律收敛 · 这是长期赚钱的本质
      </div>
    </div>
  );
}

function Inp({
  label,
  v,
  setV,
}: {
  label: string;
  v: number;
  setV: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] text-ink-dim">{label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        className="w-full mt-0.5 px-2 py-1 bg-paper border border-ink/20 rounded text-sm font-mono tabular-nums"
      />
    </label>
  );
}
