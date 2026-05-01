// llm.ts · LLM provider abstraction (ADR-0002 · v0.48 加 Hermes)
//
// V0.48 PIVOT · 加 Hermes (Nous Research) 作首选 · 替代 OpenClaw
// 用户 directive 2026-04-30 · "未来不接入openclaw了 这次用hermes agent"
//
// 4 providers · auto-fallback chain ·
//   1. Hermes (local · Ollama hermes3 · 强函数调用 · 隐私 0 钱)
//   2. Ollama (local · 任意 model · backup)
//   3. OpenAI (cloud · 付费 · fallback)
//   4. Static (无 LLM · 模板 · 总能跑)
//
// Set LLM_PROVIDER env to force · "hermes" | "ollama" | "openai" | "static" | "auto"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const HERMES_MODEL = process.env.HERMES_MODEL || "hermes3:8b";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export interface ChatOptions {
  system: string;
  user: string;
  /** if set + provider supports it · enforce JSON output */
  jsonOutput?: boolean;
  temperature?: number;
}

export interface ChatResult {
  text: string;
  provider: "hermes" | "ollama" | "openai" | "static";
  cached?: boolean;
}

// ── Hermes (Nous Research) · v0.48 ─────────────────────

/// Check whether Hermes-3 model is loaded in Ollama
async function hermesAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return false;
    const d = await r.json() as { models?: Array<{ name?: string }> };
    const models = d.models ?? [];
    // 任意 hermes 名 (hermes3, hermes3:8b, nous-hermes2, ...)
    return models.some((m) => /hermes/i.test(m.name ?? ""));
  } catch {
    return false;
  }
}

async function hermesChat(opts: ChatOptions): Promise<string> {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: HERMES_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      format: opts.jsonOutput ? "json" : undefined,
      options: { temperature: opts.temperature ?? 0.4 },
      stream: false,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`hermes ${r.status}`);
  const d = await r.json();
  return (d?.message?.content as string) || "";
}

// ── Ollama (generic fallback) ──────────────────────────

async function ollamaAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/version`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function ollamaChat(opts: ChatOptions): Promise<string> {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      format: opts.jsonOutput ? "json" : undefined,
      options: { temperature: opts.temperature ?? 0.4 },
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  const d = await r.json();
  return (d?.message?.content as string) || "";
}

// ── OpenAI ─────────────────────────────────────────────

async function openaiChat(opts: ChatOptions): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no OPENAI_API_KEY");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: opts.temperature ?? 0.4,
      response_format: opts.jsonOutput ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${await r.text().then(t => t.slice(0, 100))}`);
  const d = await r.json();
  return (d?.choices?.[0]?.message?.content as string) || "";
}

// ── Static fallback ────────────────────────────────────

function staticChat(opts: ChatOptions): string {
  // 0 LLM 模板 · 内嵌 · 不需要 prompt
  if (opts.jsonOutput) {
    return JSON.stringify({
      summary: "数据已拉 · 但 LLM 暂时不可用 · 显示模板话术",
      patterns: [
        "起 Ollama (本地) 或配 OpenAI 才能看 AI 复盘",
        "你的 fills 历史已存 · 看 history 板块也能找规律",
        "Duby 暂时离线 · 你的 ★ STRONG 信号还能用",
      ],
      actions: [
        "本地启 Ollama · ollama serve · 自动接管",
        "或检查 OPENAI_API_KEY 是否设置",
        "或继续看现有指标 · 不依赖 LLM",
      ],
    });
  }
  return "LLM 暂时不可用 · 看现有数据吧";
}

// ── Auto-routed chat ───────────────────────────────────

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const forced = (process.env.LLM_PROVIDER || "auto").toLowerCase();

  if (forced === "static") {
    return { text: staticChat(opts), provider: "static" };
  }
  if (forced === "hermes") {
    try {
      return { text: await hermesChat(opts), provider: "hermes" };
    } catch {
      return { text: staticChat(opts), provider: "static" };
    }
  }
  if (forced === "openai") {
    try {
      return { text: await openaiChat(opts), provider: "openai" };
    } catch {
      return { text: staticChat(opts), provider: "static" };
    }
  }
  if (forced === "ollama") {
    try {
      return { text: await ollamaChat(opts), provider: "ollama" };
    } catch {
      return { text: staticChat(opts), provider: "static" };
    }
  }

  // V0.48 auto · prefer Hermes (function calling) > Ollama (generic) > OpenAI (paid) > Static
  if (await hermesAvailable()) {
    try {
      return { text: await hermesChat(opts), provider: "hermes" };
    } catch { /* fall through */ }
  }
  if (await ollamaAvailable()) {
    try {
      return { text: await ollamaChat(opts), provider: "ollama" };
    } catch { /* fall through */ }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      return { text: await openaiChat(opts), provider: "openai" };
    } catch { /* fall through */ }
  }
  return { text: staticChat(opts), provider: "static" };
}
