// /api/xiapan/intel/whale-diff
//
// V0.63 · 大户钱包变动 · 跟踪 top 钱包持仓 · 跑出 diff
// 触发 · 每跑 GET · 比上一次快照 · 写新仓 / 翻仓 / 平仓
//
// 持仓变动 = smart money 真信号 · 比 24h 大单流更准

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

const HOME = os.homedir();
const SNAP_DIR = path.join(HOME, ".du4leaving", "whale-snapshots");

interface WhalePosSnapshot {
  market: string;
  outcome: string;
  size: number;
  cur_price: number;
  current_value: number;
}

interface WhaleSnapshot {
  ts: string;
  whales: Record<string, {
    display_name: string;
    positions: Record<string, WhalePosSnapshot>;     // market+outcome → pos
  }>;
}

interface PositionDiff {
  wallet: string;
  display_name: string;
  market: string;
  outcome: string;
  kind: "new" | "scaled_up" | "scaled_down" | "closed";
  size_delta: number;
  size_before: number;
  size_after: number;
  value_now: number;
  cur_price: number;
}

function ensureSnapDir() {
  if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });
}

function readLatestSnapshot(): WhaleSnapshot | null {
  if (!fs.existsSync(SNAP_DIR)) return null;
  try {
    const files = fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith(".json")).sort();
    if (files.length === 0) return null;
    const f = files[files.length - 1];
    return JSON.parse(fs.readFileSync(path.join(SNAP_DIR, f), "utf8")) as WhaleSnapshot;
  } catch {
    return null;
  }
}

function writeSnapshot(snap: WhaleSnapshot): void {
  ensureSnapDir();
  const fname = snap.ts.replace(/[:.]/g, "-") + ".json";
  fs.writeFileSync(path.join(SNAP_DIR, fname), JSON.stringify(snap, null, 2), "utf8");
  // 只留最近 50 个 snapshot · 减磁盘
  try {
    const files = fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith(".json")).sort();
    if (files.length > 50) {
      for (const f of files.slice(0, files.length - 50)) {
        fs.unlinkSync(path.join(SNAP_DIR, f));
      }
    }
  } catch {}
}

interface WhaleApiEntry {
  wallet: string;
  display_name: string;
  top_positions: Array<{
    market: string;
    outcome: string;
    size: number;
    cur_price: number;
    current_value: number;
  }>;
}

interface WhalesApiResp {
  ok: boolean;
  whales?: WhaleApiEntry[];
}

async function fetchTopWhales(): Promise<WhaleApiEntry[]> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/intel/whales-top?limit=8`, { cache: "no-store" });
    if (!r.ok) return [];
    const d = (await r.json()) as WhalesApiResp;
    return d.whales ?? [];
  } catch {
    return [];
  }
}

function buildSnapshot(whales: WhaleApiEntry[]): WhaleSnapshot {
  const out: WhaleSnapshot = {
    ts: new Date().toISOString(),
    whales: {},
  };
  for (const w of whales) {
    const positions: Record<string, WhalePosSnapshot> = {};
    for (const p of w.top_positions ?? []) {
      const k = `${p.market}|${p.outcome}`;
      positions[k] = {
        market: p.market,
        outcome: p.outcome,
        size: p.size,
        cur_price: p.cur_price,
        current_value: p.current_value,
      };
    }
    out.whales[w.wallet] = {
      display_name: w.display_name,
      positions,
    };
  }
  return out;
}

function computeDiff(prev: WhaleSnapshot | null, cur: WhaleSnapshot): PositionDiff[] {
  if (!prev) return [];          // 首次 · 无 diff
  const out: PositionDiff[] = [];

  for (const wallet of Object.keys(cur.whales)) {
    const curW = cur.whales[wallet];
    const prevW = prev.whales[wallet];
    const prevPositions = prevW?.positions ?? {};
    const curPositions = curW.positions;

    // 新仓 / 加仓 / 减仓
    for (const k of Object.keys(curPositions)) {
      const p = curPositions[k];
      const prevP = prevPositions[k];
      const sizeBefore = prevP?.size ?? 0;
      const sizeDelta = p.size - sizeBefore;
      if (Math.abs(sizeDelta) < 1) continue;     // 太小忽略

      let kind: PositionDiff["kind"];
      if (sizeBefore === 0) kind = "new";
      else if (sizeDelta > 0) kind = "scaled_up";
      else kind = "scaled_down";

      out.push({
        wallet,
        display_name: curW.display_name,
        market: p.market,
        outcome: p.outcome,
        kind,
        size_delta: sizeDelta,
        size_before: sizeBefore,
        size_after: p.size,
        value_now: p.current_value,
        cur_price: p.cur_price,
      });
    }

    // 平仓
    for (const k of Object.keys(prevPositions)) {
      if (curPositions[k]) continue;
      const p = prevPositions[k];
      out.push({
        wallet,
        display_name: curW.display_name,
        market: p.market,
        outcome: p.outcome,
        kind: "closed",
        size_delta: -p.size,
        size_before: p.size,
        size_after: 0,
        value_now: 0,
        cur_price: p.cur_price,
      });
    }
  }

  // 排序 · value_now 降 (大动作前)
  out.sort((a, b) => Math.max(b.value_now, b.size_before * b.cur_price) - Math.max(a.value_now, a.size_before * a.cur_price));
  return out;
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

  try {
    const whales = await fetchTopWhales();
    if (whales.length === 0) {
      return NextResponse.json({ ok: false, error: "no whales data" }, { status: 200 });
    }

    const prev = readLatestSnapshot();
    const cur = buildSnapshot(whales);
    writeSnapshot(cur);

    const diffs = computeDiff(prev, cur);
    const counts = {
      new: diffs.filter((d) => d.kind === "new").length,
      scaled_up: diffs.filter((d) => d.kind === "scaled_up").length,
      scaled_down: diffs.filter((d) => d.kind === "scaled_down").length,
      closed: diffs.filter((d) => d.kind === "closed").length,
    };

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        ...counts,
        total: diffs.length,
        prev_snapshot_ts: prev?.ts ?? null,
        wallets_tracked: Object.keys(cur.whales).length,
      },
      diffs: diffs.slice(0, 30),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
