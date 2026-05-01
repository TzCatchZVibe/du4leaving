// /api/xiapan/mac-mini-status
// V0.69 · Mac mini 系统状态 + Hermes 推理速度
// 给 native 看 · 别家 prediction-market app 都没

import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface MacStatus {
  ok: boolean;
  hostname: string;
  uptime_minutes: number;
  cpu_pct: number;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_pct: number;
  disk_used_pct: number;
  ollama_running: boolean;
  hermes_loaded: boolean;
  last_inference_ms?: number;          // 试跑一句拿耗时
  agent_logs: {
    next_dev_running: boolean;
    cron_running: boolean;
    next_dev_last_log?: string;
    cron_last_log?: string;
  };
  error?: string;
}

async function safe(cmd: string, fallback = ""): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim();
  } catch { return fallback; }
}

async function probeHermes(): Promise<{ loaded: boolean; ms?: number }> {
  try {
    const t0 = Date.now();
    const r = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.HERMES_MODEL || "hermes3:8b",
        prompt: "ok",
        stream: false,
        options: { num_predict: 5 },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { loaded: false };
    await r.json();
    return { loaded: true, ms: Date.now() - t0 };
  } catch {
    return { loaded: false };
  }
}

export async function GET() {
  try {
    const hostname = os.hostname();
    const uptime_minutes = Math.round(os.uptime() / 60);

    // CPU · iostat or top
    const cpuRaw = await safe(`top -l 1 -n 0 | grep "CPU usage"`);
    const cpuMatch = cpuRaw.match(/(\d+\.\d+)% user/);
    const cpu_pct = cpuMatch ? parseFloat(cpuMatch[1]) : 0;

    // RAM
    const total_bytes = os.totalmem();
    const free_bytes = os.freemem();
    const used_bytes = total_bytes - free_bytes;
    const ram_total_gb = Number((total_bytes / 1e9).toFixed(1));
    const ram_used_gb = Number((used_bytes / 1e9).toFixed(1));
    const ram_pct = Math.round((used_bytes / total_bytes) * 100);

    // Disk · df
    const dfOut = await safe(`df -h / | tail -1`);
    const dfMatch = dfOut.match(/(\d+)%/);
    const disk_used_pct = dfMatch ? parseInt(dfMatch[1], 10) : 0;

    // Ollama 在跑嘛
    const ollamaPing = await safe(`curl -s --max-time 2 http://localhost:11434/api/version`);
    const ollama_running = ollamaPing.includes("version");

    // Hermes 探测 (异步 · 不阻塞太久)
    const hermes = ollama_running ? await probeHermes() : { loaded: false };

    // launchd 服务
    const launchctlNext = await safe(`launchctl list 2>&1 | grep "tz.du4.next-dev" | head -1`);
    const launchctlCron = await safe(`launchctl list 2>&1 | grep "tz.du4.cron" | head -1`);
    const next_dev_running = launchctlNext.includes("tz.du4.next-dev");
    const cron_running = launchctlCron.includes("tz.du4.cron");

    // 日志最后一行
    const next_dev_last_log = await safe(`tail -1 /tmp/du4-next.log 2>/dev/null`);
    const cron_last_log = await safe(`tail -1 /tmp/du4-cron.log 2>/dev/null`);

    const out: MacStatus = {
      ok: true,
      hostname,
      uptime_minutes,
      cpu_pct,
      ram_used_gb,
      ram_total_gb,
      ram_pct,
      disk_used_pct,
      ollama_running,
      hermes_loaded: hermes.loaded,
      last_inference_ms: hermes.ms,
      agent_logs: {
        next_dev_running,
        cron_running,
        next_dev_last_log: next_dev_last_log.slice(0, 200),
        cron_last_log: cron_last_log.slice(0, 200),
      },
    };

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      hostname: os.hostname(),
      uptime_minutes: 0,
      cpu_pct: 0,
      ram_used_gb: 0,
      ram_total_gb: 0,
      ram_pct: 0,
      disk_used_pct: 0,
      ollama_running: false,
      hermes_loaded: false,
      agent_logs: { next_dev_running: false, cron_running: false },
      error: (e as Error).message,
    }, { status: 200 });
  }
}
