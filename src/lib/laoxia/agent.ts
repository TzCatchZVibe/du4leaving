// 老虾 agent · 主循环 (OpenRouter 重构)
// 1 key 通杀 · models 数组自动 failover

import { buildSystemPrompt } from "./prompt";
import { toolsForOpenAI, executeTool } from "./tools";
import { loadWorkingWindow, loadSummary, appendTurns, ConvTurn, maybeSummarize } from "./memory";
import { listJars } from "@/lib/wealth/guilty";
import { listLumpy } from "@/lib/wealth/lumpy";

interface AgentReply {
  text: string;
  tool_calls_made: number;
  model_used: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

// OpenRouter 自动 fallback · 主→次→兜底
// 主 · DeepSeek V4 Pro · 1M 上下文 + thinking + tool use
// 次 · DeepSeek V4 Flash · 便宜快
// 兜底 · Claude Haiku 4.5 (中文+人格强)
// 最后 · GPT-4o-mini
// OpenRouter 限制 · models 数组最多 3 个
const PRIMARY_MODEL = "deepseek/deepseek-v4-pro";
const FALLBACK_MODELS = [
  "deepseek/deepseek-v4-flash",
  "anthropic/claude-haiku-4.5",
];
// 简单查询 (cron 主动 push 等) 用 flash 省钱
const SIMPLE_MODEL = "deepseek/deepseek-v4-flash";

const MAX_HOPS = 4;

interface OpenRouterOpts {
  models?: string[];           // 走 OpenRouter 数组 failover
  model?: string;              // 单模型
  tools?: any[];
  temperature?: number;
  max_tokens?: number;
}

async function callOpenRouter(messages: ChatMessage[], opts: OpenRouterOpts): Promise<any> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY 未设");
  const body: any = {
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 800,
  };
  if (opts.models?.length) {
    body.model = opts.models[0];
    body.models = opts.models;          // OpenRouter 特性 · 主模型 fail 自动切
  } else if (opts.model) {
    body.model = opts.model;
  }
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://du4leaving.vercel.app",
      "X-Title": "du4leaving-laoxia",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status} · ${t.slice(0, 200)}`);
  }
  return res.json();
}

// 把记忆 ConvTurn 转成 OpenAI ChatMessage 格式
function toChat(turns: ConvTurn[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of turns) {
    if (t.role === "user") {
      out.push({ role: "user", content: t.content || "" });
    } else if (t.role === "assistant") {
      const m: ChatMessage = { role: "assistant", content: t.content || null };
      if (t.tool_name && t.tool_args) {
        m.tool_calls = [{
          id: `hist_${out.length}`, type: "function",
          function: { name: t.tool_name, arguments: JSON.stringify(t.tool_args) },
        }];
      }
      out.push(m);
    } else if (t.role === "tool") {
      out.push({ role: "tool", tool_call_id: `hist_${out.length - 1}`, name: t.tool_name || "tool", content: JSON.stringify(t.tool_result).slice(0, 2000) });
    }
  }
  return out;
}

export async function callLaoxia(chatId: string, userText: string, baseUrl: string): Promise<AgentReply> {
  const today = new Date().toISOString().slice(0, 10);

  const [working, summary, jars, lumpy] = await Promise.all([
    loadWorkingWindow(chatId, 15).catch(() => []),
    loadSummary(chatId).catch(() => ({ chat_id: chatId, summary: null, user_mood: null, voice_mode: "warm" as const })),
    listJars().catch(() => []),
    listLumpy().catch(() => []),
  ]);

  const systemPrompt = buildSystemPrompt({
    chat_id: chatId,
    voice_mode: summary.voice_mode,
    current_jars: jars,
    current_lumpy: lumpy,
    user_mood: summary.user_mood,
    rolling_summary: summary.summary,
    current_date: today,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...toChat(working),
    { role: "user", content: userText },
  ];

  const tools = toolsForOpenAI();
  const turnsToSave: ConvTurn[] = [{ role: "user", content: userText }];

  let resp: any;
  let toolHops = 0;
  let finalText = "";
  let modelUsed = PRIMARY_MODEL;

  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      resp = await callOpenRouter(messages, {
        models: [PRIMARY_MODEL, ...FALLBACK_MODELS],
        tools,
      });
      modelUsed = resp.model || PRIMARY_MODEL;

      const choice = resp.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        finalText = "(老虾哑了 · 模型没返回)";
        break;
      }

      // 没 tool 调 · 是最终回话
      if (!msg.tool_calls?.length) {
        finalText = (msg.content || "").trim() || "(老虾今天没话)";
        if (msg.content) {
          turnsToSave.push({ role: "assistant", content: finalText });
        }
        break;
      }

      // 有 tool 调 · 执行 + 喂回
      toolHops++;
      messages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        turnsToSave.push({
          role: "assistant",
          content: msg.content || null,
          tool_name: tc.function.name,
          tool_args: safeParseJson(tc.function.arguments),
        });
      }
      const results = await Promise.all(
        msg.tool_calls.map(async (tc: any) => {
          const args = safeParseJson(tc.function.arguments);
          const r = await executeTool(tc.function.name, args, baseUrl);
          return { tc, r };
        })
      );
      for (const { tc, r } of results) {
        const resultStr = JSON.stringify(r).slice(0, 4000);
        messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: resultStr });
        turnsToSave.push({ role: "tool", tool_name: tc.function.name, tool_result: r });
      }

      if (hop === MAX_HOPS - 1) {
        messages.push({ role: "user", content: "基于工具结果 · 直接给 TZ 回话 · 不再调 tool · ≤ 3 行" });
      }
    }
  } catch (e: any) {
    finalText = `(老虾出错 · ${e.message})`;
  }

  // 持久化 · 不阻塞回话
  appendTurns(chatId, turnsToSave).catch((e) => console.error("[laoxia] 写记忆失败 ·", e.message));

  return { text: finalText, tool_calls_made: toolHops, model_used: modelUsed };
}

function safeParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

// 后续用 · 摘要老对话 (用 flash 省钱)
export async function summarizeOldTurns(chatId: string): Promise<void> {
  await maybeSummarize(chatId, async (olds) => {
    const text = olds.map((t) => `[${t.role}] ${t.tool_name || ""} ${t.content?.slice(0, 100) || ""}`).join("\n");
    const messages: ChatMessage[] = [
      { role: "system", content: "你是 TZ 的私人理财对话压缩器 · 输出中文 · ≤ 200 字 · 抓 1) 用户提到的偏好 / 心情 2) 重要决定 3) 已知未来事件" },
      { role: "user", content: text.slice(0, 8000) },
    ];
    try {
      const r = await callOpenRouter(messages, { model: SIMPLE_MODEL, temperature: 0.3, max_tokens: 300 });
      return r.choices?.[0]?.message?.content?.trim() || "";
    } catch {
      return "";
    }
  });
}
