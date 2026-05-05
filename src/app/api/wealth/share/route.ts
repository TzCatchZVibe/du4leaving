// /api/wealth/share · 朋友圈 share Wrapped (#15)
// 隐私 · 不暴露具体数字 · 只 share 进度 / 成就 / 故事
//
// 输出 · 1 段可发的文本 · 像 Spotify Wrapped share 卡片

import { NextResponse } from "next/server";
import { generateWrapped } from "@/lib/wealth/wrapped";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") || "-1");
  const mode = url.searchParams.get("mode") || "share";    // share = 隐私版 · full = 全数字
  try {
    const r = await generateWrapped(offset);
    if (mode === "full") {
      return NextResponse.json({ ok: true, ...r });
    }
    // 朋友圈安全版 · 不暴露具体数字 · 只暴露 ·
    // - 月份
    // - HG 状态 (above/normal/below)
    // - lockdown 战绩 (cancel 几单 · 不爆金额? actually share 1 个数字 OK)
    // - 离最近目标的 % (不爆 base)
    // - 一句故事
    const safeReport = {
      month: r.month,
      hg_status: r.income.hg_status,           // 文字状态 · 不数字
      lockdown_cancelled: r.lockdown.cancelled_count,
      lockdown_save_rate_pct: r.lockdown.save_rate_pct,
      goals_progress: r.goals.map((g) => ({
        emoji: g.emoji,
        name: g.name,
        pct: g.pct,
        // 不输出 具体数字
      })),
      narrative: r.narrative,
    };

    const shareText = formatShare(safeReport);
    return NextResponse.json({ ok: true, share_text: shareText, safe: safeReport });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function formatShare(r: any): string {
  const statusZh: Record<string, string> = {
    above_normal: "破纪录",
    with_bonus: "稳进",
    base_only: "持平",
    below_base: "调整中",
  };
  const lines = [
    `📊 ${r.month} · 月度复盘`,
    ``,
    r.narrative,
    ``,
    `工资状态 · ${statusZh[r.hg_status] || "正常"}`,
    `自律 · 拦下 ${r.lockdown_cancelled} 单冲动消费`,
    ``,
    `目标进度 ·`,
  ];
  for (const g of r.goals_progress) {
    const bar = "▰".repeat(Math.floor(g.pct / 10)) + "▱".repeat(Math.max(0, 10 - Math.floor(g.pct / 10)));
    lines.push(`${g.emoji} ${g.name}  ${bar} ${g.pct}%`);
  }
  lines.push(``, `— TZ · du4leaving`);
  return lines.join("\n");
}
