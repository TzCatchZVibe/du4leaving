// 老虾记忆层 · 3 层架构
// 1 · 工作窗 · 最近 N 条原文 (DB tg_conversations)
// 2 · 卷动摘要 · 老对话压缩 (DB tg_summary.summary)
// 3 · 固定档 · TZ 静态信息 (laoxia/prompt.ts 内嵌 · 永远在 system prompt)

import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

const WORKING_WINDOW_TURNS = 15;
const SUMMARIZE_THRESHOLD = 30;       // 累计超过 30 条 → 触发 summarize 老的

export type ConvRole = "user" | "assistant" | "tool" | "system";

export interface ConvTurn {
  role: ConvRole;
  content?: string | null;
  tool_name?: string | null;
  tool_args?: any;
  tool_result?: any;
}

export async function loadWorkingWindow(chatId: string, limit = WORKING_WINDOW_TURNS): Promise<ConvTurn[]> {
  const c = sb();
  const { data } = await c
    .from("tg_conversations")
    .select("role, content, tool_name, tool_args, tool_result")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data as any[]) || []).reverse();
}

export async function appendTurn(chatId: string, turn: ConvTurn): Promise<void> {
  const c = sb();
  await c.from("tg_conversations").insert({
    chat_id: chatId,
    role: turn.role,
    content: turn.content ?? null,
    tool_name: turn.tool_name ?? null,
    tool_args: turn.tool_args ?? null,
    tool_result: turn.tool_result ?? null,
  });
}

export async function appendTurns(chatId: string, turns: ConvTurn[]): Promise<void> {
  if (!turns.length) return;
  const c = sb();
  await c.from("tg_conversations").insert(
    turns.map((t) => ({
      chat_id: chatId,
      role: t.role,
      content: t.content ?? null,
      tool_name: t.tool_name ?? null,
      tool_args: t.tool_args ?? null,
      tool_result: t.tool_result ?? null,
    }))
  );
}

export interface SummaryRow {
  chat_id: string;
  summary: string | null;
  user_mood: string | null;
  voice_mode: "warm" | "savage";
}

export async function loadSummary(chatId: string): Promise<SummaryRow> {
  const c = sb();
  const { data } = await c.from("tg_summary").select("*").eq("chat_id", chatId).maybeSingle();
  if (data) {
    return {
      chat_id: chatId,
      summary: data.summary || null,
      user_mood: data.user_mood || null,
      voice_mode: (data.voice_mode === "savage" ? "savage" : "warm"),
    };
  }
  return { chat_id: chatId, summary: null, user_mood: null, voice_mode: "warm" };
}

export async function setVoiceMode(chatId: string, mode: "warm" | "savage"): Promise<void> {
  const c = sb();
  await c.from("tg_summary").upsert({ chat_id: chatId, voice_mode: mode, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
}

export async function setUserMood(chatId: string, mood: string | null): Promise<void> {
  const c = sb();
  await c.from("tg_summary").upsert({ chat_id: chatId, user_mood: mood, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
}

// 计数 · 决定是否要 summarize
export async function countTurns(chatId: string): Promise<number> {
  const c = sb();
  const { count } = await c.from("tg_conversations").select("id", { count: "exact", head: true }).eq("chat_id", chatId);
  return count || 0;
}

// 老对话 summarize · 用便宜模型 (v4-flash) 压缩
export async function maybeSummarize(chatId: string, summarizeFn: (oldTurns: ConvTurn[]) => Promise<string>): Promise<void> {
  const total = await countTurns(chatId);
  if (total < SUMMARIZE_THRESHOLD) return;
  const c = sb();
  // 拿超出窗口外的 (老的)
  const { data: olds } = await c
    .from("tg_conversations")
    .select("role, content, tool_name, tool_result, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(total - WORKING_WINDOW_TURNS);
  if (!olds || olds.length === 0) return;
  const summary = await summarizeFn(olds as any);
  // 与已有 summary 合并 · 简单接尾
  const existing = await loadSummary(chatId);
  const combined = existing.summary ? `${existing.summary}\n${summary}` : summary;
  await c.from("tg_summary").upsert({ chat_id: chatId, summary: combined.slice(-3000), last_summarized_at: new Date().toISOString() }, { onConflict: "chat_id" });
  // 删老对话 · 留窗口
  const cutoff = (olds as any[])[(olds as any[]).length - 1].created_at;
  await c.from("tg_conversations").delete().eq("chat_id", chatId).lte("created_at", cutoff);
}

export async function clearMemory(chatId: string): Promise<void> {
  const c = sb();
  await c.from("tg_conversations").delete().eq("chat_id", chatId);
  await c.from("tg_summary").delete().eq("chat_id", chatId);
}
