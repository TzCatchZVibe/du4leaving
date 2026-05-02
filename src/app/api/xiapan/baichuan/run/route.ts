// /api/xiapan/baichuan/run
//
// V0.72 · 百川主入口 · cron 每 5 分钟跑
//   1. 拉所有信号源 (当前 · btc-edges)
//   2. 按 ticker 聚合 → 跑 fuse() → 跑 decide()
//   3. 通过的 → debit S/C 池 + 写 lessons.jsonl
//   4. 输出执行报告

import { NextResponse } from "next/server";
import { fuse, decide, type Signal } from "@/lib/xiapan/百川/fusion";
import { readPools, debitFromPool } from "@/lib/xiapan/百川/pools";
import { checkRealtimeCircuit } from "@/lib/xiapan/百川/allocator";
import { appendLesson } from "@/lib/xiapan/百川/lessons";
import { loadWeights } from "@/lib/xiapan/百川/weights";
import { predictML } from "@/lib/xiapan/百川/ml/predict";
import { inferBoard } from "@/lib/xiapan/百川/ml/features";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

interface SignalSourceResult {
  source: string;
  signals: Signal[];
  market_data?: Map<string, { vol_24: number; spread_c: number; market_p: number }>;
}

// 拉 BTC 信号 + 市场数据
async function pullBtcSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/btc-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "btc-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    for (const e of r.edges ?? []) {
      md.set(e.ticker, { vol_24: e.vol_24, spread_c: e.spread_c, market_p: e.market_p });
    }
    return { source: "btc-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "btc-edges", signals: [] };
  }
}

// V0.72 W2 · 拉 ETH 信号 (BS + cross-tenor + cross-platform)
async function pullEthSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/eth-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "eth-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    for (const e of r.edges ?? []) {
      md.set(e.ticker, { vol_24: e.vol_24, spread_c: e.spread_c, market_p: e.market_p });
    }
    return { source: "eth-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "eth-edges", signals: [] };
  }
}

// V0.72 W2 · 拉 SOL 信号 (BS + cross-tenor + cross-platform)
async function pullSolSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/sol-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "sol-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    for (const e of r.edges ?? []) {
      md.set(e.ticker, { vol_24: e.vol_24, spread_c: e.spread_c, market_p: e.market_p });
    }
    return { source: "sol-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "sol-edges", signals: [] };
  }
}

// V0.72 W3 · 拉经济信号 (FOMC/CPI/Jobs/GDP · Kalshi vs Polymarket)
async function pullFedSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/fed-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "fed-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    for (const e of r.edges ?? []) {
      md.set(e.ticker, { vol_24: e.vol_24, spread_c: e.spread_c, market_p: e.market_p });
    }
    return { source: "fed-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "fed-edges", signals: [] };
  }
}

// V0.72 W3 · 拉 NBA Elo 信号 (体育品类)
async function pullNbaSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/nba-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "nba-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    for (const e of r.edges ?? []) {
      md.set(e.ticker, { vol_24: e.vol_24, spread_c: e.spread_c, market_p: e.market_p });
    }
    return { source: "nba-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "nba-edges", signals: [] };
  }
}

// V0.72 W2 · 拉反公众信号 (vol skew · 全品类通用)
async function pullContrarianSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/contrarian-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "contrarian", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    if (r.market_data) {
      for (const [ticker, mdEntry] of Object.entries(r.market_data as Record<string, { vol_24: number; spread_c: number; market_p: number }>)) {
        md.set(ticker, mdEntry);
      }
    }
    return { source: "contrarian", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "contrarian", signals: [] };
  }
}

// V0.72 W2 · 拉 Mention 信号 (Catboy / Trump 名人发言 · 凸性桶)
async function pullMentionSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/mention-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "mention-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    if (r.market_data) {
      for (const [ticker, mdEntry] of Object.entries(r.market_data as Record<string, { vol_24: number; spread_c: number; market_p: number }>)) {
        md.set(ticker, mdEntry);
      }
    }
    return { source: "mention-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "mention-edges", signals: [] };
  }
}

// V0.72 W2 · 拉 FDA 信号 (AdCom 投票后 · 凸性桶)
async function pullFdaSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/fda-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "fda-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    for (const e of r.edges ?? []) {
      if (e.market_p !== undefined && e.meeting?.kalshi_ticker) {
        md.set(e.meeting.kalshi_ticker, {
          vol_24: e.vol_24 ?? 0,
          spread_c: e.spread_c ?? 0,
          market_p: e.market_p,
        });
      }
    }
    return { source: "fda-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "fda-edges", signals: [] };
  }
}

// V0.72 · 拉 weather 信号 (NWS + Open-Meteo)
async function pullWeatherSignals(): Promise<SignalSourceResult> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/weather-edges`, { cache: "no-store" }).then(
      (r) => r.json()
    );
    if (!r.ok) return { source: "weather-edges", signals: [] };
    const md = new Map<string, { vol_24: number; spread_c: number; market_p: number }>();
    for (const e of r.edges ?? []) {
      md.set(e.ticker, { vol_24: e.vol_24, spread_c: e.spread_c, market_p: e.market_p });
    }
    return { source: "weather-edges", signals: (r.signals ?? []) as Signal[], market_data: md };
  } catch {
    return { source: "weather-edges", signals: [] };
  }
}

interface FusionRunResult {
  ticker: string;
  fusion: ReturnType<typeof fuse>;
  decision: ReturnType<typeof decide>;
  bucket: "stable" | "convex";
  acted: boolean;
  reason: string;
}

// 信号源 → 桶映射
function bucketFor(sources: string[]): "stable" | "convex" {
  // BS / 跨期限 / 跨平台 / 期货 / 天气 → 稳赚
  // 稳赚 (S 池) · 数学背书 / 跨平台 / 公允价
  const stableSources = new Set([
    "btc-bs",
    "btc-cross-tenor",
    "btc-cross-platform",
    "eth-bs",
    "eth-cross-tenor",
    "eth-cross-platform",
    "sol-bs",
    "sol-cross-tenor",
    "sol-cross-platform",
    "fed-futures",
    "weather-nws",
    "weather-meteo",
    "earnings-consensus",
    "contrarian",            // 反公众 · 全品类共用 · 进 stable (低 conf 但稳)
    "nba-elo",               // NBA Elo
    "fed-cross-platform",    // 经济跨平台
    // V0.72 W3 Day 9 · ML 自训模型 · 进 stable (有数据训 · 数学背书)
    "ml-btc", "ml-eth", "ml-sol", "ml-weather", "ml-nba", "ml-fed", "ml-fda", "ml-other",
  ]);
  // 凸性 (C 池) · 高 EV 但低 hit · 长尾押注
  // fda-adcom / phase3 / mention-engine / yn-signals / breaking-news 都进 convex
  const allStable = sources.every((s) => stableSources.has(s));
  return allStable ? "stable" : "convex";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("cron") === "1";
  if (isCron) {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.headers.get("authorization") ?? "";
      if (got !== `Bearer ${expected}`) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }
  }

  // 0. 检 pools 已初始化
  const pools = readPools();
  if (!pools) {
    return NextResponse.json({
      ok: false,
      error: "pools not initialized · run /pools_init first",
    });
  }

  // 0.5 检熔断
  checkRealtimeCircuit();
  if (pools.circuit_state === "paused_all" || pools.circuit_state === "red_line") {
    return NextResponse.json({
      ok: true,
      paused: true,
      circuit: pools.circuit_state,
      reason: pools.circuit_reason,
      decisions: [],
    });
  }

  // 1. 拉所有信号源 · 并行
  const sources = await Promise.all([
    pullBtcSignals(),
    pullEthSignals(),
    pullSolSignals(),
    pullWeatherSignals(),
    pullFdaSignals(),
    pullMentionSignals(),
    pullContrarianSignals(),
    pullNbaSignals(),
    pullFedSignals(),
  ]);

  // 1.5 加载当前权重 (Brier 自适应过的)
  const weights = loadWeights();
  const allSignals: Signal[] = sources.flatMap((s) => s.signals);
  const allMarketData = new Map<
    string,
    { vol_24: number; spread_c: number; market_p: number }
  >();
  for (const s of sources) {
    if (!s.market_data) continue;
    for (const [k, v] of s.market_data) allMarketData.set(k, v);
  }

  // 2. 按 ticker 聚合
  const byTicker = new Map<string, Signal[]>();
  for (const s of allSignals) {
    const arr = byTicker.get(s.ticker) ?? [];
    arr.push(s);
    byTicker.set(s.ticker, arr);
  }

  // 2.5 V0.72 W3 fix · 单源 ticker 强制补 contrarian (最后一搏 n_active=2)
  // 对每个仅 1 signal 的 ticker · 直接拉 trades feed · 计 skew · 出 contrarian
  // V0.72 W3 Day 12 修 · 限 ≤ 10 个 · 防 contrarian 64% 主导 · 保多样性
  const singleSigTickers = Array.from(byTicker.entries()).filter(([, sigs]) => sigs.length === 1);
  const TARGET_TICKERS = singleSigTickers.slice(0, 10).map(([t]) => t);
  await Promise.all(
    TARGET_TICKERS.map(async (ticker) => {
      try {
        const r = await fetch(
          `https://api.elections.kalshi.com/trade-api/v2/markets/trades?ticker=${ticker}&limit=100`,
          { cache: "no-store", signal: AbortSignal.timeout(5000) }
        );
        if (!r.ok) return;
        const d = await r.json();
        const trades = (d.trades ?? []) as Array<{ taker_side?: string; count_fp?: string }>;
        let yesSize = 0, noSize = 0;
        for (const t of trades) {
          const cnt = parseFloat(t.count_fp || "0");
          if (cnt <= 0) continue;
          if (t.taker_side === "yes") yesSize += cnt;
          else if (t.taker_side === "no") noSize += cnt;
        }
        const total = yesSize + noSize;
        if (total < 5) return;
        const skew_pct = yesSize / total;
        if (skew_pct >= 0.42 && skew_pct <= 0.58) return;          // 中性 · 不出
        const direction: 1 | -1 = skew_pct >= 0.58 ? -1 : 1;
        const md = allMarketData.get(ticker);
        if (!md) return;
        const fair_p = direction === 1
          ? Math.min(0.95, md.market_p + 0.03)
          : Math.max(0.05, md.market_p - 0.03);
        byTicker.get(ticker)!.push({
          source: "contrarian",
          ticker,
          direction,
          predicted_p: fair_p,
          confidence: 0.53,
          reason: `inline contrarian · skew ${(skew_pct * 100).toFixed(0)}% · ${total.toFixed(0)} 张`,
          ts: new Date().toISOString(),
          data: { skew_pct, yes_size: yesSize, no_size: noSize },
        });
      } catch {}
    })
  );

  const total = pools.S.balance + pools.C.balance + pools.P0; // for drawdown calc
  const peak = Math.max(pools.S.peak, pools.S.balance);
  const drawdown = peak > 0 ? (peak - pools.S.balance) / peak : 0;

  const bankrollMap = { stable: pools.S.balance, convex: pools.C.balance };

  // 3. 对每 ticker 走 fuse + decide
  const results: FusionRunResult[] = [];
  for (const [ticker, signals] of byTicker) {
    const md = allMarketData.get(ticker);
    if (!md) continue;

    // V0.72 W3 Day 9 · ML 预测 · 若该板块有训好的模型 · 加 ml-{board} 信号
    const board = inferBoard(ticker);
    const mlPred = predictML({
      ts: new Date().toISOString(),
      ticker,
      bucket: bucketFor(signals.map((s) => s.source)),
      side: "yes",
      signals_active: signals.map((s) => s.source),
      predicted_p: signals[0]?.predicted_p ?? md.market_p,
      fusion_p: signals[0]?.predicted_p ?? md.market_p,
      market_implied_p: md.market_p,
      edge_pp: ((signals[0]?.predicted_p ?? md.market_p) - md.market_p) * 100,
      n_active: signals.length,
      stake: 1,
      qty: 1,
      entry_c: Math.round(md.market_p * 100),
    });
    if (mlPred.has_model && mlPred.ml_p !== null && mlPred.brier_val !== null) {
      const mlEdge = mlPred.ml_p - md.market_p;
      if (Math.abs(mlEdge) >= 0.03) {
        // ML conf · 从 brier_val 反推 (越低越准)
        // brier 0.20 → conf 0.65 · 0.25 → 0.55
        const conf = Math.max(0.51, Math.min(0.85, 0.85 - mlPred.brier_val * 1.2));
        signals.push({
          source: `ml-${board}`,
          ticker,
          direction: mlEdge >= 0 ? 1 : -1,
          predicted_p: mlPred.ml_p,
          confidence: conf,
          reason: `ML logreg ${board} · n=${mlPred.n_train} · val_brier=${mlPred.brier_val.toFixed(3)} · ml_p=${(mlPred.ml_p * 100).toFixed(1)}%`,
          ts: new Date().toISOString(),
          data: { board, val_brier: mlPred.brier_val },
        });
      }
    }

    const sourcesArr = signals.map((s) => s.source);
    const bucket = bucketFor(sourcesArr);

    const fusion = fuse({
      ticker,
      market_implied_p: md.market_p,
      signals,
      signal_weights: weights,             // V0.72 · Brier 自适应
    });

    const decision = decide({
      fusion,
      vol_24: md.vol_24,
      spread_c: md.spread_c,
      bankroll: bankrollMap[bucket],
      current_drawdown_pct: drawdown,
      bucket,
    });

    if (!decision.act) {
      results.push({ ticker, fusion, decision, bucket, acted: false, reason: decision.reason });
      continue;
    }

    // 4. 扣池 + 写 lesson · 只在 paused_C 不影响 stable 桶时
    if (bucket === "convex" && pools.circuit_state === "paused_C") {
      results.push({
        ticker,
        fusion,
        decision,
        bucket,
        acted: false,
        reason: "C paused (drawdown)",
      });
      continue;
    }

    const debit = debitFromPool(bucket === "stable" ? "S" : "C", decision.stake_usd);
    if (!debit.ok) {
      results.push({
        ticker,
        fusion,
        decision,
        bucket,
        acted: false,
        reason: `debit failed · ${debit.reason}`,
      });
      continue;
    }

    appendLesson({
      ts: new Date().toISOString(),
      ticker,
      bucket,
      side: fusion.side === 1 ? "yes" : "no",
      signals_active: sourcesArr,
      predicted_p: fusion.p_consensus,
      fusion_p: fusion.p_consensus,
      market_implied_p: md.market_p,
      edge_pp: fusion.edge_pp,
      n_active: fusion.n_active,
      stake: decision.stake_usd,
      qty: decision.qty,
      entry_c: Math.round(
        (fusion.side === 1 ? md.market_p : 1 - md.market_p) * 100
      ),
      reason: signals.map((s) => s.reason).join(" || ").slice(0, 300),
      source: sourcesArr.join("+"),
    });

    results.push({ ticker, fusion, decision, bucket, acted: true, reason: "paper trade placed" });
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      total_signals: allSignals.length,
      tickers_with_signals: byTicker.size,
      multi_signal_tickers: Array.from(byTicker.values()).filter((s) => s.length >= 2).length,
      acted: results.filter((r) => r.acted).length,
      stable_acted: results.filter((r) => r.acted && r.bucket === "stable").length,
      convex_acted: results.filter((r) => r.acted && r.bucket === "convex").length,
    },
    decisions: results.slice(0, 20),
  });
}
