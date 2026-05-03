// xiapan-analyze.mjs · 独立 Kalshi 单笔分析 · 不依赖 du4leaving 后端
// 用法 ·
//   node scripts/xiapan-analyze.mjs <kalshi-ticker-or-url>
//
// 例 ·
//   node scripts/xiapan-analyze.mjs KX-WTA-PANSHINA-WONG
//   node scripts/xiapan-analyze.mjs https://kalshi.com/markets/kxwtamatch/...
//
// 输出 ·
//   - 当前价 / yes_bid / yes_ask / volume / 状态
//   - 公允价估算 (基于市场结构 · 极端价 / 新单 / 接近 1¢ 或 99¢ 警告)
//   - 简单 EV 分析
//   - hold / close / pass 建议

import fs from "node:fs";
import path from "node:path";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

// 读 .env.local 拿 OPENAI_API_KEY
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

function parseTicker(input) {
  if (!input) return null;
  // URL 含 ticker 在路径最后
  if (input.startsWith("http")) {
    const m = input.match(/markets\/[^\/]+\/[^\/]+\/([\w-]+)/i);
    return m ? m[1].toUpperCase() : null;
  }
  return input.trim().toUpperCase();
}

async function fetchMarket(ticker) {
  // 既可以是 market ticker (有 -PAN 后缀) 也可以是 event ticker
  // event ticker · 拉 event · 取第一个 yes-side market
  const url = `${KALSHI}/markets/${encodeURIComponent(ticker)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.ok) return res.json();

  // 试当作 event
  const evUrl = `${KALSHI}/events/${encodeURIComponent(ticker)}`;
  const evRes = await fetch(evUrl, { headers: { Accept: "application/json" } });
  if (!evRes.ok) {
    throw new Error(`Kalshi 找不到 · 试过 markets/${ticker} 和 events/${ticker}`);
  }
  const ev = await evRes.json();
  const markets = ev.markets || [];
  if (!markets.length) throw new Error(`Event 无 markets · ${ticker}`);
  return { market: markets[0], _allMarkets: markets, _event: ev.event };
}

async function fetchEvent(eventTicker) {
  const url = `${KALSHI}/events/${encodeURIComponent(eventTicker)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return res.json();
}

function diagnose(market) {
  const m = market.market || market;
  const yesBid = (m.yes_bid ?? 0) / 100;          // 转 0-1
  const yesAsk = (m.yes_ask ?? 0) / 100;
  const lastPrice = (m.last_price ?? 0) / 100;
  const status = m.status;
  const result = m.result;
  const volume = m.volume_24h ?? m.volume ?? 0;
  const liquidity = m.liquidity ?? 0;
  const closeTs = m.close_time || m.expiration_time;

  const warnings = [];
  if (status === "settled" || status === "resolved" || status === "closed" || status === "finalized") {
    warnings.push(`✅ 已结算 · result=${result || '?'}`);
  }
  if (status === "inactive") {
    warnings.push("⚠️ trading 已 halted · 锁仓 · 不能 close · 等结算");
  }
  if (yesAsk > 0 && yesBid > 0 && yesAsk - yesBid > 0.05) {
    warnings.push(`⚠️ spread 大 · ${(yesBid * 100).toFixed(0)}¢ / ${(yesAsk * 100).toFixed(0)}¢ · 流动性差`);
  }
  if (volume > 0 && volume < 50) {
    warnings.push(`⚠️ 成交量低 · 24h ${volume} · 价格容易被薄盘推动`);
  }
  if (lastPrice > 0 && (lastPrice <= 0.05 || lastPrice >= 0.95)) {
    warnings.push(`⚠️ 极端价 · ${(lastPrice * 100).toFixed(0)}¢ · 大概率已基本定盘`);
  }

  return { yesBid, yesAsk, lastPrice, status, result, volume, liquidity, closeTs, warnings };
}

// LLM 估公允价 · 用 OpenAI 4o-mini · cheap 快
async function llmFairProb({ ticker, title, yesSubtitle, lastPrice, status, closeTs, eventTitle }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { fairProb: null, reasoning: "OPENAI_API_KEY 没设 · 跳过 LLM 估值" };
  }

  const prompt = `你是预测市场分析师 · 估公允概率。

市场 · ${ticker}
事件 · ${eventTitle || ""}
问题 · ${title}
押 YES 代表 · ${yesSubtitle}
当前价 · ${lastPrice ? (lastPrice * 100).toFixed(0) + "¢" : "未知"}
状态 · ${status}
截止 · ${closeTs ? new Date(closeTs).toLocaleString() : "未知"}

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      return { fairProb: null, reasoning: `OpenAI API ${res.status}` };
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    if (typeof parsed.prob !== "number" || parsed.prob < 0 || parsed.prob > 100) {
      return { fairProb: null, reasoning: parsed.reasoning || "LLM 解析失败" };
    }
    return {
      fairProb: parsed.prob / 100,
      reasoning: parsed.reasoning || "",
    };
  } catch (e) {
    return { fairProb: null, reasoning: `LLM 调用失败 · ${e.message}` };
  }
}

function evAt(price, fairProb) {
  // EV per dollar bet · price 是付出 (0-1) · fair 是真实概率
  // win 概率 = fair · 收益 = (1-price)/price
  // lose 概率 = 1-fair · 损失 = -1
  // EV = fair * (1-price)/price - (1-fair) = (fair - price) / price
  return (fairProb - price) / price;
}

function recommend({ lastPrice, fairProb, status, result, warnings }) {
  if (status === "settled" || status === "resolved" || status === "finalized") {
    if (result === "yes") return "✅ 已结算 · YES 赢 · 你 yes 仓 → 全收 · no 仓 → 0";
    if (result === "no")  return "✅ 已结算 · NO 赢 · 你 yes 仓 → 0 · no 仓 → 全收";
    return `已结算 · result=${result || '?'}`;
  }
  if (status === "inactive") {
    return "trading halted · 锁仓 · 等结算 (无法 close)";
  }
  if (fairProb == null) {
    return "无法估公允价 · 自己判断 · 看 warnings";
  }
  const ev = evAt(lastPrice, fairProb);
  const evPct = (ev * 100).toFixed(1);
  if (ev > 0.05) return `★ 加仓 (+EV ${evPct}%)`;
  if (ev > 0)   return `hold (+EV ${evPct}% · 但小)`;
  if (ev > -0.05) return `hold 观望 (-EV ${evPct}% · 但小)`;
  return `close (亏损 -EV ${evPct}% · 止损)`;
}

function pretty(d, fairProb, ticker, eventInfo) {
  const lines = [];
  lines.push("");
  lines.push("════════════════════════════════════════════════");
  lines.push(`📊 ${ticker}`);
  if (eventInfo) lines.push(`   ${eventInfo}`);
  lines.push("════════════════════════════════════════════════");
  lines.push(`状态        · ${d.status}`);
  lines.push(`Yes bid/ask · ${(d.yesBid * 100).toFixed(0)}¢ / ${(d.yesAsk * 100).toFixed(0)}¢`);
  lines.push(`Last price  · ${(d.lastPrice * 100).toFixed(0)}¢`);
  lines.push(`Volume 24h  · ${d.volume}`);
  lines.push(`Liquidity   · $${d.liquidity}`);
  if (d.closeTs) lines.push(`Closes      · ${new Date(d.closeTs).toLocaleString()}`);
  lines.push("");
  if (d.warnings.length) {
    lines.push("Warnings ·");
    d.warnings.forEach((w) => lines.push(`  ${w}`));
    lines.push("");
  }
  if (fairProb != null && d.lastPrice > 0 && d.status !== "finalized" && d.status !== "settled") {
    lines.push(`公允估算    · ${(fairProb * 100).toFixed(0)}%  (我估)`);
    const ev = evAt(d.lastPrice, fairProb);
    lines.push(`EV          · ${(ev * 100 >= 0 ? "+" : "")}${(ev * 100).toFixed(1)}%`);
  } else if (fairProb != null) {
    lines.push(`公允估算    · ${(fairProb * 100).toFixed(0)}%  (LLM · 仅参考 · 已结算无意义)`);
  } else {
    lines.push("公允估算    · -- (无法自动估)");
  }
  lines.push("");
  lines.push(`建议        · ${recommend({ lastPrice: d.lastPrice, fairProb, status: d.status, result: d.result, warnings: d.warnings })}`);
  lines.push("════════════════════════════════════════════════");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("用法 · node scripts/xiapan-analyze.mjs <ticker-or-url>");
    process.exit(1);
  }
  const ticker = parseTicker(arg);
  if (!ticker) {
    console.error("解析 ticker 失败 · 检查输入");
    process.exit(1);
  }
  console.log(`查询 · ${ticker}`);
  let market;
  try {
    market = await fetchMarket(ticker);
  } catch (e) {
    console.error(`失败 · ${e.message}`);
    process.exit(1);
  }

  const d = diagnose(market);
  const m = market.market || market;
  const eventInfo = m.event_ticker
    ? `Event · ${m.event_ticker}`
    : null;

  // LLM 估公允价 (除非命令行加 --no-llm)
  let fairProb = null;
  let reasoning = "";
  const skipLLM = process.argv.includes("--no-llm");
  if (!skipLLM) {
    console.log("LLM 估值中…");
    const result = await llmFairProb({
      ticker: m.ticker || ticker,
      title: m.title || "",
      yesSubtitle: m.yes_sub_title || "",
      lastPrice: d.lastPrice,
      status: d.status,
      closeTs: d.closeTs,
      eventTitle: market._event?.title || "",
    });
    fairProb = result.fairProb;
    reasoning = result.reasoning;
  }

  console.log(pretty(d, fairProb, ticker, eventInfo));
  if (reasoning) console.log("LLM 理由 · " + reasoning + "\n");
  console.log("ticker 复制到 Kalshi 网页 · 看 K 线 + 历史");
  console.log(`https://kalshi.com/markets?q=${encodeURIComponent(ticker)}`);
}

main();
