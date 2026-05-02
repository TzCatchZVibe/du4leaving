// /api/xiapan/百川/health
//
// V0.72 · W1 Day 7 · 百川全链路健康检查
// 自检每个组件 · 出红绿表 · push Telegram 异常
//
// 检查项 ·
//   1. pools.json 存在 + P0 健康
//   2. lessons.jsonl 路径 + 行数 + 已结算 ratio
//   3. weights.json 存在 + 权重列表
//   4. 信号源 (btc-edges / weather-edges) 跑通
//   5. fusion.ts 数学校验 (sanity)
//   6. drawdown / 熔断状态
//   7. lifetime 指标 (cashout / reinvest)

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readPools } from "@/lib/xiapan/百川/pools";
import { readAllLessons, brierBySource } from "@/lib/xiapan/百川/lessons";
import { loadWeights } from "@/lib/xiapan/百川/weights";
import { fuse } from "@/lib/xiapan/百川/fusion";

export const dynamic = "force-dynamic";

const HOME = os.homedir();

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

const baseURL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3001";

async function pingEndpoint(path: string, timeoutMs = 8000): Promise<{ ok: boolean; latency: number; detail: string }> {
  const start = Date.now();
  try {
    const r = await fetch(`${baseURL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latency = Date.now() - start;
    if (!r.ok) return { ok: false, latency, detail: `HTTP ${r.status}` };
    const d = await r.json();
    return { ok: d.ok !== false, latency, detail: JSON.stringify(d.summary ?? d).slice(0, 120) };
  } catch (e) {
    return { ok: false, latency: Date.now() - start, detail: (e as Error).message };
  }
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

  const checks: CheckResult[] = [];

  // 1. pools
  const pools = readPools();
  if (!pools) {
    checks.push({ name: "pools", status: "fail", detail: "未初始化 · /pools_init <P0>" });
  } else {
    const total = pools.S.balance + pools.C.balance;
    const ratio = total / pools.P0;
    const status: CheckResult["status"] =
      pools.circuit_state === "red_line" ? "fail" :
      pools.circuit_state !== "running" ? "warn" :
      ratio < 0.95 ? "warn" : "ok";
    checks.push({
      name: "pools",
      status,
      detail: `P0=$${pools.P0} · S=$${pools.S.balance.toFixed(2)} · C=$${pools.C.balance.toFixed(2)} · circuit=${pools.circuit_state}`,
    });
  }

  // 2. lessons.jsonl
  const lessons = readAllLessons();
  const closed = lessons.filter(l => l.actual !== undefined && l.actual !== null);
  if (lessons.length === 0) {
    checks.push({ name: "lessons", status: "warn", detail: "0 lessons · 信号还没下过单 (W1 期正常)" });
  } else {
    const wins = closed.filter(l => l.actual === 1).length;
    const wr = closed.length > 0 ? wins / closed.length : 0;
    const totalPnL = closed.reduce((s, l) => s + (l.pnl ?? 0), 0);
    checks.push({
      name: "lessons",
      status: "ok",
      detail: `${lessons.length} 总 · ${closed.length} 已平 · wr ${(wr * 100).toFixed(0)}% · PnL $${totalPnL.toFixed(2)}`,
    });
  }

  // 3. weights.json
  try {
    const weightsPath = path.join(HOME, ".du4leaving", "百川", "weights.json");
    const exists = fs.existsSync(weightsPath);
    const weights = loadWeights();
    const sources = Object.keys(weights).length;
    checks.push({
      name: "weights",
      status: exists ? "ok" : "warn",
      detail: exists ? `${sources} sources · ${Object.entries(weights).map(([s, w]) => `${s}:${w.toFixed(1)}`).join(" ")}`
                     : `默认权重 (${sources} sources) · 未跑过 brier`,
    });
  } catch (e) {
    checks.push({ name: "weights", status: "fail", detail: (e as Error).message });
  }

  // 4. 信号源 ping (并行)
  const [btcRes, weatherRes, runRes] = await Promise.all([
    pingEndpoint("/api/xiapan/btc-edges", 12000),
    pingEndpoint("/api/xiapan/weather-edges", 25000),
    pingEndpoint("/api/xiapan/百川/run"),
  ]);
  checks.push({
    name: "btc-edges",
    status: btcRes.ok ? (btcRes.latency > 8000 ? "warn" : "ok") : "fail",
    detail: `${btcRes.latency}ms · ${btcRes.detail}`,
  });
  checks.push({
    name: "weather-edges",
    status: weatherRes.ok ? (weatherRes.latency > 20000 ? "warn" : "ok") : "fail",
    detail: `${weatherRes.latency}ms · ${weatherRes.detail}`,
  });
  checks.push({
    name: "百川/run",
    status: runRes.ok ? "ok" : "fail",
    detail: `${runRes.latency}ms · ${runRes.detail}`,
  });

  // 5. fusion 数学校验 (sanity)
  try {
    const test = fuse({
      ticker: "TEST",
      market_implied_p: 0.5,
      signals: [
        {
          source: "test-1", ticker: "TEST", direction: 1, predicted_p: 0.6,
          confidence: 0.6, reason: "sanity", ts: new Date().toISOString(),
        },
        {
          source: "test-2", ticker: "TEST", direction: 1, predicted_p: 0.65,
          confidence: 0.55, reason: "sanity", ts: new Date().toISOString(),
        },
      ],
    });
    const ok = test.p_consensus > 0.5 && test.edge_pp > 0 && test.n_active === 2;
    checks.push({
      name: "fusion",
      status: ok ? "ok" : "fail",
      detail: `p=${test.p_consensus.toFixed(3)} · edge=${test.edge_pp.toFixed(1)}pp · n=${test.n_active}`,
    });
  } catch (e) {
    checks.push({ name: "fusion", status: "fail", detail: (e as Error).message });
  }

  // 6. brier 数据 (如果有)
  if (closed.length >= 5) {
    try {
      const brier = brierBySource(closed);
      const summary = Object.entries(brier).map(([src, b]) => `${src}=${b.brier.toFixed(2)}(${b.n})`).join(" · ");
      checks.push({
        name: "brier",
        status: "ok",
        detail: summary || "no source data",
      });
    } catch (e) {
      checks.push({ name: "brier", status: "warn", detail: (e as Error).message });
    }
  }

  // 总评
  const failCount = checks.filter(c => c.status === "fail").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const overall: "ok" | "warn" | "fail" = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "ok";

  // V0.72 · cron 模式 · 仅当有 fail 才 push Telegram
  if (isCron && failCount > 0) {
    try {
      const tg = await import("@/lib/xiapan/telegram");
      if (tg.tgEnabled()) {
        const lines = [`⚠ 百川健康异常 · ${failCount} fail · ${warnCount} warn`, ``];
        for (const c of checks.filter(x => x.status !== "ok")) {
          const icon = c.status === "fail" ? "✗" : "△";
          lines.push(`${icon} ${c.name}: ${c.detail.slice(0, 100)}`);
        }
        await tg.sendTelegramMessage(lines.join("\n"), { parseMode: undefined });
      }
    } catch {}
  }

  return NextResponse.json({
    ok: failCount === 0,
    overall,
    checks,
    summary: {
      ok: checks.filter(c => c.status === "ok").length,
      warn: warnCount,
      fail: failCount,
    },
    generatedAt: new Date().toISOString(),
  });
}
