// /api/xiapan/intel/digest
//
// V0.62 · 每日 8AM 写 markdown digest
// 综合 markets/news/yn-signals/whales-top/picks · LLM 写 1 页 essay
//
// fork 自 CloudFlare-AI-Insight-Daily 模板思路
// 跑流 · 拉 4 源 → Hermes/Ollama 综合 → 写文件 +
//        返回 markdown · 给 IntelView 看
//
// 触发 ·
//   GET 手动跑 (UI 触发)
//   GET ?cron=1 (Vercel Cron 用 · 设 CRON_SECRET 验证)
// 文件路径 · ~/.du4leaving/digest/YYYY-MM-DD.md (一天一个 · 跨次 append)

import { NextResponse } from "next/server";
import { chat } from "@/lib/xiapan/llm";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

const HOME = os.homedir();
const DIGEST_DIR = path.join(HOME, ".du4leaving", "digest");

interface DigestPayload {
  ok: boolean;
  generatedAt: string;
  date: string;
  digest_md: string;
  cached: boolean;
  provider: string;
  inputs: {
    markets: number;
    news: number;
    yn_signals: number;
    whales: number;
  };
  error?: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ensureDigestDir() {
  if (!fs.existsSync(DIGEST_DIR)) fs.mkdirSync(DIGEST_DIR, { recursive: true });
}

async function fetchAll() {
  const [m, n, y, w, p] = await Promise.all([
    fetch(`${URL_PREFIX}/api/xiapan/intel/markets?limit=10`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
    fetch(`${URL_PREFIX}/api/xiapan/intel/news?limit=10`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
    fetch(`${URL_PREFIX}/api/xiapan/intel/yn-signals?limit=8`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
    fetch(`${URL_PREFIX}/api/xiapan/intel/whales-top?limit=5`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
    fetch(`${URL_PREFIX}/api/xiapan/picks?min=55&limit=5`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
  ]);
  return {
    markets: m.markets ?? [],
    news: n.news ?? [],
    yn: y.signals ?? [],
    whales: w.whales ?? [],
    picks: p.picks ?? [],
  };
}

const SYSTEM = `你是 du4leaving 早间简报员
风格 · 沉稳 · 中文 · 严格不用术语 · 用了必括号解释
长度 · 400-600 字
结构 · 严格 markdown ·

# 早间简报 · YYYY-MM-DD

## 一句话总览
[今天最值得知道的一件事 · 一句]

## 最该看的 3 件
1. [事件] · [发生了什么] · [为什么重要]
...

## 大户在动什么
[2-3 句 · 关注哪些钱包 / 哪些标的]

## App 推的 1 单
[picks 引擎 top · 题目 + 押向 + 价 + 1 句理由]

## 风险 / 留意
[1-2 条具体]

只输出 markdown · 不要其它。
不要瞎猜数据 · 没数据就承认"今早数据稀薄"。`;

async function buildDigest(): Promise<{ md: string; provider: string; inputs: DigestPayload["inputs"] }> {
  const data = await fetchAll();

  const inputs: DigestPayload["inputs"] = {
    markets: data.markets.length,
    news: data.news.length,
    yn_signals: data.yn.length,
    whales: data.whales.length,
  };

  const userPrompt = [
    `# 今天 ${new Date().toISOString().slice(0, 10)} 的素材`,
    "",
    `## 在动事件 (top ${data.markets.length})`,
    ...data.markets.slice(0, 6).map((m: { platform: string; title: string; price_shift_pp: number; vol_24h: number; best_yes_price?: number }) =>
      `· [${m.platform}] ${m.title} · ${m.price_shift_pp >= 0 ? "+" : ""}${m.price_shift_pp.toFixed(1)}pp · vol $${Math.round(m.vol_24h)}` +
      (m.best_yes_price ? ` · YES ${Math.round(m.best_yes_price)}¢` : "")
    ),
    "",
    `## 实时新闻 (top ${Math.min(data.news.length, 5)})`,
    ...data.news.slice(0, 5).map((n: { source: string; title: string; lang: string; sentiment?: string; age_minutes: number }) =>
      `· [${n.source} ${n.lang}${n.sentiment === "positive" ? "+" : n.sentiment === "negative" ? "-" : ""}] ${n.title} · ${n.age_minutes}min 前`
    ),
    "",
    `## YN Telegram 信号 (top ${Math.min(data.yn.length, 5)})`,
    ...data.yn.slice(0, 5).map((s: { urgency: string; text: string; age_minutes: number }) =>
      `· [${s.urgency}] ${s.text.slice(0, 100)} · ${s.age_minutes}min 前`
    ),
    "",
    `## 鲸鱼活动 (top ${Math.min(data.whales.length, 4)})`,
    ...data.whales.slice(0, 4).map((w: { display_name: string; vol_24h_usd: number; total_position_value: number; total_position_pnl: number; positions_count: number }) =>
      `· ${w.display_name} · 24h $${Math.round(w.vol_24h_usd)} · 当前仓 $${Math.round(w.total_position_value)} · PnL ${w.total_position_pnl >= 0 ? "+" : ""}$${Math.round(w.total_position_pnl)} · ${w.positions_count} 个仓`
    ),
    "",
    `## App picks 引擎 top (≥55 分)`,
    ...data.picks.slice(0, 3).map((p: { score: number; title: string; buy_side: string; buy_price_c: number; reasons?: string[] }) =>
      `· ${p.score}分 · ${p.title} · 押「${p.buy_side === "yes" ? "会" : "不会"}」${p.buy_price_c}¢` +
      (p.reasons ? ` · ${p.reasons.slice(0, 2).join(" / ")}` : "")
    ),
  ].join("\n");

  try {
    const result = await chat({
      system: SYSTEM,
      user: userPrompt,
      jsonOutput: false,
      temperature: 0.3,
    });
    return {
      md: result.text.trim(),
      provider: result.provider,
      inputs,
    };
  } catch (e) {
    return {
      md: `# 早间简报 · ${new Date().toISOString().slice(0, 10)}\n\n_LLM 暂时不可用 · 看素材自己组织 (${(e as Error).message})_\n\n` + userPrompt,
      provider: "static",
      inputs,
    };
  }
}

function readCachedDigest(date: string): string | null {
  const f = path.join(DIGEST_DIR, `${date}.md`);
  if (!fs.existsSync(f)) return null;
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return null;
  }
}

function writeDigest(date: string, md: string) {
  ensureDigestDir();
  const f = path.join(DIGEST_DIR, `${date}.md`);
  // 同一天 · 用最新的覆盖 (不 append · 简洁)
  fs.writeFileSync(f, md, "utf8");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("cron") === "1";
  const force = url.searchParams.get("force") === "1";
  const date = ymd(new Date());

  // Cron 验证
  if (isCron) {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.headers.get("authorization") ?? "";
      if (got !== `Bearer ${expected}`) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }
  }

  // 已 cache 直接返
  if (!force) {
    const cached = readCachedDigest(date);
    if (cached) {
      return NextResponse.json<DigestPayload>({
        ok: true,
        generatedAt: new Date().toISOString(),
        date,
        digest_md: cached,
        cached: true,
        provider: "cache",
        inputs: { markets: 0, news: 0, yn_signals: 0, whales: 0 },
      });
    }
  }

  try {
    const { md, provider, inputs } = await buildDigest();
    writeDigest(date, md);
    return NextResponse.json<DigestPayload>({
      ok: true,
      generatedAt: new Date().toISOString(),
      date,
      digest_md: md,
      cached: false,
      provider,
      inputs,
    });
  } catch (e) {
    return NextResponse.json<DigestPayload>(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        date,
        digest_md: "",
        cached: false,
        provider: "static",
        inputs: { markets: 0, news: 0, yn_signals: 0, whales: 0 },
        error: (e as Error).message,
      },
      { status: 200 }
    );
  }
}
