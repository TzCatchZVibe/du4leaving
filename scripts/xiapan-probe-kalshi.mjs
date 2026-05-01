// 虾盘 W0/R · Kalshi LOL events 探测 (用 /events 不是 /markets)
// `node scripts/xiapan-probe-kalshi.mjs`
//
// 关键发现 · LOL 比赛在 /events?series_ticker=KXLOLGAME 下
// /markets?status=open 只返回独立 markets, 嵌套在 events 内部的不出现
//
// 验证 ·
//   - LOL events 数量 + 分布 (未来 14d)
//   - 战队名 → slug 映射命中率
//   - 抽样 events 详情 → markets 报价 + 流动性
//   - 给出可玩度结论

import fs from "node:fs";
import path from "node:path";

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

const ALIASES = {
  "t1": "t1", "gen.g": "gen", "gen.g esports": "gen", "gen": "gen",
  "hanwha life esports": "hle", "hanwha life": "hle", "hle": "hle",
  "kt rolster": "kt", "kt": "kt",
  "dplus kia": "dk", "dk": "dk",
  "dn soopers": "dns", "dns": "dns",
  "hanjin brion": "bro", "bro": "bro",
  "kwangdong freecs": "kdf", "kdf": "kdf",
  "nongshim red force": "ns", "ns": "ns",
  "bnk fearx": "bfx", "bfx": "bfx",
  "weibo gaming": "wbg", "wbg": "wbg",
  "jd gaming": "jdg", "jdg": "jdg",
  "bilibili gaming": "blg", "blg": "blg",
  "top esports": "tes", "tes": "tes",
  "invictus gaming": "ig", "ig": "ig",
  "anyone's legend": "al", "al": "al",
  "team we": "we", "we": "we",
  "thundertalk gaming": "ttg", "ttg": "ttg",
  "oh my god": "omg", "omg": "omg",
  "ultra prime": "up", "up": "up",
  "lng esports": "lng", "lng": "lng",
  "edward gaming": "edg", "edg": "edg",
  "ninjas in pyjamas": "nip", "nip": "nip",
  "fun plus phoenix": "fpx", "fpx": "fpx",
  "lgd gaming": "lgd", "lgd": "lgd",
  "g2 esports": "g2", "g2": "g2",
  "fnatic": "fnc", "fnc": "fnc",
  "karmine corp": "kc", "kc": "kc",
  "team vitality": "vit", "vit": "vit",
  "team heretics": "th", "th": "th",
  "movistar koi": "mkoi", "mkoi": "mkoi",
  "los ratones": "lyon", "lyon": "lyon",
  "natus vincere": "navi", "navi": "navi",
  "rogue": "rog", "rog": "rog",
  "sk gaming": "sk", "sk": "sk",
  "team liquid": "tl", "tl": "tl",
  "cloud9": "c9", "c9": "c9",
  "100 thieves": "100t", "100t": "100t",
  "flyquest": "fly", "fly": "fly",
  "dignitas": "dig", "dig": "dig",
  "shopify rebellion": "sr", "sr": "sr",
  "disguised": "dsg", "dsg": "dsg",
  "sentinels": "sen", "sen": "sen",
  "red canids": "red",
  "furia esports": "fur", "furia": "fur",
  "pain gaming": "png", "paín gaming": "png",
  "leviatan esports": "lev", "leviatan": "lev",
  "deep cross gaming": "dcg",
  "gam esports": "gam", "gam": "gam",
};

function normalize(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
}

function nameToSlug(name) {
  const k = normalize(name);
  if (ALIASES[k]) return ALIASES[k];
  const stripped = k
    .replace(/\b(esports|gaming|club|team|the|inc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (ALIASES[stripped]) return ALIASES[stripped];
  return null;
}

function parseSubtitle(sub) {
  if (!sub) return null;
  const cleaned = sub.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = cleaned.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!m) return null;
  return { team1: m[1].trim(), team2: m[2].trim() };
}

function parseTicker(ticker) {
  const m = ticker.match(
    /^KXLOLGAME-(\d{2})([A-Z]{3})(\d{2})(\d{4})([A-Z]+)$/i
  );
  if (!m) return null;
  const [, yy, mon, dd, hhmm] = m;
  const monthMap = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
  const month = monthMap[mon.toUpperCase()];
  if (month == null) return null;
  return new Date(Date.UTC(2000 + +yy, month, +dd, +hhmm.slice(0,2), +hhmm.slice(2)));
}

async function callKalshi(p) {
  const r = await fetch(`${KALSHI}${p}`, {
    headers: { Accept: "application/json", "User-Agent": "Xiapan/0.1" },
  });
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
}

async function fetchAllLolEvents() {
  const all = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams();
    q.set("series_ticker", "KXLOLGAME");
    q.set("limit", "200");
    if (cursor) q.set("cursor", cursor);
    const data = await callKalshi(`/events?${q.toString()}`);
    const events = data.events || [];
    all.push(...events);
    cursor = data.cursor;
    if (!cursor || events.length === 0) break;
  }
  return all;
}

function bar(n, max, w = 16) {
  if (max <= 0) return "".padEnd(w, "·");
  return "█".repeat(Math.round((n / max) * w)).padEnd(w, "·");
}

async function main() {
  console.log("");
  console.log("🦞 虾盘 · Kalshi LOL events 探测");
  console.log("═".repeat(64));
  console.log("");

  console.log("📡 拉 KXLOLGAME events …");
  const events = await fetchAllLolEvents();
  console.log(`   总数: ${events.length}`);
  console.log("");

  // 时间分布
  const now = Date.now();
  const past1d = now - 24 * 3600 * 1000;
  const next7d = now + 7 * 24 * 3600 * 1000;
  const next14d = now + 14 * 24 * 3600 * 1000;
  let live = 0, in7d = 0, in14d = 0, future14plus = 0;
  const candidates = [];
  for (const ev of events) {
    const t = parseTicker(ev.event_ticker)?.getTime();
    if (!t) continue;
    if (t > past1d && t <= now) live++;
    if (t > now && t <= next7d) in7d++;
    if (t > now && t <= next14d) in14d++;
    if (t > next14d) future14plus++;
    if (t > now && t <= next14d) candidates.push({ ev, scheduledAt: new Date(t) });
  }
  console.log(`📅 时间分布`);
  console.log(`   live (近 24h):  ${live}`);
  console.log(`   未来 7 天:       ${in7d}`);
  console.log(`   未来 14 天:      ${in14d}`);
  console.log(`   14 天以后:       ${future14plus}`);
  console.log("");

  // 战队映射
  let hits = 0, miss = 0;
  const missSet = new Set();
  const valid = [];
  for (const c of candidates) {
    const sub = parseSubtitle(c.ev.sub_title);
    if (!sub) continue;
    const s1 = nameToSlug(sub.team1);
    const s2 = nameToSlug(sub.team2);
    if (s1) hits++; else { miss++; missSet.add(sub.team1); }
    if (s2) hits++; else { miss++; missSet.add(sub.team2); }
    if (s1 && s2) valid.push({ ...c, slug1: s1, slug2: s2, team1: sub.team1, team2: sub.team2 });
  }
  console.log(`🔗 战队名映射 (未来 14d)`);
  console.log(`   命中: ${hits}/${hits + miss}  (${(hits + miss) ? ((hits / (hits + miss)) * 100).toFixed(1) : 0}%)`);
  if (missSet.size > 0) {
    console.log(`   未映射 (建议加 ALIASES):`);
    [...missSet].slice(0, 12).forEach((n) => console.log(`     · ${n}`));
  }
  console.log("");
  console.log(`✅ 完整可用 (双方都映射成功): ${valid.length}`);
  console.log("");

  // 抽样 events · 优先 live + 未来 48h, 看真实流动性
  console.log("🎯 抽样 events (live + 未来 48h) — 看 markets 真实报价");
  console.log("");
  const live48h = valid
    .filter((v) => {
      const t = v.scheduledAt.getTime();
      return t > past1d && t <= now + 48 * 3600 * 1000;
    })
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const sample = (live48h.length > 0 ? live48h : valid).slice(0, 10);
  if (live48h.length === 0) {
    console.log("   _无 live · 抽样未来 14d events_");
  }
  let totalLiq = 0;
  let yesPrices = [];
  for (const v of sample) {
    let detail;
    try {
      detail = await callKalshi(`/events/${v.ev.event_ticker}`);
    } catch (e) {
      console.log(`   ⚠ ${v.ev.event_ticker}: ${e.message}`);
      continue;
    }
    const markets = detail.markets || [];
    const fp = (s) => (s ? parseFloat(s) || 0 : 0);
    const dolStrToCents = (s) => (s ? Math.round(parseFloat(s) * 100) : null);
    const main = markets.reduce(
      (b, m) =>
        !b || fp(m.volume_24h_fp) > fp(b.volume_24h_fp) ? m : b,
      null
    );
    const dateStr = v.scheduledAt.toISOString().slice(5, 16).replace("T", " ");
    if (!main) {
      console.log(`   ${dateStr}  ${v.slug1.toUpperCase()}/${v.slug2.toUpperCase()}  · ${markets.length} markets, no main`);
      continue;
    }
    const vol24 = fp(main.volume_24h_fp);
    const oi = fp(main.open_interest_fp);
    totalLiq += vol24;
    const yesAskC = dolStrToCents(main.yes_ask_dollars);
    const yesBidC = dolStrToCents(main.yes_bid_dollars);
    if (yesAskC != null) yesPrices.push(yesAskC);
    console.log(
      `   ${dateStr}  ${v.slug1.toUpperCase()}/${v.slug2.toUpperCase().padEnd(5)}  yes ${yesBidC ?? "?"}/${yesAskC ?? "?"}¢  vol24 $${vol24.toFixed(0)}  oi $${oi.toFixed(0)}  ${main.status}`
    );
    console.log(`     ${main.yes_sub_title} · ticker ${main.ticker}`);
  }
  console.log("");
  console.log(`   抽样 ${sample.length} 场流动性合计 $${(totalLiq / 100).toFixed(0)}`);
  console.log("");

  // 价差分布
  if (yesPrices.length > 0) {
    const buckets = [0, 0, 0, 0, 0];
    for (const p of yesPrices) {
      const i = Math.min(4, Math.floor(p / 20));
      buckets[i]++;
    }
    console.log("📊 yes_ask 价格分布 (抽样 8 场)");
    const labels = ["0-20¢", "20-40¢", "40-60¢", "60-80¢", "80-100¢"];
    const max = Math.max(...buckets, 1);
    for (let i = 0; i < 5; i++) {
      console.log(`   ${labels[i].padEnd(8)}  ${bar(buckets[i], max)}  ${buckets[i]}`);
    }
    console.log("");
  }

  console.log("┌─ 结论 ─────────────────────────────────────────────────");
  if (in14d > 0 && valid.length > 0) {
    console.log(`│  ✅ Kalshi LOL · ${in14d} 场未来 14d · ${valid.length} 场战队映射 OK`);
    console.log(`│  → cron 自动抓 → edge 引擎实战可玩`);
  } else {
    console.log(`│  ⚠ 当前未来窗口内可玩 events 不足`);
  }
  console.log("└───────────────────────────────────────────────────────");

  // 保存报告
  const outDir = path.resolve(process.cwd(), ".xiapan-probe");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(outDir, `kalshi-events-${ts}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        total: events.length,
        live,
        in7d,
        in14d,
        future14plus,
        validInWindow: valid.length,
        unmapped: [...missSet],
        sample: sample.map((v) => ({
          ticker: v.ev.event_ticker,
          subtitle: v.ev.sub_title,
          team1_slug: v.slug1,
          team2_slug: v.slug2,
          scheduledAt: v.scheduledAt.toISOString(),
        })),
      },
      null,
      2
    )
  );
  console.log(`📄 报告: ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
