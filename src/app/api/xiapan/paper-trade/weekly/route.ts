// /api/xiapan/paper-trade/weekly
// V0.69 · 周报 · 7 天战况 + 老虎反思 (LLM 写)
// 周日 22:00 cron 触发 · 写到 ~/.du4leaving/digest/paper-week-YYYY-MM-DD.md

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readAllTrades, summary, PAPER_BANKROLL } from "@/lib/xiapan/paper-trade";
import { chat } from "@/lib/xiapan/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const HOME = os.homedir();
const DIGEST_DIR = path.join(HOME, ".du4leaving", "digest");

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

function ensureDir() {
  if (!fs.existsSync(DIGEST_DIR)) fs.mkdirSync(DIGEST_DIR, { recursive: true });
}

const SYSTEM = `你是老虎 · paper trade [A] 周报员。
风格 · 沉稳 · 数据派 · 不浪漫
任务 · 看 7 天 paper trade 数据 · 写一份反思

回 markdown · 严格结构 ·

# 模拟挂单周报 · YYYY-MM-DD

## 一句话总览
[本周 N 单 · 胜率 X% · PnL 多少]

## 哪类对了
[赢的单有什么共同点 · 标签分布]

## 哪类错了
[输的单有什么共同点 · 几个具体例子]

## 进 [B] 真单还差什么
[100 笔 / 50 平 + 55% wr / PnL ≥ 0 三条 · 还差几条]

## 下周改什么
[1-2 个具体动作 · 调阈值 / 加 lane / 减某类]

长度 ≤ 300 字。说人话 · 不用术语。`;

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
    const trades = readAllTrades(7);
    const s = summary(7);

    if (trades.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "本周 0 笔 · 老虎可能没跑 / 没强 picks · 不出周报",
      });
    }

    const closed = trades.filter(t => t.closed_at);
    const wins = closed.filter(t => (t.pnl_dollars ?? 0) > 0).slice(0, 5);
    const losses = closed.filter(t => (t.pnl_dollars ?? 0) < 0).slice(0, 5);

    const userPrompt = [
      `# 本周 paper trade · ${ymd(new Date())}`,
      ``,
      `bankroll · $${PAPER_BANKROLL}`,
      ``,
      `## 数据`,
      `- 总单 ${s.total} · 已平 ${s.closed} · 持仓 ${s.open}`,
      `- 赢 ${s.wins} · 输 ${s.losses} · 胜率 ${(s.win_rate * 100).toFixed(0)}%`,
      `- 总 PnL ${s.total_pnl >= 0 ? "+" : ""}$${s.total_pnl.toFixed(2)}`,
      `- 均单 PnL $${s.avg_pnl.toFixed(2)}`,
      ``,
      wins.length > 0 ? `## 赢的 (top 5)` : "",
      ...wins.map(t => `- \`${t.ticker}\` ${t.side.toUpperCase()} ×${t.qty} · 入${t.entry_price_c}¢ → 出${t.exit_price_c}¢ · ${t.exit_reason} · +$${(t.pnl_dollars ?? 0).toFixed(2)} · 标签 \`${t.picks_score ?? '?'}分\``),
      ``,
      losses.length > 0 ? `## 输的 (top 5)` : "",
      ...losses.map(t => `- \`${t.ticker}\` ${t.side.toUpperCase()} ×${t.qty} · 入${t.entry_price_c}¢ → 出${t.exit_price_c}¢ · ${t.exit_reason} · $${(t.pnl_dollars ?? 0).toFixed(2)} · 标签 \`${t.picks_score ?? '?'}分\``),
    ].filter(Boolean).join("\n");

    const result = await chat({
      system: SYSTEM,
      user: userPrompt,
      jsonOutput: false,
      temperature: 0.3,
    });

    ensureDir();
    const file = path.join(DIGEST_DIR, `paper-week-${ymd(new Date())}.md`);
    fs.writeFileSync(file, result.text + `\n\n---\n源数据 ·\n${userPrompt}\n`, "utf8");

    return NextResponse.json({
      ok: true,
      date: ymd(new Date()),
      provider: result.provider,
      review_md: result.text,
      summary: s,
      file: file.replace(HOME, "~"),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message,
    }, { status: 200 });
  }
}
