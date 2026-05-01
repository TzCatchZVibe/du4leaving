// /api/xiapan/mention-freq
//
// V0.42 · Catboy mention 词频估算
// 输入 · speaker + target_word + event_context
// 输出 · estimated_prob (0-1) · 是否会出现 + confidence + LLM 推理
//
// 实现 · LLM 走 ollama → openai → static
//   - prompt 让模型基于训练里见过的转录估计
//   - 内存缓存 30 min · 同 (speaker, word, event_type) 不重算
//
// 局限 · LLM 可能幻觉 · 我们标 confidence + 让用户最后核
//        v0.43 路标 · 接真实转录词频 (Senate.gov / SEC EDGAR / yt-transcripts)

import { NextResponse } from "next/server";
import { chat } from "@/lib/xiapan/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

interface FreqResult {
  ok: boolean;
  estimated_prob: number;          // 0-1 · 该单词在该事件中至少说一次的概率
  confidence: "low" | "med" | "high";
  reasoning: string;               // 一句话 · 给用户判断
  samples_referenced?: string[];   // 模型说参考了哪些过往事件
  provider: string;
  cached?: boolean;
  source: string;                  // "llm" | "static_unknown"
  error?: string;
}

const CACHE = new Map<string, { v: FreqResult; expires: number }>();
const TTL_MS = 30 * 60 * 1000;        // 30 min

function cacheKey(speaker: string, word: string, ctx: string): string {
  return `${speaker.toLowerCase()}__${word.toLowerCase()}__${ctx.toLowerCase().slice(0, 60)}`;
}

const SYSTEM_PROMPT = `你是 prediction-market 词频分析师 · 不卖 · 不护短 · 量化分析。

任务 · 给一个 (speaker, target_word, event_context) · 估计:
  · estimated_prob: 0-1 · 该 speaker 在该事件中至少说一次该 word 的概率
  · confidence: low / med / high · 你对此估计的把握
  · reasoning: ≤ 2 句中文 · 给用户的判断依据
  · samples_referenced: 你参考的 1-3 个具体过往事件 (如有)

判断方法 ·
  1. 该 speaker 历史口头禅 / 招牌词?
  2. 该 word 跟 event_context 主题契合?
  3. 是常见词 (如 "and", "America") 还是罕见词 (如 "Hormuz")?
  4. 时间跨度 (单场短演讲 vs 长 press conference)?

只输出严格 JSON · 无其它字符。`;

const USER_TEMPLATE = (speaker: string, word: string, ctx: string) => `
speaker: ${speaker}
target_word: "${word}"
event_context: ${ctx}

按以下格式回:
{
  "estimated_prob": 0.45,
  "confidence": "med",
  "reasoning": "Bernie 在街头演讲常说 socialism · 单场≥1次概率高",
  "samples_referenced": ["2025 NYC rally", "2024 Vermont speech"]
}
`;

async function estimateOne(speaker: string, word: string, ctx: string): Promise<FreqResult> {
  const k = cacheKey(speaker, word, ctx);
  const hit = CACHE.get(k);
  if (hit && hit.expires > Date.now()) {
    return { ...hit.v, cached: true };
  }

  // 默认 fallback (LLM 不可用时)
  const fallback: FreqResult = {
    ok: true,
    estimated_prob: 0.5,
    confidence: "low",
    reasoning: "LLM 不可用 · 默认 50% · 自己核",
    provider: "static",
    source: "static_unknown",
  };

  try {
    const result = await chat({
      system: SYSTEM_PROMPT,
      user: USER_TEMPLATE(speaker, word, ctx),
      jsonOutput: true,
      temperature: 0.2,
    });
    let parsed: Partial<{ estimated_prob: number; confidence: string; reasoning: string; samples_referenced: string[] }> = {};
    try {
      parsed = JSON.parse(result.text);
    } catch {
      // 模型返回非 JSON · 退 fallback
      const r = { ...fallback, provider: result.provider };
      CACHE.set(k, { v: r, expires: Date.now() + TTL_MS });
      return r;
    }

    const prob = Math.max(0, Math.min(1, Number(parsed.estimated_prob ?? 0.5)));
    const confRaw = String(parsed.confidence ?? "low").toLowerCase();
    const conf = (["low", "med", "high"].includes(confRaw) ? confRaw : "low") as "low" | "med" | "high";

    const out: FreqResult = {
      ok: true,
      estimated_prob: Number(prob.toFixed(3)),
      confidence: conf,
      reasoning: String(parsed.reasoning ?? "").slice(0, 200),
      samples_referenced: Array.isArray(parsed.samples_referenced)
        ? parsed.samples_referenced.slice(0, 3).map(String)
        : undefined,
      provider: result.provider,
      source: "llm",
    };
    CACHE.set(k, { v: out, expires: Date.now() + TTL_MS });
    return out;
  } catch (e) {
    return { ...fallback, error: (e as Error).message };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const speaker = (url.searchParams.get("speaker") ?? "").trim();
  const word = (url.searchParams.get("word") ?? "").trim();
  const ctx = (url.searchParams.get("context") ?? "").trim();

  if (!speaker || !word) {
    return NextResponse.json(
      { ok: false, error: "speaker and word required" },
      { status: 400 }
    );
  }

  const r = await estimateOne(speaker, word, ctx);
  return NextResponse.json(r);
}

// 内部并发批量 · 给 mentions enrich 使用
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { items?: Array<{ speaker: string; word: string; context: string; ticker?: string }> };
    const items = body.items ?? [];
    if (items.length > 50) {
      return NextResponse.json({ ok: false, error: "too many items (max 50)" }, { status: 400 });
    }
    const results = await Promise.all(items.map(async (it) => {
      const r = await estimateOne(it.speaker, it.word, it.context);
      return { ticker: it.ticker, ...r };
    }));
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
