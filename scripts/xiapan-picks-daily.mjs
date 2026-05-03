// xiapan-picks-daily.mjs · 每日 5 单 +EV 推荐 · 独立 · 不依赖 du4leaving 后端
// 用法 ·
//   node scripts/xiapan-picks-daily.mjs [--limit 5] [--category sports] [--min-ev 5]
//
// 输出 ·
//   每条 · ticker / 当前价 / LLM 公允估算 / EV / 推荐方向

import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.env.HOME, "du4leaving", ".env.local");
  try {
    const txt = fs.readFileSync(envPath, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_]+)=["']?([^"']+)["']?\s*$/);
      if (m) process.env[m[1]] = process.env[m[1]] || m[2];
    }
  } catch {}
}
loadEnv();

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

// 默认扫的系列 · 信号源足 + 流动性 OK
const DEFAULT_SERIES = [
  "KXBTCDAILY",         // BTC 日内
  "KXETHDAILY",         // ETH 日内
  "KXSOLDAILY",         // SOL 日内
  "KXWTACHALLENGERMATCH", // WTA 125 网球
  "KXATPCHALLENGERMATCH", // ATP 125 网球
  "KXUSPRESELECT",      // 政治
];

async function listOpenMarkets(seriesTicker, limit = 20) {
  const url = `${KALSHI}/events?series_ticker=${seriesTicker}&status=open&limit=${limit}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const d = await res.json();
  const markets = [];
  for (const ev of d.events || []) {
    const evUrl = `${KALSHI}/events/${ev.event_ticker}`;
    const evRes = await fetch(evUrl, { headers: { Accept: "application/json" } });
    if (!evRes.ok) continue;
    const evData = await evRes.json();
    for (const m of evData.markets || []) {
      if (m.status === "active" || m.status === "open" || m.status === "initialized") {
        markets.push({ ...m, _event_title: evData.event?.title });
      }
    }
  }
  return markets;
}

async function llmEstimate(market) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const lastPrice = (market.last_price ?? 0) / 100;
  const prompt = `预测市场分析师 · 估 YES 真概率。

市场 · ${market.ticker}
事件 · ${market._event_title || ""}
问题 · ${market.title}
押 YES · ${market.yes_sub_title}
当前 · ${(lastPrice * 100).toFixed(0)}¢

返回 JSON · 无别的 ·
{"prob": <0-100 整数>, "reason": "<≤60 字>"}`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 150,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const text = d.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    if (typeof parsed.prob !== "number") return null;
    return { fairProb: parsed.prob / 100, reason: parsed.reason || "" };
  } catch {
    return null;
  }
}

function ev(price, fairProb) {
  return (fairProb - price) / price;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[args.indexOf("--limit") + 1]) || 5;
  const minEvPct = parseFloat(args[args.indexOf("--min-ev") + 1]) || 5;

  console.log("扫 markets…");
  const all = [];
  for (const ser of DEFAULT_SERIES) {
    const ms = await listOpenMarkets(ser, 10);
    console.log(`  ${ser} · ${ms.length} markets`);
    all.push(...ms);
  }
  console.log(`共 ${all.length} 候选 · LLM 估值中…`);

  // LLM 限速 · 一次 5 个 · 节流
  const scored = [];
  for (let i = 0; i < all.length; i += 5) {
    const batch = all.slice(i, i + 5);
    const results = await Promise.all(batch.map(async (m) => {
      const lastPrice = (m.last_price ?? 0) / 100;
      if (lastPrice <= 0 || lastPrice >= 1) return null;
      const est = await llmEstimate(m);
      if (!est || est.fairProb == null) return null;
      const evPct = ev(lastPrice, est.fairProb) * 100;
      return {
        ticker: m.ticker,
        title: (m.title || "").slice(0, 60),
        yes_subtitle: m.yes_sub_title,
        last: lastPrice,
        fair: est.fairProb,
        ev_pct: evPct,
        reason: est.reason,
      };
    }));
    scored.push(...results.filter(Boolean));
  }

  // 按 |EV| 排序 · 过滤 minEv
  const winners = scored
    .filter((s) => s.ev_pct >= minEvPct)
    .sort((a, b) => b.ev_pct - a.ev_pct)
    .slice(0, limit);

  console.log("\n════════════════════════════════════════════════");
  console.log(`📊 今日 Top ${limit} +EV 推荐 (≥ ${minEvPct}% EV)`);
  console.log("════════════════════════════════════════════════");
  for (const w of winners) {
    console.log(`\n${w.ticker}`);
    console.log(`  ${w.title}`);
    console.log(`  押 YES · ${w.yes_subtitle}`);
    console.log(`  当前 ${(w.last * 100).toFixed(0)}¢ · 估真概率 ${(w.fair * 100).toFixed(0)}% · +EV ${w.ev_pct.toFixed(1)}%`);
    console.log(`  理由 · ${w.reason}`);
    console.log(`  → https://kalshi.com/markets?q=${encodeURIComponent(w.ticker)}`);
  }
  console.log("\n════════════════════════════════════════════════");
  console.log(`扫 ${all.length} 个 · LLM 估了 ${scored.length} 个 · 命中 ${winners.length} 个 +EV ≥ ${minEvPct}%`);
}

main().catch((e) => {
  console.error("失败 ·", e.message);
  process.exit(1);
});
