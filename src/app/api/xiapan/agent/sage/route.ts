// /api/xiapan/agent/sage
//
// V0.48 · Hermes Agent (替代 OpenClaw)
// 用户 directive 2026-04-30 · "未来不接入openclaw了 这次用hermes agent"
//
// 接收 question + 上下文 (positions / picks / lessons / recent_signals)
// Hermes-3 函数调用强 · 我们目前用结构化 prompt 让它综合判
// 回 markdown · 含: 决策 / 理由 / 风险 / 建议仓位 (Kelly)
//
// 后续 · 加 tool_calls (getMarketEdge / getCalibration / getCrossArb)
//        让 Hermes 主动拉数据 · 目前先 push 模式

import { NextResponse } from "next/server";
import { chat } from "@/lib/xiapan/llm";
import { buildToolsDescription, parseToolCalls, executeTool, serializeToolResults, type ToolResult } from "@/lib/xiapan/hermes-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const MAX_TOOL_HOPS = 3;

interface SageRequest {
  question: string;
  prefer_cloud?: boolean;          // V0.66 · true → 强制 OpenRouter 405B (重大决断)
  context?: {
    positions?: Array<{ ticker: string; side: string; qty: number; pnl?: number; pnl_pct?: number }>;
    picks?: Array<{ ticker: string; title: string; score: number; reasons?: string[] }>;
    recent_lessons?: Array<{ ticker: string; result: string; tag?: string; pnl: number }>;
    calibration?: Array<{ tag: string; count: number; win_rate: number }>;
    bankroll?: { cash: number; net_worth: number; today_pnl: number };
    cross_arb_signals?: number;
    mention_signals?: number;
  };
}

interface SageResponse {
  ok: boolean;
  answer_md: string;
  provider: string;
  tokens_estimated?: number;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; ok: boolean }>;
  hops?: number;
  error?: string;
}

const SYSTEM = `你是 Theo · Strategist · TZ 个人押注顾问

【硬规则 · 违反即失效】
1. 你必须先调至少 1 个工具 (get_picks / get_calibration / get_cross_arb 等)
   再回答。不调工具直接回 = 违规。如果不知道工具用什么 · 先调 get_picks 看候选。
2. 引用 "用户历史 / 胜率 / 哪类 wr 最高" 必须从 get_calibration 工具拿 ·
   不许编 (永远不要编 "你这类盘押对过 3 次 LAL Hou ..." 这种)。
3. 你只讨论 Kalshi / Polymarket 的预测市场盘 · 任何中国股票 / A股 / 港股 / 基金
   询问 → 回 "我只看 Kalshi/Polymarket · 这不归我管"。
4. 全程中文 · 不用专业术语 · 用了立刻括号解释。
5. 数据缺时直接说 "数据不够 · 跑久点再问" · 不要瞎答。

回答结构 (严格 markdown 标题):
## 决策
一句话 · 干 / 不干 / 等等
## 理由
2-3 条具体的 · 引数据 (来自工具结果) · 不要 "市场情绪" "技术指标"
## 风险
1-2 条最具体的可能翻车
## 建议下多少
百分比 + 美元金额 · "押 3% = 本金 $12 / 24 张"
不要说 "Kelly 半仓" · 说 "数学家算的安全比例 · 我们用 1/4"

长度 ≤ 250 字。
口气 · 沉稳 · 不催 · 不忽悠 · 数据先行`;

function buildUserPrompt(req: SageRequest): string {
  const lines: string[] = [];
  lines.push(`# 用户问\n${req.question}\n`);

  const c = req.context;
  if (!c) {
    lines.push("# 上下文\n(无 · 用户未提供)");
    return lines.join("\n");
  }

  if (c.bankroll) {
    lines.push(`# 资金\n现金 \$${c.bankroll.cash.toFixed(0)} · 净 \$${c.bankroll.net_worth.toFixed(0)} · 今日 \$${c.bankroll.today_pnl.toFixed(0)}`);
  }
  if (c.positions?.length) {
    lines.push("# 持仓");
    for (const p of c.positions.slice(0, 8)) {
      const pnlStr = p.pnl !== undefined ? ` · pnl \$${p.pnl.toFixed(2)}` : "";
      const pctStr = p.pnl_pct !== undefined ? ` (${(p.pnl_pct * 100).toFixed(1)}%)` : "";
      lines.push(`- \`${p.ticker}\` ${p.side.toUpperCase()} ×${p.qty}${pnlStr}${pctStr}`);
    }
  }
  if (c.picks?.length) {
    lines.push("\n# 当前候选 (picks 引擎 top)");
    for (const p of c.picks.slice(0, 5)) {
      lines.push(`- ${p.score}分 \`${p.ticker}\` · ${p.title}` + (p.reasons ? ` · ${p.reasons.slice(0, 3).join(" · ")}` : ""));
    }
  }
  if (c.calibration?.length) {
    lines.push("\n# 你的 tag 准确率 (LessonStore)");
    for (const t of c.calibration.slice(0, 8)) {
      lines.push(`- #${t.tag} · ${t.count} 单 · wr ${(t.win_rate * 100).toFixed(0)}%`);
    }
  }
  if (c.recent_lessons?.length) {
    lines.push("\n# 近 lessons (最新 5)");
    for (const l of c.recent_lessons.slice(0, 5)) {
      const tagStr = l.tag ? ` #${l.tag}` : "";
      lines.push(`- ${l.result === "win" ? "✓" : "△"} \`${l.ticker}\`${tagStr} · \$${l.pnl.toFixed(2)}`);
    }
  }
  if (c.cross_arb_signals !== undefined) {
    lines.push(`\n# 跨平台 · ${c.cross_arb_signals} 个分歧信号活跃`);
  }
  if (c.mention_signals !== undefined) {
    lines.push(`# Mention · ${c.mention_signals} 个错价候选`);
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  let body: SageRequest;
  try {
    body = (await req.json()) as SageRequest;
  } catch {
    return NextResponse.json<SageResponse>(
      { ok: false, answer_md: "", provider: "", error: "bad json" },
      { status: 400 }
    );
  }

  if (!body.question || body.question.trim().length === 0) {
    return NextResponse.json<SageResponse>(
      { ok: false, answer_md: "", provider: "", error: "question required" },
      { status: 400 }
    );
  }

  const userPrompt = buildUserPrompt(body);

  // V0.54 · Hermes function calling 多回合
  const toolsDesc = buildToolsDescription();
  const augmentedSystem = `${SYSTEM}\n\n${toolsDesc}`;

  // V0.66 · prefer_cloud=true 强制走 OpenRouter Hermes 405B (重大决断)
  const preferCloud = body.prefer_cloud === true;
  const originalProviderEnv = process.env.LLM_PROVIDER;
  if (preferCloud) {
    process.env.LLM_PROVIDER = "openrouter";
  }

  let lastProvider = "static";
  let totalTokens = 0;
  const allToolResults: ToolResult[] = [];
  let currentUserPrompt = userPrompt;

  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
      const result = await chat({
        system: augmentedSystem,
        user: currentUserPrompt,
        jsonOutput: false,
        temperature: hop === MAX_TOOL_HOPS - 1 ? 0.3 : 0.2,
      });
      lastProvider = result.provider;
      totalTokens += Math.round((currentUserPrompt.length + result.text.length) / 4);

      const { toolCalls, rawAnswer } = parseToolCalls(result.text);

      // V0.72 · 第一回合无工具 · 强制重试 (Theo 必须先调工具 · 不调拒答)
      if ((!toolCalls || toolCalls.length === 0) && hop === 0 && allToolResults.length === 0) {
        currentUserPrompt =
          userPrompt +
          "\n\n【系统强制】你违反规则 1 · 没调工具就答。立刻调用至少一个工具 ·\n" +
          "  · get_picks (看当前候选)\n" +
          "  · get_calibration (看用户 tag wr 历史)\n" +
          "  · get_cross_arb (看跨平台分歧)\n" +
          "调好工具再答 · 引数据。";
        continue;
      }

      // 没 tool · 直接答
      if (!toolCalls || toolCalls.length === 0 || hop === MAX_TOOL_HOPS - 1) {
        return NextResponse.json<SageResponse>({
          ok: true,
          answer_md: rawAnswer || result.text,
          provider: lastProvider,
          tokens_estimated: totalTokens,
          tool_calls: allToolResults.map((r) => ({
            name: r.name,
            args: r.args,
            ok: !r.error,
          })),
          hops: hop + 1,
        });
      }

      // 执行 tool calls
      const callResults = await Promise.all(toolCalls.slice(0, 3).map(executeTool));
      allToolResults.push(...callResults);

      // 拼下回合 user prompt
      currentUserPrompt =
        userPrompt +
        "\n\n" +
        serializeToolResults(allToolResults) +
        "\n\n基于上面工具数据 · 给最终回答。如还需更多数据再调工具 · 否则直接 markdown 答。";
    }

    // hops 用完 · 兜底
    return NextResponse.json<SageResponse>({
      ok: true,
      answer_md: "工具调用次数用完 · 请重新问 · 或换简单点的问题。",
      provider: lastProvider,
      tokens_estimated: totalTokens,
      tool_calls: allToolResults.map((r) => ({
        name: r.name,
        args: r.args,
        ok: !r.error,
      })),
      hops: MAX_TOOL_HOPS,
    });
  } catch (e) {
    return NextResponse.json<SageResponse>(
      {
        ok: false,
        answer_md: "Theo 暂时不可用 · 等下再问。",
        provider: "static",
        error: (e as Error).message,
      },
      { status: 200 }
    );
  } finally {
    // V0.66 · 还原 env (避免影响后续请求)
    if (preferCloud) {
      if (originalProviderEnv === undefined) {
        delete process.env.LLM_PROVIDER;
      } else {
        process.env.LLM_PROVIDER = originalProviderEnv;
      }
    }
  }
}
