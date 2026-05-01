// /api/xiapan/agents/daily?slug=laohu
// V0.70 · 拉某 agent 今天 + 昨天的 daily 日报
// 给 native overview 卡看老虎当前最新简报

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readLatestOutputs } from "@/lib/xiapan/hermes-agents/agent-base";

export const dynamic = "force-dynamic";

const HOME = os.homedir();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "laohu").trim();
  const limit = Math.min(10, parseInt(url.searchParams.get("limit") ?? "3", 10));

  const dailyDir = path.join(HOME, ".du4leaving", "agents", slug, "daily");
  const today = new Date().toISOString().slice(0, 10);

  // 拿最近 N 个输出 (从 daily/ 解 ## 段)
  const recent = readLatestOutputs(slug, limit);

  // 今天的全文
  let today_full_md: string | null = null;
  const todayFile = path.join(dailyDir, `${today}.md`);
  if (fs.existsSync(todayFile)) {
    try {
      today_full_md = fs.readFileSync(todayFile, "utf8").slice(0, 8000);
    } catch {}
  }

  // bet-log (老虎专属 · 给沉淀链路看)
  let bet_log_count = 0;
  if (slug === "laohu") {
    const logFile = path.join(HOME, ".du4leaving", "agents", "laohu", "bet-log.jsonl");
    if (fs.existsSync(logFile)) {
      try {
        bet_log_count = fs.readFileSync(logFile, "utf8").split("\n").filter(Boolean).length;
      } catch {}
    }
  }

  return NextResponse.json({
    ok: true,
    slug,
    date: today,
    recent_outputs: recent,
    today_full_md,
    bet_log_count: slug === "laohu" ? bet_log_count : undefined,
  });
}
