// /api/xiapan/mind/today
//
// 接 OpenClaw 共享意识池 ~/.openclaw/mind/
// du4leaving 顶部能看到老虾今天写的 briefing
//
// 文件结构 ·
//   ~/.openclaw/mind/daily/YYYY-MM-DD.md  · 老虾每日报
//   ~/.openclaw/mind/about-tz.md          · TZ 是谁 (背景)
//
// 行为 · 优先返回今天的 daily · 没今天就返回最近一天 + stale 标记
// 摘要 · 取 ## 主题 + 前 N 字 · 不全文塞 (TOK 省)
//
// localhost-only · 生产没这文件夹 · 优雅 fallback

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

interface MindResponse {
  ok: boolean;
  available: boolean;          // ~/.openclaw/mind/ 存在嘛
  today_exists: boolean;       // 今天的 daily 存在嘛
  date?: string;               // 实际取的日期 (今 / 最近)
  is_stale?: boolean;          // 取的不是今天
  title?: string;              // # 一级标题
  summary?: string;            // 摘要 (各 ## 段前 1 句)
  full_md?: string;            // 全文 (前 4000 字符 · 控大小)
  daily_count?: number;        // mind/daily/ 总文件数
  error?: string;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function summarize(md: string): { title: string; summary: string } {
  // 拿 # 开头的第一行作 title
  const lines = md.split("\n");
  let title = "";
  for (const ln of lines) {
    const m = ln.match(/^#\s+(.+)$/);
    if (m) {
      title = m[1].trim();
      break;
    }
  }

  // 摘要 · 抓 ## 段标题 + 各段第一行非空
  const sections: string[] = [];
  let curHeading: string | null = null;
  let captured = false;
  for (const ln of lines) {
    const h2 = ln.match(/^##\s+(.+)$/);
    if (h2) {
      curHeading = h2[1].trim();
      captured = false;
      continue;
    }
    if (curHeading && !captured) {
      const t = ln.trim();
      if (!t) continue;
      // 跳过 ### 子标题 · 取真正第一句正文
      if (t.startsWith("#")) continue;
      const oneLine = t.replace(/[*_`]/g, "").slice(0, 80);
      sections.push(`· ${curHeading} · ${oneLine}`);
      captured = true;
    }
    if (sections.length >= 5) break;
  }

  return {
    title,
    summary: sections.join("\n"),
  };
}

export async function GET(_req: Request) {
  const home = os.homedir();
  const mindDir = path.join(home, ".openclaw", "mind");
  const dailyDir = path.join(mindDir, "daily");

  // 检查根目录
  if (!fs.existsSync(mindDir)) {
    return NextResponse.json<MindResponse>({
      ok: true,
      available: false,
      today_exists: false,
    });
  }

  let dailyFiles: string[] = [];
  if (fs.existsSync(dailyDir)) {
    try {
      dailyFiles = fs
        .readdirSync(dailyDir)
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort();
    } catch {}
  }

  if (dailyFiles.length === 0) {
    return NextResponse.json<MindResponse>({
      ok: true,
      available: true,
      today_exists: false,
      daily_count: 0,
    });
  }

  const today = ymd(new Date());
  const todayFile = `${today}.md`;
  let chosenFile: string;
  let isStale = false;

  if (dailyFiles.includes(todayFile)) {
    chosenFile = todayFile;
  } else {
    // 取最近的
    chosenFile = dailyFiles[dailyFiles.length - 1];
    isStale = true;
  }

  try {
    const fullPath = path.join(dailyDir, chosenFile);
    const md = fs.readFileSync(fullPath, "utf8");
    const { title, summary } = summarize(md);
    return NextResponse.json<MindResponse>({
      ok: true,
      available: true,
      today_exists: !isStale,
      date: chosenFile.replace(".md", ""),
      is_stale: isStale,
      title: title || `${chosenFile.replace(".md", "")} 老虾日报`,
      summary,
      full_md: md.slice(0, 4000),
      daily_count: dailyFiles.length,
    });
  } catch (e) {
    return NextResponse.json<MindResponse>({
      ok: false,
      available: true,
      today_exists: false,
      error: (e as Error).message,
    });
  }
}
