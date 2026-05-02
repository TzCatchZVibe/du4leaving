// /api/xiapan/百川/run
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
  const stableSources = new Set([
    "btc-bs",
    "btc-cross-tenor",
    "btc-cross-platform",
    "fed-futures",
    "weather-nws",
    "weather-meteo",
    "earnings-consensus",
    "fda-adcom",
  ]);
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
  const sources = await Promise.all([pullBtcSignals(), pullWeatherSignals()]);
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

  const total = pools.S.balance + pools.C.balance + pools.P0; // for drawdown calc
  const peak = Math.max(pools.S.peak, pools.S.balance);
  const drawdown = peak > 0 ? (peak - pools.S.balance) / peak : 0;

  const bankrollMap = { stable: pools.S.balance, convex: pools.C.balance };

  // 3. 对每 ticker 走 fuse + decide
  const results: FusionRunResult[] = [];
  for (const [ticker, signals] of byTicker) {
    const md = allMarketData.get(ticker);
    if (!md) continue;
    const sourcesArr = signals.map((s) => s.source);
    const bucket = bucketFor(sourcesArr);

    const fusion = fuse({
      ticker,
      market_implied_p: md.market_p,
      signals,
      // signal_weights · 默认 1.0 · 后续 Brier 调
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
