// hermes-tools.ts · V0.54 真 agent 工具定义 + 执行
//
// Hermes-3 用 OpenAI 风格 tool_use · 我们用结构化 JSON 让模型决定调用哪个
// 执行后回填 → 再调一次模型 → 最多 3 跳

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";

const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

export interface ToolDefinition {
  name: string;
  description: string;
  args: Record<string, string>;        // arg_name → 说明
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "get_market",
    description: "查 Kalshi 单个市场的报价 / 流动性 / 详情",
    args: { ticker: "Kalshi market ticker · 例如 KXNBAGAME-26MAY01LALHOU-LAL" },
  },
  {
    name: "get_picks",
    description: "拿当前 picks 引擎 top 候选 (5 路融合后的最便宜单)",
    args: { min_score: "最低分阈值 · 默认 45" },
  },
  {
    name: "get_cross_arb",
    description: "拿 Kalshi vs Polymarket 价差信号 (跨平台分歧)",
    args: { min_div: "最小分歧 pp · 默认 3" },
  },
  {
    name: "get_calibration",
    description: "拿用户的 tag 准确率 (沉淀链路 · 哪类直觉值钱)",
    args: {},
  },
  {
    name: "get_recent_lessons",
    description: "拿用户近期结算的 lessons (最新 N 笔)",
    args: { limit: "数量 · 默认 8" },
  },
  {
    name: "get_whales",
    description: "拿 Polymarket 实时大户活动 (近 24h $200+ 大单)",
    args: { min_dollar: "金额阈值 · 默认 500" },
  },
];

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
}

/// 构建给 Hermes 看的 tool 描述 (system prompt 一部分)
export function buildToolsDescription(): string {
  const lines: string[] = [];
  lines.push("【可用工具】 你可以选择调用以下工具拉数据 · 然后再综合回答");
  lines.push("");
  for (const t of TOOLS) {
    lines.push(`- ${t.name} · ${t.description}`);
    if (Object.keys(t.args).length > 0) {
      for (const [k, v] of Object.entries(t.args)) {
        lines.push(`    ${k} · ${v}`);
      }
    }
  }
  lines.push("");
  lines.push("【调用方式】 想用工具 · 输出严格 JSON {");
  lines.push('    "tool_calls": [ { "name": "get_market", "args": { "ticker": "..." } } ]');
  lines.push("  } 不要其它字");
  lines.push("【回答方式】 不需要工具或工具数据已够 · 直接输出 markdown 答 · 严格按 ## 决策→理由→风险→建议下多少 结构");
  return lines.join("\n");
}

/// 解析模型输出 · 返回 tool_calls 或 final answer
export function parseToolCalls(text: string): { toolCalls: ToolCall[] | null; rawAnswer: string } {
  const trimmed = text.trim();
  // 试 JSON 解析 (整段是 JSON)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed.tool_calls)) {
        return {
          toolCalls: parsed.tool_calls as ToolCall[],
          rawAnswer: "",
        };
      }
    } catch {}
  }
  // 试找 JSON 块
  const m = trimmed.match(/\{\s*"tool_calls"[\s\S]*?\}\s*$/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed.tool_calls)) {
        return {
          toolCalls: parsed.tool_calls as ToolCall[],
          rawAnswer: "",
        };
      }
    } catch {}
  }
  return { toolCalls: null, rawAnswer: trimmed };
}

/// 执行单个 tool · 返回 result 或 error
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  try {
    let result: unknown = null;
    switch (call.name) {
      case "get_market": {
        const ticker = String(call.args.ticker ?? "");
        if (!ticker) throw new Error("ticker required");
        const r = await fetch(
          `https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`,
          { cache: "no-store" }
        );
        const d = await r.json();
        const m = d.market;
        result = m
          ? {
              ticker: m.ticker,
              title: m.title,
              yes_bid: m.yes_bid, yes_ask: m.yes_ask,
              no_bid: m.no_bid, no_ask: m.no_ask,
              last_price: m.last_price,
              volume_24h: m.volume_24h,
              open_interest: m.open_interest,
              status: m.status,
              expected_expiration_time: m.expected_expiration_time,
            }
          : { error: "not found" };
        break;
      }
      case "get_picks": {
        const minScore = Number(call.args.min_score ?? 45);
        const r = await fetch(
          `${URL_PREFIX}/api/xiapan/picks?min=${minScore}&limit=8`,
          { cache: "no-store" }
        );
        const d = await r.json();
        result = (d.picks ?? []).map((p: { ticker: string; title: string; score: number; buy_side: string; buy_price_c: number; reasons: string[]; edge_pp: number }) => ({
          ticker: p.ticker,
          title: p.title,
          score: p.score,
          buy_side: p.buy_side,
          buy_price_c: p.buy_price_c,
          edge_pp: p.edge_pp,
          reasons: (p.reasons ?? []).slice(0, 3),
        }));
        break;
      }
      case "get_cross_arb": {
        const minDiv = Number(call.args.min_div ?? 3);
        const r = await fetch(
          `${URL_PREFIX}/api/xiapan/cross-arb?minDiv=${minDiv}&limit=10`,
          { cache: "no-store" }
        );
        const d = await r.json();
        result = (d.pairs ?? []).map((p: { event_label: string; k_ticker: string; k_yes_ask: number; poly_yes_price: number; edge_pp: number; signal: string }) => ({
          event: p.event_label,
          k_ticker: p.k_ticker,
          k_yes_ask: p.k_yes_ask,
          poly_yes_price: p.poly_yes_price,
          edge_pp: p.edge_pp,
          signal: p.signal,
        }));
        break;
      }
      case "get_calibration": {
        // 客户端要传 · 后端没存
        // V0.54 · 占位 · 客户端送 calibration 在 context 里 · tool 只能拿 server 数据
        result = { note: "calibration 在 context.calibration 里 · 直接看那" };
        break;
      }
      case "get_recent_lessons": {
        result = { note: "lessons 在 context.recent_lessons 里 · 直接看那" };
        break;
      }
      case "get_whales": {
        const minDollar = Number(call.args.min_dollar ?? 500);
        const r = await fetch(
          `${URL_PREFIX}/api/xiapan/whales?minDollar=${minDollar}&limit=15`,
          { cache: "no-store" }
        );
        const d = await r.json();
        result = {
          recent: (d.trades_feed ?? []).slice(0, 10).map((w: { side: string; dollar_value: number; market_title: string; outcome: string; age_minutes: number }) => ({
            side: w.side,
            dollar: w.dollar_value,
            market: w.market_title,
            outcome: w.outcome,
            age_min: w.age_minutes,
          })),
          top_traders: (d.top_traders ?? []).slice(0, 5).map((t: { trader_name?: string; pseudonym?: string; total_volume_usd: number; trade_count: number }) => ({
            name: t.trader_name || t.pseudonym || "anon",
            vol_usd: t.total_volume_usd,
            count: t.trade_count,
          })),
        };
        break;
      }
      default:
        throw new Error(`unknown tool: ${call.name}`);
    }
    return { name: call.name, args: call.args, result };
  } catch (e) {
    return {
      name: call.name,
      args: call.args,
      result: null,
      error: (e as Error).message,
    };
  }
}

/// 把 tool_results 序列化回给模型
export function serializeToolResults(results: ToolResult[]): string {
  const lines: string[] = [];
  lines.push("【工具调用结果】");
  for (const r of results) {
    lines.push(`\n· ${r.name}(${JSON.stringify(r.args)}):`);
    if (r.error) {
      lines.push(`  错误 · ${r.error}`);
    } else {
      lines.push(JSON.stringify(r.result, null, 2).slice(0, 1500));
    }
  }
  return lines.join("\n");
}
