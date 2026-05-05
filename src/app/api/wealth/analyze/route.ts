// /api/wealth/analyze · 通用 ticker 分析 (#6)
// 自动识别 · 股票 / 加密 / Kalshi
// 调用 ·
//   ?ticker=BTC-USD    → Coinbase spot
//   ?ticker=AAPL       → Yahoo Finance
//   ?ticker=KX...      → Kalshi public + LLM 公允估
//   ?ticker=https://kalshi.com/...   → 解析 ticker

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function classifyTicker(input: string): { kind: "kalshi" | "crypto" | "stock"; ticker: string; pair?: string } {
  const t = input.trim();
  // Kalshi URL
  if (/kalshi\.com.*markets?\//i.test(t)) {
    const m = t.match(/markets?\/[^\/]+\/[^\/]+\/([\w-]+)/i);
    if (m) return { kind: "kalshi", ticker: m[1].toUpperCase() };
  }
  // KX prefix · Kalshi
  if (/^KX/i.test(t)) return { kind: "kalshi", ticker: t.toUpperCase() };
  // Crypto pair · BTC-USD / ETH-USD / SOL-USDC etc.
  if (/^(btc|eth|sol|doge|ada|bnb|xrp|hype|matic|link)([-/](usd|usdc|usdt))?$/i.test(t)) {
    const base = t.split(/[-/]/)[0].toUpperCase();
    return { kind: "crypto", ticker: base, pair: `${base}-USD` };
  }
  // 股票 · 1-5 大写字母 · 默认股票
  if (/^[A-Z]{1,5}$/.test(t)) return { kind: "stock", ticker: t };
  // 含字母 + 数字 · Kalshi 的特殊 series
  if (/^[A-Z0-9]+$/i.test(t) && t.length > 5) return { kind: "kalshi", ticker: t.toUpperCase() };
  // 默认假定 Kalshi
  return { kind: "kalshi", ticker: t.toUpperCase() };
}

async function analyzeKalshi(ticker: string): Promise<any> {
  // 复用现有 endpoint
  const baseHost = process.env.NEXT_PUBLIC_BASE_URL || "";
  const r = await fetch(`https://du4leaving.vercel.app/api/xiapan/baichuan/analyze?ticker=${encodeURIComponent(ticker)}`).catch(() => null);
  if (r && r.ok) return r.json();
  return { ok: false, error: "Kalshi 分析端点无响应" };
}

async function analyzeCrypto(pair: string): Promise<any> {
  // Coinbase spot · 不需 auth · 不需 key
  try {
    const r = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { ok: false, error: `Coinbase HTTP ${r.status}` };
    const d = await r.json();
    const price = parseFloat(d.data?.amount || "0");
    // 24h change
    const r24 = await fetch(`https://api.coinbase.com/v2/prices/${pair}/historic?period=day`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    let day_change_pct = 0;
    let day_high = 0;
    let day_low = 0;
    if (r24 && r24.ok) {
      const d24 = await r24.json();
      const prices = d24.data?.prices || [];
      if (prices.length > 1) {
        const first = parseFloat(prices[prices.length - 1].price);
        const last = parseFloat(prices[0].price);
        day_change_pct = ((last - first) / first) * 100;
        day_high = Math.max(...prices.map((p: any) => parseFloat(p.price)));
        day_low = Math.min(...prices.map((p: any) => parseFloat(p.price)));
      }
    }
    return {
      ok: true,
      kind: "crypto",
      ticker: pair,
      price_usd: +price.toFixed(2),
      day_change_pct: +day_change_pct.toFixed(2),
      day_high: +day_high.toFixed(2),
      day_low: +day_low.toFixed(2),
      reasoning: `${pair} 现价 $${price.toFixed(2)} · 24h ${day_change_pct >= 0 ? "+" : ""}${day_change_pct.toFixed(2)}%`,
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function analyzeStock(ticker: string): Promise<any> {
  // Yahoo Finance v8 · 不需 auth
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, error: `Yahoo HTTP ${r.status}` };
    const d = await r.json();
    const result = d.chart?.result?.[0];
    if (!result) return { ok: false, error: "Yahoo 无数据" };
    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const lastClose = parseFloat(meta.regularMarketPrice || closes[closes.length - 1]);
    const prevClose = parseFloat(meta.previousClose || closes[closes.length - 2] || lastClose);
    const day_change_pct = ((lastClose - prevClose) / prevClose) * 100;
    return {
      ok: true,
      kind: "stock",
      ticker,
      name: meta.longName || meta.symbol,
      price_usd: +lastClose.toFixed(2),
      prev_close: +prevClose.toFixed(2),
      day_change_pct: +day_change_pct.toFixed(2),
      day_high: +(meta.regularMarketDayHigh || 0).toFixed(2),
      day_low: +(meta.regularMarketDayLow || 0).toFixed(2),
      day_volume: meta.regularMarketVolume,
      market_state: meta.marketState,
      reasoning: `${meta.symbol} (${meta.longName || ""}) · 现 $${lastClose.toFixed(2)} · 日 ${day_change_pct >= 0 ? "+" : ""}${day_change_pct.toFixed(2)}%`,
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const input = url.searchParams.get("ticker") || url.searchParams.get("url") || "";
  if (!input) {
    return NextResponse.json({ ok: false, error: "缺 ?ticker=" }, { status: 400 });
  }
  const parsed = classifyTicker(input);
  let result: any;
  if (parsed.kind === "kalshi") result = await analyzeKalshi(parsed.ticker);
  else if (parsed.kind === "crypto") result = await analyzeCrypto(parsed.pair!);
  else if (parsed.kind === "stock") result = await analyzeStock(parsed.ticker);
  else result = { ok: false, error: "未知类型" };

  return NextResponse.json({ ok: result.ok ?? true, kind: parsed.kind, parsed_ticker: parsed.ticker, ...result });
}
