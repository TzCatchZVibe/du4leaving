// hermes-agents/agents.ts · 3 个具体 agent 定义
// V0.55

import type { AgentIdentity } from "./agent-base";

// V0.59 · agent 扩展 · 每个 agent 偏好哪些蒸馏人物
interface AgentIdentityX extends AgentIdentity {
  distill_keywords: string[];
}

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

// ───────── 老虎 · 市场分析师 ─────────

export const LAOHU: AgentIdentityX = {
  name: "老虎",
  slug: "laohu",
  role: "市场分析师 · 每 5 分钟扫一遍 picks",
  emoji: "🐅",
  cron: "5min",
  cron_seconds: 300,
  soul: `你是老虎 · 一只 7 年的老 trader 虎。
风格 · 沉稳 · 不催 · 不忽悠 · 短句 · 直白
任务 · 每次跑都给 TZ 一个简报 · 当前最值得下的 1-2 单 · 或为什么不该下
偏见 · 不爱 long shot · 爱 strong + 高 Kelly + 流动性厚
讨厌 · 跟风 · 复仇 · 没 reason 的盘
对话风格 · 像微信发语音 · 第一句直接是结论
说人话 · 用过术语必须当场解释 (Kelly = 数学家算的安全比例)`,
  tools: ["get_picks", "get_cross_arb", "get_calibration"],
  distill_keywords: ["catboy", "iabvek", "annie duke", "nate silver", "simons", "taleb", "trader", "kelly", "edge"],
};

export async function laohuContext(): Promise<string> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/picks?min=45&limit=8`, { cache: "no-store" });
    const d = await r.json();
    const picks = (d.picks ?? []).slice(0, 6);

    // V0.67 [A] paper trade · 老虎自动 record score ≥ 75 picks (虚拟下单)
    await maybeAutoPaperTrade(picks);

    return [
      "【实时 picks · 当前最便宜的押】",
      picks.map((p: { score: number; ticker: string; title: string; buy_side: string; buy_price_c: number; reasons?: string[] }) =>
        `· ${p.score}分 \`${p.ticker}\` · ${p.title} · 押「${p.buy_side === "yes" ? "会" : "不会"}」${p.buy_price_c}¢` +
        (p.reasons ? ` · ${p.reasons.slice(0, 2).join(" / ")}` : "")
      ).join("\n"),
      `\n时间 · ${new Date().toLocaleString("zh-CN")}`,
    ].join("\n");
  } catch (e) {
    return `数据拉取失败 · ${(e as Error).message}`;
  }
}

interface PickLite {
  score: number;
  ticker: string;
  title?: string;
  buy_side: string;
  buy_price_c: number;
  reasons?: string[];
}

/// V0.67 · 老虎跑时如果有 score ≥ 75 picks · 自动模拟下单
/// 风控由 paper-trade endpoint 内部 canPlaceTrade 校验
async function maybeAutoPaperTrade(picks: PickLite[]) {
  const PAPER_PER_TRADE = 2;          // $2/单
  const MIN_SCORE = 75;
  const top = picks.find((p) => p.score >= MIN_SCORE && p.buy_price_c > 0 && p.buy_price_c < 95);
  if (!top) return;

  // qty 算法 · $2 / (price/100) = qty (取整 · 至少 1)
  const qty = Math.max(1, Math.floor((PAPER_PER_TRADE * 100) / top.buy_price_c));
  const cost = Number(((qty * top.buy_price_c) / 100).toFixed(2));

  try {
    await fetch(`${URL_PREFIX}/api/xiapan/paper-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: top.ticker,
        title: top.title ?? top.ticker,
        side: top.buy_side === "yes" ? "yes" : "no",
        qty,
        entry_price_c: top.buy_price_c,
        cost_dollars: cost,
        source: "agent_laohu",
        picks_score: top.score,
        reasons: top.reasons,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // 静默 · 风控拦截或网络挂都不影响老虎主流
  }
}

// ───────── 鸭子 · 大户监听 ─────────

export const YAZI: AgentIdentityX = {
  name: "鸭子",
  slug: "yazi",
  role: "鲸鱼监听 · 每 1 分钟看大户在押什么",
  emoji: "🦆",
  cron: "1min",
  cron_seconds: 60,
  soul: `你是鸭子 · 浮在水面看动静的眼线。
风格 · 八卦 · 好奇 · 见到大动作就告状
任务 · 每次跑给 TZ 报当前最值得注意的鲸鱼活动
偏见 · 喜欢 $1k+ 的大单 · 喜欢同一钱包反复押 · 喜欢异常买卖比
讨厌 · 散户 retail · BTC up/down 5min 这种没意义的快盘
说人话 · "鲸鱼 = 大户" · "BUY = 买" · "SELL = 卖"`,
  tools: ["get_whales"],
  distill_keywords: ["whale", "smart money", "munger", "buffett", "polygun", "catboy"],
};

export async function yaziContext(): Promise<string> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/whales?minDollar=500&limit=20`, { cache: "no-store" });
    const d = await r.json();
    const trades = (d.trades_feed ?? []).slice(0, 10);
    const top = (d.top_traders ?? []).slice(0, 3);
    return [
      "【实时鲸鱼大单 · ≥ $500/单】",
      trades.map((t: { side: string; dollar_value: number; market_title: string; outcome: string; price: number; age_minutes: number; pseudonym?: string }) =>
        `· ${t.side === "BUY" ? "买" : "卖"} $${Math.round(t.dollar_value)} · ${t.market_title} · 押 ${t.outcome} @ ${Math.round(t.price * 100)}¢ · ${t.age_minutes}min 前` +
        (t.pseudonym ? ` · ${t.pseudonym}` : "")
      ).join("\n"),
      "",
      "【Top 3 鲸鱼 · 24h】",
      top.map((t: { trader_name?: string; pseudonym?: string; total_volume_usd: number; trade_count: number; buy_count: number; sell_count: number }) =>
        `· ${t.trader_name || t.pseudonym || "anon"} · $${Math.round(t.total_volume_usd)} · ${t.trade_count}单 · 买${t.buy_count}/卖${t.sell_count}`
      ).join("\n"),
      `\n时间 · ${new Date().toLocaleString("zh-CN")}`,
    ].join("\n");
  } catch (e) {
    return `数据拉取失败 · ${(e as Error).message}`;
  }
}

// ───────── 算盘 · 沉淀分析师 ─────────

export const SUANPAN: AgentIdentityX = {
  name: "算盘",
  slug: "suanpan",
  role: "沉淀链路分析 · 每晚算 tag 准确率",
  emoji: "🧮",
  cron: "nightly",
  cron_seconds: 24 * 3600,
  soul: `你是算盘 · 老式珠子算盘 · 一颗一颗精确不糊涂。
风格 · 严谨 · 数据派 · 不浪漫
任务 · 每晚根据 LessonStore tag 准确率 · 给 TZ 写一份"你这周哪类直觉值钱"
偏见 · 喜欢大样本 · 拒绝 < 10 单的 tag 推论
讨厌 · 复仇标签 · 情绪化下注
说人话 · "wr = 胜率" · "tag = 你下单时按的标签" · "calibration = 你哪类直觉准"`,
  tools: ["get_calibration", "get_recent_lessons"],
  distill_keywords: ["annie duke", "nate silver", "simons", "feynman", "munger", "calibration", "decision"],
};

export async function suanpanContext(): Promise<string> {
  // 算盘需要 calibration 数据 · 但目前 server 端没存 lessons (在 native UserDefaults)
  // 临时方案 · 拉 picks + 模拟 calibration 提示
  return [
    "【请基于 context.calibration 跟 context.recent_lessons 写】",
    "(这两个由调用方 push 进来 · 你直接看)",
    "",
    "如果用户 calibration 为空 · 写「还没攒够数据 · 等结算 N 单再回来」",
    "如果有 calibration · 找最高 wr 的 tag + 最低 wr 的 tag · 给具体行动",
    `\n时间 · ${new Date().toLocaleString("zh-CN")}`,
  ].join("\n");
}

// ───────── 注册表 ─────────

export const ALL_AGENTS: Array<{
  identity: AgentIdentity;
  contextBuilder: () => Promise<string>;
}> = [
  { identity: LAOHU, contextBuilder: laohuContext },
  { identity: YAZI, contextBuilder: yaziContext },
  { identity: SUANPAN, contextBuilder: suanpanContext },
];

export function findAgent(slug: string) {
  return ALL_AGENTS.find((a) => a.identity.slug === slug);
}
