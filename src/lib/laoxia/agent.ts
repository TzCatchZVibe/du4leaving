// 老虾 agent · 主循环
// 模型 · DeepSeek V4 (OpenAI 兼容) · pro 主力 · flash 简单查询 · gpt-4o-mini fallback
// 流程 · system + 工作窗 + summary + 当前 user → LLM → 多回合 tool use → 最终回话

import { buildSystemPrompt } from "./prompt";
import { LAOXIA_TOOLS, toolsForOpenAI, executeTool } from "./tools";
import { loadWorkingWindow, loadSummary, appendTurns, ConvTurn, maybeSummarize, setUserMood } from "./memory";
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

const PRO_MODEL = "deepseek-v4-pro";
const FLASH_MODEL = "deepseek-v4-flash";
const FALLBACK_MODEL = "gpt-4o-mini";
const MAX_HOPS = 4;

async function callDeepSeek(model: string, messages: ChatMessage[], opts: { tools?: any[]; temperature?: number; max_tokens?: number } = {}): Promise<any> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY 未设");
  const body: any = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 800,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`DeepSeek HTTP ${res.status} · ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function callOpenAIFallback(messages: ChatMessage[], opts: { tools?: any[] } = {}): Promise<any> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 未设 (fallback)");
  const body: any = {
    model: FALLBACK_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 600,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
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

  // 拉记忆 + 当前状态 · 并发
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
  let modelUsed = PRO_MODEL;
  let toolHops = 0;
  let finalText = "";

  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      try {
        resp = await callDeepSeek(modelUsed, messages, { tools });
      } catch (e: any) {
        console.error("[laoxia] DeepSeek 失败 ·", e.message, "· fallback 到 gpt-4o-mini");
        resp = await callOpenAIFallback(messages, { tools });
        modelUsed = FALLBACK_MODEL;
      }

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
      // 记录这条 assistant 的 tool 决定
      for (const tc of msg.tool_calls) {
        turnsToSave.push({
          role: "assistant",
          content: msg.content || null,
          tool_name: tc.function.name,
          tool_args: safeParseJson(tc.function.arguments),
        });
      }
      // 执行所有 tools 并行
      const results = await Promise.all(
        msg.tool_calls.map(async (tc: any) => {
          const args = safeParseJson(tc.function.arguments);
          const r = await executeTool(tc.function.name, args, baseUrl);
          return { tc, args, r };
        })
      );
      for (const { tc, r } of results) {
        const resultStr = JSON.stringify(r).slice(0, 4000);
        messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: resultStr });
        turnsToSave.push({ role: "tool", tool_name: tc.function.name, tool_result: r });
      }

      // 最后一跳 · 强制让 LLM 总结
      if (hop === MAX_HOPS - 1) {
        messages.push({ role: "user", content: "基于工具结果 · 直接给 TZ 回话 · 不再调 tool · ≤ 3 行" });
      }
    }
  } catch (e: any) {
    finalText = `(老虾出错 · ${e.message})`;
  }

  // 持久化
  appendTurns(chatId, turnsToSave).catch((e) => console.error("[laoxia] 写记忆失败 ·", e.message));

  return { text: finalText, tool_calls_made: toolHops, model_used: modelUsed };
}

function safeParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

// 后续用 · 摘要老对话
export async function summarizeOldTurns(chatId: string): Promise<void> {
  await maybeSummarize(chatId, async (olds) => {
    const text = olds.map((t) => `[${t.role}] ${t.tool_name || ""} ${t.content?.slice(0, 100) || ""}`).join("\n");
    const messages: ChatMessage[] = [
      { role: "system", content: "你是 TZ 的私人理财对话压缩器 · 输出中文 · ≤ 200 字 · 抓 1) 用户提到的偏好 / 心情 2) 重要决定 3) 已知未来事件" },
      { role: "user", content: text.slice(0, 8000) },
    ];
    try {
      const r = await callDeepSeek(FLASH_MODEL, messages, { temperature: 0.3, max_tokens: 300 });
      return r.choices?.[0]?.message?.content?.trim() || "";
    } catch {
      return "";
    }
  });
}
