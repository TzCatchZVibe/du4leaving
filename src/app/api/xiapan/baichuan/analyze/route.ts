// /api/xiapan/baichuan/analyze · A · Kalshi ticker 分析 endpoint
// V0.73 W1 D1 · 4-mode co-pilot 第 1 模式 · TZ 手动玩 + AI 当军师
//
// 用法 ·
//   GET /api/xiapan/baichuan/analyze?ticker=KXWTACHALLENGERMATCH-26MAY03PANWON
//   GET /api/xiapan/baichuan/analyze?url=https://kalshi.com/markets/.../...
//
// 返回 ·
//   {
//     ok: true,
//     ticker, market_status, last_price, yes_bid, yes_ask, volume_24h,
//     warnings: [],
//     fair_prob: 0.38,
//     ev_pct: -12.5,
//     recommendation: "pass / hold / close / 加仓",
//     reasoning: "LLM 1-3 句"
//   }

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

function parseTicker(input: string): string | null {
  if (!input) return null;
  if (input.startsWith("http")) {
    const m = input.match(/markets\/[^\/]+\/[^\/]+\/([\w-]+)/i);
    return m ? m[1].toUpperCase() : null;
  }
  return input.trim().toUpperCase();
}

async function fetchMarket(ticker: string): Promise<any> {
  const url = `${KALSHI}/markets/${encodeURIComponent(ticker)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.ok) return res.json();
  // 试当作 event
  const evUrl = `${KALSHI}/events/${encodeURIComponent(ticker)}`;
  const evRes = await fetch(evUrl, { headers: { Accept: "application/json" } });
  if (!evRes.ok) throw new Error(`Kalshi 找不到 ticker · ${ticker}`);
  const ev = await evRes.json();
  if (!ev.markets?.length) throw new Error(`Event 无 markets · ${ticker}`);
  return { market: ev.markets[0], _event: ev.event };
}

async function llmFairProb(input: {
  ticker: string;
  title: string;
  yesSubtitle: string;
  lastPrice: number;
  status: string;
  closeTs?: string;
  eventTitle?: string;
}): Promise<{ fairProb: number | null; reasoning: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { fairProb: null, reasoning: "OPENAI_API_KEY 未设" };
  const prompt = `你是预测市场分析师 · 估公允概率。

市场 · ${input.ticker}
事件 · ${input.eventTitle || ""}
问题 · ${input.title}
押 YES 代表 · ${input.yesSubtitle}
当前价 · ${input.lastPrice ? (input.lastPrice * 100).toFixed(0) + "¢" : "未知"}
状态 · ${input.status}
截止 · ${input.closeTs ? new Date(input.closeTs).toLocaleString() : "未知"}

任务 ·
1 · 估 YES 真实发生概率 (0-100 整数)
2 · 1-3 句话说理由 (基于公开信息 · 历史 base rate · 常识)
3 · 如果信息不够 · 直接说 "信息不足"

只返回 JSON · 无别的 ·
{"prob": <0-100 整数>, "reasoning": "<≤80 字>"}
`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { fairProb: null, reasoning: `OpenAI ${res.status}` };
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    if (typeof parsed.prob !== "number") return { fairProb: null, reasoning: parsed.reasoning || "解析失败" };
    return { fairProb: parsed.prob / 100, reasoning: parsed.reasoning || "" };
  } catch (e: any) {
    return { fairProb: null, reasoning: `LLM 失败 · ${e.message}` };
  }
}

function evAt(price: number, fairProb: number) {
  return (fairProb - price) / price;
}

function recommend(price: number, fairProb: number | null, status: string, result: string | null) {
  if (status === "settled" || status === "finalized" || status === "resolved") {
    if (result === "yes") return "已结算 · YES 赢 · yes 仓全收 / no 仓 0";
    if (result === "no")  return "已结算 · NO 赢 · yes 仓 0 / no 仓全收";
    return `已结算 · result=${result || "?"}`;
  }
  if (status === "inactive") return "trading halted · 锁仓 · 等结算";
  if (fairProb == null) return "无 LLM 公允价 · 自己判断";
  const ev = evAt(price, fairProb);
  const evPct = (ev * 100).toFixed(1);
  if (ev > 0.05) return `★ 加仓 (+EV ${evPct}%)`;
  if (ev > 0)    return `hold (+EV ${evPct}%)`;
  if (ev > -0.05) return `hold 观望 (-EV ${evPct}%)`;
  return `close 止损 (-EV ${evPct}%)`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = parseTicker(url.searchParams.get("ticker") || url.searchParams.get("url") || "");
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "缺 ?ticker= 或 ?url=" }, { status: 400 });
  }

  let raw: any;
  try {
    raw = await fetchMarket(ticker);
  } catch (e: any) {
    return NextResponse.json({ ok: false, ticker, error: e.message }, { status: 404 });
  }

  const m = raw.market || raw;
  const yesBid = (m.yes_bid ?? 0) / 100;
  const yesAsk = (m.yes_ask ?? 0) / 100;
  const lastPrice = (m.last_price ?? 0) / 100;
  const status = m.status;
  const result = m.result || null;
  const volume = m.volume_24h ?? 0;
  const liquidity = m.liquidity ?? 0;
  const closeTs = m.close_time || m.expiration_time;

  const warnings: string[] = [];
  if (["settled", "finalized", "resolved", "closed"].includes(status))
    warnings.push(`已结算 · result=${result || "?"}`);
  if (status === "inactive") warnings.push("trading halted · 锁仓");
  if (yesAsk > 0 && yesBid > 0 && yesAsk - yesBid > 0.05)
    warnings.push(`spread 大 · ${(yesBid * 100).toFixed(0)}/${(yesAsk * 100).toFixed(0)}¢`);
  if (volume > 0 && volume < 50)
    warnings.push(`成交量低 · 24h ${volume}`);
  if (lastPrice > 0 && (lastPrice <= 0.05 || lastPrice >= 0.95))
    warnings.push(`极端价 · ${(lastPrice * 100).toFixed(0)}¢`);

  // LLM 估值 (只在 active / open 市场跑)
  let fairProb: number | null = null;
  let reasoning = "";
  if (status === "active" || status === "open" || status === "initialized") {
    const r = await llmFairProb({
      ticker: m.ticker || ticker,
      title: m.title || "",
      yesSubtitle: m.yes_sub_title || "",
      lastPrice,
      status,
      closeTs,
      eventTitle: raw._event?.title || "",
    });
    fairProb = r.fairProb;
    reasoning = r.reasoning;
  }

  const evPct = fairProb != null && lastPrice > 0
    ? +((evAt(lastPrice, fairProb) * 100).toFixed(1))
    : null;

  return NextResponse.json({
    ok: true,
    ticker: m.ticker || ticker,
    title: m.title,
    yes_subtitle: m.yes_sub_title,
    market_status: status,
    result,
    last_price: lastPrice,
    yes_bid: yesBid,
    yes_ask: yesAsk,
    volume_24h: volume,
    liquidity,
    close_time: closeTs,
    warnings,
    fair_prob: fairProb,
    ev_pct: evPct,
    recommendation: recommend(lastPrice, fairProb, status, result),
    reasoning,
  });
}
