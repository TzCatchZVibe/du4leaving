// /api/xiapan/mind/append
//
// V0.43 · OpenClaw Week 2 · du4 settle → 写 mind/daily
//
// du4 端每次 LessonStore 同步出新结算 → POST 这里
// 我们把摘要 append 到 ~/.openclaw/mind/daily/YYYY-MM-DD.md
// 这样 8 虾隔天能引用昨天的押单做铺垫
//
// 安全 · localhost-only (生产没 mind 文件夹) · 只 append · 不删
// 标记节 · "## du4 战报 · YYYY-MM-DD HH:MM" 防重复

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

interface AppendBody {
  section_title?: string;        // 默认 "du4 战报"
  content_md: string;            // 已格式化好的 markdown 内容
  dedupe_key?: string;           // 可选 · 同 key 1h 内不重复 append
}

const APPEND_LOG: Map<string, number> = new Map();   // dedupe_key → ts
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;             // 1h

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hm(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${mn}`;
}

export async function POST(req: Request) {
  const home = os.homedir();
  const mindDir = path.join(home, ".openclaw", "mind");
  const dailyDir = path.join(mindDir, "daily");

  if (!fs.existsSync(mindDir)) {
    return NextResponse.json({ ok: false, available: false, error: "~/.openclaw/mind not found" });
  }

  let body: AppendBody;
  try {
    body = (await req.json()) as AppendBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (!body.content_md || body.content_md.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "content_md required" }, { status: 400 });
  }

  // dedupe
  if (body.dedupe_key) {
    const last = APPEND_LOG.get(body.dedupe_key);
    if (last && Date.now() - last < DEDUPE_WINDOW_MS) {
      return NextResponse.json({
        ok: true,
        deduped: true,
        message: "skipped · 1h 内已 append 过同 key",
      });
    }
  }

  // 确保 daily/ 存在
  if (!fs.existsSync(dailyDir)) {
    try { fs.mkdirSync(dailyDir, { recursive: true }); }
    catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
  }

  const today = new Date();
  const fileName = `${ymd(today)}.md`;
  const filePath = path.join(dailyDir, fileName);

  const sectionTitle = (body.section_title ?? "du4 战报").trim();
  const heading = `\n\n## ${sectionTitle} · ${ymd(today)} ${hm(today)}\n\n`;
  const fullBlock = heading + body.content_md.trim() + "\n";

  try {
    if (!fs.existsSync(filePath)) {
      // 首次创建当日 · 加文件级标题
      const fileHeader = `# 老虾日报 · ${ymd(today)}\n`;
      fs.writeFileSync(filePath, fileHeader + fullBlock, "utf8");
    } else {
      fs.appendFileSync(filePath, fullBlock, "utf8");
    }
    if (body.dedupe_key) APPEND_LOG.set(body.dedupe_key, Date.now());
    return NextResponse.json({
      ok: true,
      file: fileName,
      bytes_added: fullBlock.length,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
