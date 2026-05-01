// /api/xiapan/agents/cron · GET handler for cron-style triggers
//
// V0.56 · Vercel Cron (生产) · GET ?slug=laohu 即触发
// 本地 watcher 用 POST · 这个走 GET 给 Vercel 用

import { NextResponse } from "next/server";
import { findAgent } from "@/lib/xiapan/hermes-agents/agents";
import { runAgent } from "@/lib/xiapan/hermes-agents/agent-base";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const def = findAgent(slug);
  if (!def) {
    return NextResponse.json({ ok: false, error: `unknown agent: ${slug}` }, { status: 404 });
  }
  // 简单 secret 验证 (Vercel Cron 可加 header / token)
  // 生产应启 · 防 abuse
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const got = req.headers.get("authorization") ?? "";
    if (got !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await runAgent(def.identity, def.contextBuilder);
  return NextResponse.json({ ok: !result.error, result });
}
