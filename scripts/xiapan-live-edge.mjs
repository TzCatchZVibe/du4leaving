// 虾盘 · 实时 edge 表 · 不需 db / cron / TG
// `node scripts/xiapan-live-edge.mjs [--bankroll=100] [--min-vol=200] [--all]`
//
// 流程 ·
//   1. 读 .xiapan-probe/elo-train-*.json 拿现成 Elo
//   2. fetch Kalshi /events?series_ticker=KXLOLGAME (未来 24h)
//   3. 每个 event 拉详情 → 主胜负 market 报价
//   4. 模型 P(win) vs Kalshi 隐含价 → edge
//   5. 按 STRONG / WATCH / SKIP 输出可下单清单

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const BANKROLL = Number(
  (args.find((a) => a.startsWith("--bankroll=")) || "--bankroll=100").replace(
    "--bankroll=",
    ""
  )
);
const MIN_VOL_USD = Number(
  (args.find((a) => a.startsWith("--min-vol=")) || "--min-vol=100").replace(
    "--min-vol=",
    ""
  )
);
const SHOW_ALL = args.includes("--all");
const HOURS = Number(
  (args.find((a) => a.startsWith("--hours=")) || "--hours=24").replace(
    "--hours=",
    ""
  )
);

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

// 战队全名 → slug
const ALIASES = {
  "t1": "t1", "gen.g": "gen", "gen.g esports": "gen", "gen": "gen",
  "hanwha life esports": "hle", "hanwha life": "hle", "hle": "hle",
  "kt rolster": "kt", "kt": "kt",
  "dplus kia": "dk", "dk": "dk",
  "dn soopers": "dns", "dns": "dns",
  "hanjin brion": "bro", "bro": "bro",
  "kwangdong freecs": "kdf", "kdf": "kdf",
  "nongshim red force": "ns", "ns": "ns",
  "bnk fearx": "bfx", "bfx": "bfx", "fox": "bfx",
  "weibo gaming": "wbg", "wbg": "wbg",
  "jd gaming": "jdg", "jdg": "jdg",
  "bilibili gaming": "blg", "blg": "blg",
  "top esports": "tes", "tes": "tes",
  "invictus gaming": "ig", "ig": "ig",
  "anyone's legend": "al", "al": "al",
  "team we": "we", "we": "we",
  "thundertalk gaming": "ttg", "ttg": "ttg", "tt": "ttg",
  "oh my god": "omg", "omg": "omg",
  "ultra prime": "up", "up": "up",
  "lng esports": "lng", "lng": "lng",
  "edward gaming": "edg", "edward": "edg",
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
  "drx": "drx",
};

const normalize = (s) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
function nameToSlug(n) {
  const k = normalize(n);
  if (ALIASES[k]) return ALIASES[k];
  const stripped = k
    .replace(/\b(esports|gaming|club|team|the|inc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ALIASES[stripped] || null;
}

function parseSubtitle(sub) {
  if (!sub) return null;
  const t = sub.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = t.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  return m ? { team1: m[1].trim(), team2: m[2].trim() } : null;
}

function parseTicker(ticker) {
  const m = ticker.match(/^KXLOLGAME-(\d{2})([A-Z]{3})(\d{2})(\d{4})/);
  if (!m) return null;
  const [, yy, mon, dd, hhmm] = m;
  const M = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 }[mon.toUpperCase()];
  if (M == null) return null;
  return new Date(Date.UTC(2000 + +yy, M, +dd, +hhmm.slice(0,2), +hhmm.slice(2)));
}

const fp = (s) => (s ? parseFloat(s) || 0 : 0);
const dolToC = (s) => (s ? Math.round(parseFloat(s) * 100) : null);

function expectedScore(e1, e2) {
  return 1 / (1 + Math.pow(10, (e2 - e1) / 400));
}

async function callKalshi(p) {
  const r = await fetch(`${KALSHI}${p}`, {
    headers: { Accept: "application/json", "User-Agent": "Xiapan-LiveEdge/0.1" },
  });
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
}

function findLatestElo() {
  const dir = path.resolve(process.cwd(), ".xiapan-probe");
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("elo-train-") && f.endsWith(".json"))
    .sort();
  if (!files.length) return null;
  const data = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8"));
  return data.finalElos || {};
}

async function pMap(items, fn, conc) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch { out[idx] = null; }
    }
  }
  await Promise.all(Array.from({length: conc}, worker));
  return out;
}

async function main() {
  console.log("");
  console.log("🦞 虾盘 · LIVE EDGE 实时表");
  console.log("═".repeat(76));
  console.log(`   bankroll  $${BANKROLL}  · 窗口 未来 ${HOURS}h  · 最小 vol24 $${MIN_VOL_USD}`);
  console.log("");

  // 1. Elo
  const elos = findLatestElo();
  if (!elos) {
    console.log("⚠ 没找到 Elo · 跑过 xiapan-elo-train.mjs 吗?");
    console.log("  fallback · 全部 1500");
  } else {
    console.log(`📋 Elo: 加载 ${Object.keys(elos).length} 队 (.xiapan-probe/elo-train-*.json)`);
  }
  const getElo = (slug) => (elos && elos[slug] != null ? elos[slug] : 1500);
  console.log("");

  // 2. events
  console.log(`📡 拉 KXLOLGAME events ...`);
  const all = [];
  let cursor;
  for (let p = 0; p < 8; p++) {
    const q = new URLSearchParams({ series_ticker: "KXLOLGAME", limit: "200" });
    if (cursor) q.set("cursor", cursor);
    const d = await callKalshi(`/events?${q}`);
    all.push(...(d.events || []));
    cursor = d.cursor;
    if (!cursor || (d.events || []).length === 0) break;
  }
  console.log(`   总 events: ${all.length}`);

  const now = Date.now();
  const horizon = now + HOURS * 3600 * 1000;
  const candidates = [];
  for (const ev of all) {
    const t = parseTicker(ev.event_ticker)?.getTime();
    if (!t || t < now - 30 * 60 * 1000 || t > horizon) continue;
    const sub = parseSubtitle(ev.sub_title);
    if (!sub) continue;
    const s1 = nameToSlug(sub.team1);
    const s2 = nameToSlug(sub.team2);
    if (!s1 || !s2) continue;
    candidates.push({ ev, t, slug1: s1, slug2: s2, name1: sub.team1, name2: sub.team2 });
  }
  console.log(`   窗口内 + 映射成功: ${candidates.length}`);
  console.log("");

  if (candidates.length === 0) {
    console.log("_无可玩 events_");
    return;
  }

  // 3. 拉 details + 算 edge (并发)
  console.log("🎯 拉 events 详情 + 算 edge ...");
  const rows = [];
  await pMap(
    candidates,
    async (c) => {
      let d;
      try {
        d = await callKalshi(`/events/${c.ev.event_ticker}`);
      } catch {
        return;
      }
      const markets = d.markets || [];
      const main = markets.reduce(
        (b, m) => (!b || fp(m.volume_24h_fp) > fp(b.volume_24h_fp) ? m : b),
        null
      );
      if (!main) return;
      const yesAskC = dolToC(main.yes_ask_dollars);
      const yesBidC = dolToC(main.yes_bid_dollars);
      const vol24 = fp(main.volume_24h_fp);
      const oi = fp(main.open_interest_fp);
      const yesSlug = nameToSlug(main.yes_sub_title || "");

      // 模型 P(yes 押的那队赢)
      const e1 = getElo(c.slug1);
      const e2 = getElo(c.slug2);
      const yesIsTeam1 = yesSlug === c.slug1;
      const modelPYesTeam = yesIsTeam1
        ? expectedScore(e1, e2)
        : expectedScore(e2, e1);

      const impliedP = yesAskC != null ? yesAskC / 100 : null;
      const spread = yesAskC != null && yesBidC != null ? yesAskC - yesBidC : null;
      const edgePp = impliedP != null ? (modelPYesTeam - impliedP) * 100 : null;

      // 决定下哪边
      // 若 edgePp > 0 → 买 yes (yes 押队 win 概率被低估)
      // 若 edgePp < 0 → 买 no  (yes 押队 win 概率被高估)
      const direction = edgePp == null ? null : edgePp >= 0 ? "YES" : "NO";
      const myEdgePp = edgePp == null ? null : Math.abs(edgePp);
      const buySide = direction === "YES" ? main.yes_sub_title : main.no_sub_title;
      const buyPriceC = direction === "YES" ? yesAskC : (yesAskC != null ? 100 - yesAskC : null);

      // Kelly · f = (p - q/b), p=我的 win prob, b=odds(=cost/payoff·1)
      // 简化: f = (myP - cost) / (1 - cost)
      let kelly = null;
      if (buyPriceC != null && myEdgePp != null) {
        const myP = direction === "YES" ? modelPYesTeam : 1 - modelPYesTeam;
        const cost = buyPriceC / 100;
        if (cost > 0 && cost < 1) {
          const raw = (myP - cost) / (1 - cost);
          kelly = Math.max(0, Math.min(0.5, raw)) * 0.25; // 0.25 缩放
        }
      }

      // 信号分级
      let level = "skip";
      const reasons = [];
      if (myEdgePp == null) {
        reasons.push("无报价");
      } else if (vol24 < MIN_VOL_USD) {
        level = "skip";
        reasons.push(`vol24 $${vol24.toFixed(0)} < $${MIN_VOL_USD}`);
      } else if (myEdgePp >= 5 && (spread == null || spread <= 5)) {
        level = "strong";
        reasons.push(`edge ${myEdgePp.toFixed(1)}pp ≥ 5, vol24 $${vol24.toFixed(0)}`);
      } else if (myEdgePp >= 3) {
        level = "watch";
        reasons.push(`edge ${myEdgePp.toFixed(1)}pp 介于 3-5`);
      } else {
        reasons.push(`edge ${myEdgePp.toFixed(1)}pp 太小`);
      }
      if (spread != null && spread > 5) reasons.push(`spread ${spread}¢ 偏大`);

      rows.push({
        date: new Date(c.t).toISOString().slice(5, 16).replace("T", " "),
        team1: c.slug1.toUpperCase(),
        team2: c.slug2.toUpperCase(),
        elo1: Math.round(e1),
        elo2: Math.round(e2),
        modelPYes: modelPYesTeam,
        impliedP,
        edgePp,
        myEdgePp,
        direction,
        buySide,
        buyPriceC,
        spread,
        vol24,
        oi,
        kelly,
        kellyStake: kelly != null ? kelly * BANKROLL : null,
        ticker: main.ticker,
        eventTicker: c.ev.event_ticker,
        level,
        reasons,
      });
    },
    6
  );

  // 4. 排序输出
  const order = { strong: 0, watch: 1, skip: 2 };
  rows.sort((a, b) => order[a.level] - order[b.level] || (b.myEdgePp || 0) - (a.myEdgePp || 0));

  const strongs = rows.filter(r => r.level === "strong");
  const watches = rows.filter(r => r.level === "watch");
  const skips = rows.filter(r => r.level === "skip");

  console.log("");
  console.log(`📊 STRONG ${strongs.length}  ·  WATCH ${watches.length}  ·  SKIP ${skips.length}`);
  console.log("");

  if (strongs.length > 0) {
    console.log("┌─ 🔥 STRONG · 立即下单 ─────────────────────────────────────────────────────");
    for (const r of strongs) printRow(r);
    console.log("└─────────────────────────────────────────────────────────────────────────");
    console.log("");
  }
  if (watches.length > 0) {
    console.log("┌─ 👀 WATCH · 观察盘口 ─────────────────────────────────────────────────────");
    for (const r of watches) printRow(r);
    console.log("└─────────────────────────────────────────────────────────────────────────");
    console.log("");
  }
  if (SHOW_ALL && skips.length > 0) {
    console.log("┌─ ⏭ SKIP ────────────────────────────────────────────────────────────────");
    for (const r of skips) printRow(r);
    console.log("└─────────────────────────────────────────────────────────────────────────");
  }
  if (!SHOW_ALL) {
    console.log(`_${skips.length} 场 SKIP 已隐藏 · 加 --all 显示_`);
  }
  console.log("");
  console.log(`💰 Bankroll $${BANKROLL}  ·  Kelly 0.25 缩放  ·  单笔 max 12.5%`);
  console.log("");
  console.log("操作 ·");
  console.log("  1) 打开 https://kalshi.com/events/KXLOLGAME");
  console.log("  2) 搜 ticker (复制下面的) · 看 yes/no 价格双 check");
  console.log("  3) 按推荐 side 下单 · 仓位别超 Kelly 建议");
}

function printRow(r) {
  const lvl = r.level === "strong" ? "🔥" : r.level === "watch" ? "👀" : "⏭";
  const dir = r.direction === "YES" ? "买 YES" : r.direction === "NO" ? "买 NO " : "  ?  ";
  console.log(
    `│ ${lvl} ${r.date}  ${r.team1.padEnd(5)} vs ${r.team2.padEnd(5)}  Elo ${r.elo1}/${r.elo2}`
  );
  if (r.impliedP != null) {
    console.log(
      `│    模型 ${(r.modelPYes * 100).toFixed(1)}% (${(r.yes_sub_title_short || "yes队")})  Kalshi ${(r.impliedP * 100).toFixed(0)}%  edge ${(r.edgePp >= 0 ? "+" : "") + r.edgePp.toFixed(1)}pp`
    );
  }
  if (r.direction) {
    console.log(
      `│    ${dir} @ ${r.buyPriceC}¢  → ${r.buySide}  ·  vol24 $${r.vol24.toFixed(0)}  oi $${r.oi.toFixed(0)}`
    );
    if (r.kelly != null && r.kelly > 0) {
      console.log(
        `│    Kelly ${(r.kelly * 100).toFixed(2)}%  →  下注 $${r.kellyStake.toFixed(2)}`
      );
    }
  }
  console.log(`│    ticker  ${r.ticker}`);
  console.log(`│    reason  ${r.reasons.join(" · ")}`);
  console.log("│");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
