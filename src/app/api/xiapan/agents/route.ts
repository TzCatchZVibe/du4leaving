// /api/xiapan/agents
//
// V0.55 · Hermes agent runtime
// GET    · 列所有 agent + 每个最近输出
// POST   · 触发某 agent 跑一次 (body: { slug })

import { NextResponse } from "next/server";
import { ALL_AGENTS, findAgent } from "@/lib/xiapan/hermes-agents/agents";
import { runAgent, readLatestOutputs, inboxCount, loadCron, skillCount } from "@/lib/xiapan/hermes-agents/agent-base";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const out = ALL_AGENTS.map(({ identity }) => {
    const cron = loadCron(identity.slug);
    return {
      name: identity.name,
      slug: identity.slug,
      role: identity.role,
      emoji: identity.emoji,
      cron: identity.cron,
      tools: identity.tools,
      recent_outputs: readLatestOutputs(identity.slug, 3),
      inbox_count: inboxCount(identity.slug),       // V0.57
      skill_count: skillCount(identity.slug),       // V0.58
      enabled: cron.enabled,
      last_run: cron.last_run,
    };
  });
  return NextResponse.json({
    ok: true,
    agents: out,
    count: out.length,
  });
}

export async function POST(req: Request) {
  let body: { slug?: string };
  try {
    body = (await req.json()) as { slug?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const slug = body.slug ?? "";
  const def = findAgent(slug);
  if (!def) {
    return NextResponse.json({ ok: false, error: `unknown agent: ${slug}` }, { status: 404 });
  }
  const result = await runAgent(def.identity, def.contextBuilder);
  return NextResponse.json({
    ok: !result.error,
    result,
  });
}
