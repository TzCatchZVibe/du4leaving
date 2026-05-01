// /api/xiapan/lesson-takeaway · POST · LLM 生成单 lesson 1 句教训
//
// 请求 body · { ticker, side, qty, fillPrice, result, pnl, reason, tag }
// 返回 · { ok, takeaway, provider }

import { NextResponse } from "next/server";
import { chat } from "@/lib/xiapan/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface LessonInput {
  ticker?: string;
  side?: string;
  qty?: number;
  fillPrice?: number;
  result?: string;
  pnl?: number;
  reason?: string | null;
  tag?: string | null;
}

export async function POST(req: Request) {
  let body: LessonInput = {};
  try { body = await req.json(); } catch {}

  const { ticker, side, qty, fillPrice, result, pnl, reason, tag } = body;
  if (!ticker || !result) {
    return NextResponse.json({ ok: false, error: "缺 ticker 或 result" }, { status: 400 });
  }

  const userPrompt = [
    `比赛 · ${ticker}`,
    `押 · ${side?.toUpperCase()} × ${qty} @ ${Math.round((fillPrice ?? 0) * 100)}¢`,
    `结果 · ${result}`,
    `净盈亏 · ${(pnl ?? 0) >= 0 ? "+" : ""}$${(pnl ?? 0).toFixed(2)}`,
    reason ? `用户写的理由 · "${reason}"` : "用户没写理由",
    tag ? `tag · ${tag}` : "没 tag",
  ].join("\n");

  try {
    const llm = await chat({
      system: `你是 Duby · 用户的赌博伴侣 · 邻家小妹妹懂投资风投 ·
看用户单笔押注 + 结果 + 他写的理由 · 给 1 句教训 · ≤ 30 字 · 中文 · 0 术语 ·
关键 ·
- 如果 win + reason 是 'edge 信号' · 鼓励 (你押对了 ·继续这种)
- 如果 win + reason 是 '情绪盘' · 警告 (这次只是运气 · 不算 sharp)
- 如果 lose + reason 是 'edge 信号' · 安抚 (变数大 · 长期看 OK)
- 如果 lose + reason 是 '情绪盘' / '跟风' / '直觉' · 直说 (下次别押 · 你的直觉骗你)
- 如果 result void · "白搭一回 · 不算"
直接给一句话 · 不要前缀不要 markdown`,
      user: userPrompt,
      temperature: 0.5,
    });
    return NextResponse.json({
      ok: true,
      takeaway: llm.text.trim().replace(/^["']|["']$/g, ""),
      provider: llm.provider,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
