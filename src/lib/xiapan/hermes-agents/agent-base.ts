// hermes-agents/agent-base.ts
//
// V0.55 · 真 Hermes agent 系统 (替代 OpenClaw 思路)
// 用户 directive · "hermes怎么在你这里是一个函数 他不应该是
//                  和openclaw很像但是更强的agent吗"
//
// 每个 agent 是一个长跑 entity ·
//   IDENTITY (它是谁) · SOUL (核心使命) · MEMORY (长期) · daily/ (日志)
//   CRON (定时跑) · TOOLS (能用啥) · OUTPUT (写到哪)
//
// 跑环境 · localhost-only (~/.du4leaving/agents/<name>/) · 同 OpenClaw 思路

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chat } from "@/lib/xiapan/llm";
import { executeTool, type ToolCall } from "@/lib/xiapan/hermes-tools";

export interface AgentIdentity {
  name: string;          // "老虎"
  slug: string;          // "laohu"  · 文件夹名
  role: string;          // "市场分析师"
  emoji: string;         // 图标
  cron: string;          // "5min" / "1min" / "nightly" · cadence label
  cron_seconds: number;  // 实际间隔
  soul: string;          // 长 prompt · 核心使命
  tools: string[];       // 能用的工具名 (来自 hermes-tools)
}

export interface AgentRunResult {
  agent: string;
  ranAt: string;
  output_md: string;
  tool_calls: Array<{ name: string; ok: boolean }>;
  hops: number;
  duration_ms: number;
  provider: string;
  error?: string;
}

const HOME = os.homedir();
const AGENTS_ROOT = path.join(HOME, ".du4leaving", "agents");

/// 拿 agent 工作目录 · 不存在创建
export function agentDir(slug: string): string {
  const dir = path.join(AGENTS_ROOT, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const daily = path.join(dir, "daily");
  if (!fs.existsSync(daily)) fs.mkdirSync(daily, { recursive: true });
  return dir;
}

/// 首次启动时 · 把 IDENTITY/SOUL/CRON.json 写到 agent 目录
/// 用户可以直接 vim 改这些文件 · 不用动代码
export function ensureIdentityFiles(identity: AgentIdentity): void {
  const dir = agentDir(identity.slug);
  const idF = path.join(dir, "IDENTITY.md");
  const soulF = path.join(dir, "SOUL.md");
  const cronF = path.join(dir, "CRON.json");
  const memF = path.join(dir, "MEMORY.md");

  if (!fs.existsSync(idF)) {
    const md = `# ${identity.emoji} ${identity.name}\n\n` +
      `**slug** · \`${identity.slug}\`\n` +
      `**role** · ${identity.role}\n` +
      `**cron** · ${identity.cron} (${identity.cron_seconds}s)\n` +
      `**tools** · ${identity.tools.join(", ")}\n\n` +
      `_这文件用户可编辑 · 立刻生效_\n`;
    fs.writeFileSync(idF, md, "utf8");
  }
  if (!fs.existsSync(soulF)) {
    fs.writeFileSync(soulF, identity.soul + "\n\n_这是核心使命 · 改这里 → 改 agent 行为_\n", "utf8");
  }
  if (!fs.existsSync(cronF)) {
    fs.writeFileSync(
      cronF,
      JSON.stringify(
        { interval_seconds: identity.cron_seconds, enabled: true, last_run: null },
        null,
        2
      ) + "\n",
      "utf8"
    );
  }
  if (!fs.existsSync(memF)) {
    fs.writeFileSync(memF, `# ${identity.name} · 长期记忆\n\n_第一次跑 · 还没记忆。每次跑会读这里_\n`, "utf8");
  }
}

/// 读 SOUL · 优先文件 · fallback 默认
export function loadSoul(identity: AgentIdentity): string {
  const f = path.join(agentDir(identity.slug), "SOUL.md");
  if (!fs.existsSync(f)) return identity.soul;
  try {
    const txt = fs.readFileSync(f, "utf8");
    // 去掉文末说明 (如 "_这是核心使命..._")
    return txt.replace(/_这是.*?_/g, "").trim() || identity.soul;
  } catch {
    return identity.soul;
  }
}

/// 读 CRON.json · 拿 interval / enabled / last_run
export function loadCron(slug: string): { interval_seconds: number; enabled: boolean; last_run: string | null } {
  const f = path.join(agentDir(slug), "CRON.json");
  const fallback = { interval_seconds: 300, enabled: true, last_run: null };
  if (!fs.existsSync(f)) return fallback;
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(f, "utf8")) };
  } catch {
    return fallback;
  }
}

/// 跑后写回 CRON.json 的 last_run
export function markCronRan(slug: string): void {
  const f = path.join(agentDir(slug), "CRON.json");
  const cur = loadCron(slug);
  cur.last_run = new Date().toISOString();
  fs.writeFileSync(f, JSON.stringify(cur, null, 2) + "\n", "utf8");
}

// ─── V0.57 · 跨 agent 消息总线 ─────────────────────

export interface AgentMessage {
  from: string;
  to: string;
  ts: string;
  subject: string;
  body: string;          // markdown · agent 写
  urgency: "low" | "med" | "high";
}

function inboxDir(slug: string): string {
  const d = path.join(agentDir(slug), "inbox");
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function archiveDir(slug: string): string {
  const d = path.join(agentDir(slug), "inbox-read");
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

/// 发消息 · 写到 recipient 的 inbox
export function sendMessage(msg: AgentMessage): void {
  if (!msg.to || msg.to === msg.from) return;
  const dir = inboxDir(msg.to);
  const ts = msg.ts || new Date().toISOString();
  const fname = `${ts.replace(/[:.]/g, "-")}-${msg.from}-${msg.urgency}.json`;
  const fpath = path.join(dir, fname);
  fs.writeFileSync(fpath, JSON.stringify({ ...msg, ts }, null, 2), "utf8");
}

/// 读 inbox · 不删 · readAndArchive 才搬
export function readInbox(slug: string, limit = 10): AgentMessage[] {
  const dir = inboxDir(slug);
  if (!fs.existsSync(dir)) return [];
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    const out: AgentMessage[] = [];
    for (const f of files.slice(-limit)) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as AgentMessage;
        out.push(m);
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

/// 读完后归档 · 防重复处理
export function archiveInbox(slug: string): void {
  const dir = inboxDir(slug);
  const archive = archiveDir(slug);
  if (!fs.existsSync(dir)) return;
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      try {
        fs.renameSync(path.join(dir, f), path.join(archive, f));
      } catch {}
    }
  } catch {}
}

/// 拿 inbox 待处理消息数
export function inboxCount(slug: string): number {
  const dir = inboxDir(slug);
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

// ─── V0.58 · agentskills.io 标准 skill 写入 ────────────
// 改自 NousResearch/hermes-agent 的自学习 loop
// 每跑 > N 跳 / 有信号 / 跨 agent 通信 · 写 skill
// 格式 · YAML frontmatter + Markdown · 兼容 Hermes Agent / Anthropic Skills

export interface AgentSkill {
  name: string;             // "kalshi-arb-window"
  description: string;      // 1 句 · 给检索用
  triggers: string[];       // ["cross-arb edge ≥ 6pp", "live game Q4"]
  category: string;         // "market-analysis"
  agent: string;            // 哪个虾写的
  used: number;             // 复用次数
  body: string;             // markdown 主体
}

function skillsDir(slug: string): string {
  const d = path.join(agentDir(slug), "skills");
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

/// 把 skill 写到 ~/.du4leaving/agents/<slug>/skills/<name>.md
/// 跟 NousResearch hermes-agent 文件结构兼容 (~/.hermes/skills/...)
export function writeSkill(slug: string, skill: AgentSkill): void {
  const dir = skillsDir(slug);
  const fname = skill.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase() + ".md";
  const fpath = path.join(dir, fname);
  const yaml = [
    "---",
    `name: ${skill.name}`,
    `description: ${JSON.stringify(skill.description)}`,
    `category: ${skill.category}`,
    `agent: ${skill.agent}`,
    `triggers:`,
    ...skill.triggers.map((t) => `  - ${JSON.stringify(t)}`),
    `used: ${skill.used}`,
    `created: ${new Date().toISOString()}`,
    "---",
    "",
    skill.body.trim(),
    "",
  ].join("\n");
  fs.writeFileSync(fpath, yaml, "utf8");
}

export function listSkills(slug: string): AgentSkill[] {
  const dir = skillsDir(slug);
  if (!fs.existsSync(dir)) return [];
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    return files.map((f) => parseSkill(path.join(dir, f))).filter((s): s is AgentSkill => s !== null);
  } catch {
    return [];
  }
}

function parseSkill(fpath: string): AgentSkill | null {
  try {
    const txt = fs.readFileSync(fpath, "utf8");
    const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) return null;
    const [, frontmatter, body] = m;
    // 极简 YAML parser (只做扁平 key:value · array 用 -)
    const result: Record<string, unknown> = {};
    let curArr: string[] | null = null;
    let curArrKey = "";
    for (const line of frontmatter.split("\n")) {
      const arrMatch = line.match(/^\s+-\s+(.+)$/);
      if (arrMatch && curArr) {
        curArr.push(arrMatch[1].replace(/^"(.*)"$/, "$1"));
        continue;
      }
      const kv = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!kv) { curArr = null; continue; }
      const [, key, valRaw] = kv;
      if (valRaw === "") {
        curArr = [];
        curArrKey = key;
        result[key] = curArr;
      } else {
        curArr = null;
        let val: unknown = valRaw;
        if (/^\d+$/.test(valRaw)) val = parseInt(valRaw, 10);
        else if (valRaw.startsWith('"')) val = JSON.parse(valRaw);
        result[key] = val;
      }
    }
    return {
      name: String(result.name ?? ""),
      description: String(result.description ?? ""),
      category: String(result.category ?? "general"),
      agent: String(result.agent ?? ""),
      triggers: Array.isArray(result.triggers) ? result.triggers as string[] : [],
      used: Number(result.used ?? 0),
      body: body.trim(),
    };
  } catch {
    return null;
  }
}

/// 拿一个 agent 全部 skills 数 (UI badge 用)
export function skillCount(slug: string): number {
  return listSkills(slug).length;
}

// ─── V0.59 · 读 ~/.claude/skills/ (花叔女娲产出) ─────

const CLAUDE_SKILLS_DIR = path.join(HOME, ".claude", "skills");

export interface DistilledPerson {
  slug: string;        // 文件夹名 · 如 "steve-jobs-skill"
  name: string;        // 从 SKILL.md frontmatter 抽
  description: string;
  category?: string;
  preview: string;     // 头 200 字
}

/// 列 ~/.claude/skills/ 下 *-skill/ 的人物 (女娲蒸馏产出)
export function listDistilledPeople(): DistilledPerson[] {
  if (!fs.existsSync(CLAUDE_SKILLS_DIR)) return [];
  try {
    const dirs = fs.readdirSync(CLAUDE_SKILLS_DIR).filter((d) => {
      const p = path.join(CLAUDE_SKILLS_DIR, d);
      try { return fs.statSync(p).isDirectory(); }
      catch { return false; }
    });
    const out: DistilledPerson[] = [];
    for (const d of dirs) {
      const skillFile = path.join(CLAUDE_SKILLS_DIR, d, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      try {
        const txt = fs.readFileSync(skillFile, "utf8");
        const fmMatch = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!fmMatch) continue;
        const frontmatter = fmMatch[1];
        const body = fmMatch[2];
        const nameM = frontmatter.match(/^name:\s*(.+)$/m);
        const descM = frontmatter.match(/^description:\s*(.+)$/m);
        const catM = frontmatter.match(/^category:\s*(.+)$/m);
        out.push({
          slug: d,
          name: (nameM?.[1] ?? d).replace(/^["']|["']$/g, ""),
          description: (descM?.[1] ?? "").replace(/^["']|["']$/g, ""),
          category: catM?.[1]?.replace(/^["']|["']$/g, ""),
          preview: body.replace(/\n+/g, " ").slice(0, 200),
        });
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

/// 简单 keyword match · 给 agent 推荐相关蒸馏人物
/// (将来用 embedding · v1 用 description / triggers 含关键词)
export function relevantDistilledPeople(keywords: string[], limit = 3): DistilledPerson[] {
  const all = listDistilledPeople();
  if (keywords.length === 0) return all.slice(0, limit);
  const lower = keywords.map((k) => k.toLowerCase());
  const scored = all.map((p) => {
    const text = (p.name + " " + p.description + " " + p.preview).toLowerCase();
    let score = 0;
    for (const k of lower) {
      if (text.includes(k)) score++;
    }
    return { p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.p);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hmm(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

/// 读 agent 长期记忆 · 不存在返回空字符串
export function readMemory(slug: string): string {
  const f = path.join(agentDir(slug), "MEMORY.md");
  if (!fs.existsSync(f)) return "";
  try { return fs.readFileSync(f, "utf8"); }
  catch { return ""; }
}

/// 读 agent 最近 N 天的 daily 日志
export function readRecentDaily(slug: string, days = 3): string {
  const dir = path.join(agentDir(slug), "daily");
  if (!fs.existsSync(dir)) return "";
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => /\.md$/.test(f))
      .sort()
      .slice(-days);
    return files.map((f) => {
      const p = path.join(dir, f);
      return `## ${f}\n${fs.readFileSync(p, "utf8")}`;
    }).join("\n\n");
  } catch {
    return "";
  }
}

/// 读 agent 最近 N 个输出 (从 daily 里抽)
export function readLatestOutputs(slug: string, limit = 5): AgentRunResult[] {
  const dir = path.join(agentDir(slug), "daily");
  if (!fs.existsSync(dir)) return [];
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.md$/.test(f)).sort().reverse();
    const out: AgentRunResult[] = [];
    for (const f of files.slice(0, 3)) {
      const content = fs.readFileSync(path.join(dir, f), "utf8");
      // 拆 ## section by timestamp
      const sections = content.split(/\n## /).filter(Boolean);
      for (let i = 0; i < sections.length; i++) {
        const s = i === 0 ? sections[i] : "## " + sections[i];
        const m = s.match(/^##\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\n/);
        if (!m) continue;
        out.push({
          agent: slug,
          ranAt: m[1],
          output_md: s.replace(/^##\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\n/, "").trim(),
          tool_calls: [],
          hops: 1,
          duration_ms: 0,
          provider: "?",
        });
        if (out.length >= limit) return out;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/// agent 跑一次 · 写 daily · 返回 result
export async function runAgent(
  identity: AgentIdentity,
  contextBuilder: () => Promise<string>
): Promise<AgentRunResult> {
  const t0 = Date.now();
  const ranAt = new Date();

  // V0.56 · 确保 IDENTITY/SOUL/CRON 文件存在 · 给用户编辑入口
  ensureIdentityFiles(identity);

  const dir = agentDir(identity.slug);
  // V0.56 · 从文件读 SOUL · 用户改了立刻生效
  const liveSoul = loadSoul(identity);

  try {
    // 1. 拼 system prompt
    const memory = readMemory(identity.slug);
    const recent = readRecentDaily(identity.slug, 2);

    // V0.57 · 读 inbox · 别人喊我的消息
    const incoming = readInbox(identity.slug, 10);

    // V0.59 · 拿相关蒸馏人物 (~/.claude/skills/) · 给灵感
    // 每个 agent 关注的关键词不一样
    const distillKeywords = (identity as { distill_keywords?: string[] }).distill_keywords ?? [];
    const distilled = distillKeywords.length > 0
      ? relevantDistilledPeople(distillKeywords, 3)
      : listDistilledPeople().slice(0, 2);

    const system = [
      `你是 ${identity.emoji} ${identity.name} · ${identity.role}`,
      ``,
      `【你的灵魂】`,
      liveSoul,
      ``,
      memory ? `【你的长期记忆】\n${memory.slice(0, 1500)}` : "",
      recent ? `【你最近 2 天写的】\n${recent.slice(0, 2000)}` : "",
      ``,
      distilled.length > 0 ? `【你能借鉴的人物 · 来自 ~/.claude/skills/ 蒸馏库】\n${distilled.map((d) => `· ${d.name} · ${d.description}`).join("\n")}\n（这些人的思路你可以化用 · 但用你自己的话说）\n` : "",
      ``,
      `【任务】`,
      `根据下面给你的实时上下文 · 写一篇你这次的简报 · 200-400 字 · 严格 markdown`,
      `第一行写 # 标题 (一句话主题)`,
      `用 ## 分段 · 不超 4 段`,
      `结尾 ## 一句话给 TZ · 给个具体动作建议`,
      `不要重复你已经写过的 · 看长期记忆里的`,
      ``,
      `【可用工具】 ${identity.tools.join(" / ")}`,
      `如果需要数据 · 输出 JSON {"tool_calls":[{"name":"X","args":{}}]}`,
      ``,
      `【消息能力 · V0.57 跨虾通信】`,
      `想给别的虾发消息 · 在 markdown 答里末尾加 ·`,
      `<<MSG to=laohu urgency=high>>`,
      `T1 vs Hanwha 这场 BUY $5k 老虎你重看下`,
      `<<END>>`,
      `多条 · 多个 <<MSG ... <<END>> 块`,
      `urgency · low / med / high`,
      `to · laohu / yazi / suanpan (不要发自己)`,
      ``,
      `否则直接 markdown 答`,
    ].filter(Boolean).join("\n");

    // 2. 上下文 · V0.57 加 inbox 头
    const contextStr = await contextBuilder();
    let userPrompt = contextStr;

    if (incoming.length > 0) {
      const inboxBlock = [
        "",
        `【你的 inbox · ${incoming.length} 条来自别的虾】`,
        ...incoming.map((m) =>
          `· [${m.urgency}] ${m.from} · ${m.subject}\n  ${m.body.replace(/\n/g, " ").slice(0, 200)}`
        ),
        "",
        "你这次跑可以呼应这些消息 · 比如承认收到 / 调用工具验证 / 反馈结论。",
      ].join("\n");
      userPrompt = inboxBlock + "\n\n" + userPrompt;
    }

    // 3. 多回合 (最多 2 跳 · 时间紧)
    let finalText = "";
    const tool_calls: Array<{ name: string; ok: boolean }> = [];
    let hops = 0;
    let provider = "static";

    for (let h = 0; h < 2; h++) {
      hops++;
      const result = await chat({
        system,
        user: userPrompt,
        jsonOutput: false,
        temperature: 0.4,
      });
      provider = result.provider;
      const text = result.text.trim();

      // 试 parse tool_calls
      const toolMatch = text.match(/^\{[\s\S]*"tool_calls"[\s\S]*\}$/);
      if (toolMatch) {
        try {
          const parsed = JSON.parse(toolMatch[0]) as { tool_calls?: ToolCall[] };
          if (parsed.tool_calls && parsed.tool_calls.length > 0) {
            const results = await Promise.all(parsed.tool_calls.slice(0, 2).map(executeTool));
            for (const r of results) {
              tool_calls.push({ name: r.name, ok: !r.error });
            }
            userPrompt = contextStr +
              "\n\n【工具结果】\n" +
              results.map(r =>
                `· ${r.name}: ${r.error ? "ERROR " + r.error : JSON.stringify(r.result).slice(0, 800)}`
              ).join("\n") +
              "\n\n现在写最终 markdown 简报。";
            continue;
          }
        } catch {}
      }

      finalText = text;
      break;
    }

    // V0.57 · 抽出 <<MSG ... <<END>> 块发出去
    const outgoingMessages = extractMessages(finalText, identity.slug);
    for (const msg of outgoingMessages) {
      sendMessage(msg);
    }
    // 从 markdown 移掉 MSG 块 · 给用户看的更干净
    const cleanedText = finalText.replace(/<<MSG[\s\S]*?<<END>>/g, "").trim();

    // 4. 写 daily
    const dailyFile = path.join(dir, "daily", `${ymd(ranAt)}.md`);
    const msgFooter = outgoingMessages.length > 0
      ? `\n_发了 ${outgoingMessages.length} 条消息 · ${outgoingMessages.map(m => "→" + m.to).join(" ")}_`
      : "";
    const block = `\n## ${ymd(ranAt)} ${hmm(ranAt)}\n${cleanedText}${msgFooter}\n`;
    if (fs.existsSync(dailyFile)) {
      fs.appendFileSync(dailyFile, block, "utf8");
    } else {
      fs.writeFileSync(dailyFile, `# ${identity.emoji} ${identity.name} · ${ymd(ranAt)}\n${block}`, "utf8");
    }

    // V0.57 · 处理过的 inbox 归档
    if (incoming.length > 0) {
      archiveInbox(identity.slug);
    }

    // V0.58 · 自学习 skill 写入 (改自 Hermes Agent 自反思 loop)
    // 当 hops ≥ 2 (说明用过工具) 且 cleanedText 长度 > 200 · 异步抽 skill
    // 不阻塞主流程
    if (hops >= 2 && cleanedText.length > 200 && tool_calls.length > 0) {
      void maybeWriteReflectionSkill(identity, cleanedText, tool_calls).catch(() => {});
    }

    // V0.56 · 写回 last_run · cron 用
    markCronRan(identity.slug);

    return {
      agent: identity.slug,
      ranAt: ranAt.toISOString(),
      output_md: cleanedText,
      tool_calls,
      hops,
      duration_ms: Date.now() - t0,
      provider,
    };
  } catch (e) {
    return {
      agent: identity.slug,
      ranAt: ranAt.toISOString(),
      output_md: "",
      tool_calls: [],
      hops: 0,
      duration_ms: Date.now() - t0,
      provider: "static",
      error: (e as Error).message,
    };
  }
}

// V0.58 · 反思 skill 写入 (Hermes Agent 自学习 loop)
// 从最近一次 task 抽 pattern · 让 agent 越用越 sharp
async function maybeWriteReflectionSkill(
  identity: AgentIdentity,
  recentOutput: string,
  toolCalls: Array<{ name: string; ok: boolean }>
): Promise<void> {
  const usedTools = toolCalls.filter(t => t.ok).map(t => t.name);
  if (usedTools.length === 0) return;

  // 限频 · 同 agent 同小时只写 1 个 skill
  const dir = skillsDir(identity.slug);
  const now = Date.now();
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const stat = fs.statSync(path.join(dir, f));
      if (now - stat.mtimeMs < 3600 * 1000) return;     // 1h 内已写
    }
  } catch {}

  const reflectPrompt = [
    "你是一个反思器。基于这次 agent 跑的输出 + 工具使用记录,",
    "判断是否值得抽出一个可复用的 skill (一个解决某类问题的方法)。",
    "",
    `agent: ${identity.name}`,
    `工具用过: ${usedTools.join(", ")}`,
    `输出: ${recentOutput.slice(0, 800)}`,
    "",
    "如果值得 · 输出 JSON ·",
    `{ "name": "kalshi-arb-window", "description": "1 句", "category": "...", "triggers": ["..."], "body": "## 何时用\\n...\\n## 怎么做\\n..." }`,
    "如果不值得 (太琐碎 / 一次性) · 输出 {\"skip\": true}",
  ].join("\n");

  try {
    const { chat } = await import("@/lib/xiapan/llm");
    const result = await chat({
      system: "你是反思器 · 严格 JSON 输出。",
      user: reflectPrompt,
      jsonOutput: true,
      temperature: 0.3,
    });
    const parsed = JSON.parse(result.text) as {
      skip?: boolean;
      name?: string;
      description?: string;
      category?: string;
      triggers?: string[];
      body?: string;
    };
    if (parsed.skip || !parsed.name || !parsed.body) return;
    writeSkill(identity.slug, {
      name: parsed.name,
      description: parsed.description ?? "",
      category: parsed.category ?? "general",
      agent: identity.slug,
      triggers: parsed.triggers ?? [],
      used: 0,
      body: parsed.body,
    });
  } catch {}
}

/// 从 agent 输出抽出 <<MSG to=X urgency=Y>> ... <<END>> 块
function extractMessages(text: string, fromSlug: string): AgentMessage[] {
  const out: AgentMessage[] = [];
  const re = /<<MSG\s+([^>]*)>>\s*([\s\S]*?)\s*<<END>>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const meta = m[1].trim();
    const body = m[2].trim();
    if (!body) continue;
    const toMatch = meta.match(/to=([a-z0-9_-]+)/i);
    const urgMatch = meta.match(/urgency=(low|med|high)/i);
    const subjMatch = meta.match(/subject=([^\s]+)/i);
    const to = toMatch?.[1] ?? "";
    if (!to || to === fromSlug) continue;
    const urgency = (urgMatch?.[1] as "low" | "med" | "high") ?? "med";
    const subject = subjMatch?.[1] ?? body.slice(0, 60);
    out.push({
      from: fromSlug,
      to,
      ts: new Date().toISOString(),
      subject,
      body,
      urgency,
    });
  }
  return out;
}
