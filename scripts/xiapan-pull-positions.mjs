// xiapan-pull-positions.mjs · 拉 TZ 真实 Kalshi positions + 同步进 paper-picks
// 用 RSA 签名 · 私有 API · 不能在 Vercel 跑 (RSA pem 不在那)
// 用法 ·
//   node scripts/xiapan-pull-positions.mjs [--sync]   # 拉 + (可选) 同步进 Supabase

import { authedKalshi, loadXiapanEnv } from "./xiapan-kalshi-auth.mjs";
import { createClient } from "@supabase/supabase-js";

loadXiapanEnv();

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺 SUPABASE 配置");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function pullPositions() {
  // GET /portfolio/positions
  const r = await authedKalshi("GET", "/portfolio/positions");
  return r.market_positions || [];
}

async function pullFills(limit = 200) {
  // GET /portfolio/fills · 历史成交
  const r = await authedKalshi("GET", `/portfolio/fills?limit=${limit}`);
  return r.fills || [];
}

async function pullPortfolio() {
  const r = await authedKalshi("GET", "/portfolio/balance");
  return r;
}

async function fetchMarket(ticker) {
  const r = await fetch(`${KALSHI}/markets/${encodeURIComponent(ticker)}`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) return null;
  return (await r.json()).market;
}

async function syncToSupabase(positions, fills) {
  const c = sb();
  let synced = 0;
  // 用 fills · 比 positions 信息更全 (有入场价)
  for (const f of fills) {
    const ticker = f.market_ticker || f.ticker;
    const side = f.side;                 // 'yes' | 'no'
    const count = parseFloat(f.count_fp ?? f.count ?? "0");
    const action = f.action || "buy";
    // Kalshi 用 yes_price_dollars / no_price_dollars (字符串 · 0-1 范围)
    const yes_price = parseFloat(f.yes_price_dollars ?? "0");
    const no_price = parseFloat(f.no_price_dollars ?? "0");
    const entry_price = side === "yes" ? yes_price : no_price;
    if (!entry_price || !count) continue;
    const stake = entry_price * count;        // $ 成本
    const fee = parseFloat(f.fee_cost ?? "0");

    // 拉市场标题
    const m = await fetchMarket(ticker);
    const title = m?.title || "";
    const yes_subtitle = m?.yes_sub_title || "";
    const market_status = m?.status || "active";
    const market_result = m?.result || null;
    const market_close_at = m?.close_time || m?.expiration_time || null;

    // 只 sync buy · 不 sync sell (sell 是平仓 · 不是新开)
    if (action === "sell") continue;

    // 用 fill_id 作为 pick_id 防重复 (短化)
    const pick_id = (f.fill_id || f.trade_id || f.created_time || ticker).slice(-12).replace(/[^a-z0-9]/gi, "");

    // upsert
    const row = {
      pick_id,
      ticker,
      title,
      yes_subtitle,
      side,
      entry_price,
      fair_prob: 0,                   // 真单 · 没 fair_prob (TZ 自己下的)
      ev_pct: 0,
      reasoning: `[手动 manual] ${count.toFixed(0)} 张 @ ${(entry_price*100).toFixed(0)}c · fee $${fee.toFixed(2)}`,
      source: "manual",
      paper_stake_usd: stake,
      created_at: f.created_time,
      market_close_at,
      market_status:
        market_status === "finalized" || market_status === "settled" ? "finalized" :
        market_status === "active" ? "active" :
        "pending",
      market_result,
    };

    // 已结算 · 算 P&L (含 fee)
    if (market_result === "yes" || market_result === "no") {
      const won = side === market_result;
      const gross = won ? count * 1 - stake : -stake;   // 赢 = count*$1 收回 - stake / 输 = -stake
      row.paper_pnl_usd = gross - fee;
      row.paper_pnl_pct = (row.paper_pnl_usd / stake) * 100;
      row.settled_at = new Date().toISOString();
    }

    const { error } = await c
      .from("baichuan_paper_picks")
      .upsert(row, { onConflict: "pick_id", ignoreDuplicates: false });

    if (error) {
      console.warn(`  ✗ ${ticker} · ${error.message}`);
    } else {
      synced++;
      console.log(`  ✓ ${ticker} · ${side} × ${count.toFixed(0)} @ ${(entry_price*100).toFixed(0)}c · ${market_status}${market_result ? " " + market_result : ""}`);
    }
  }
  return synced;
}

async function main() {
  console.log("拉 Kalshi portfolio…");
  const portfolio = await pullPortfolio();
  console.log(`  Cash · $${(portfolio.balance / 100).toFixed(2)}  ·  Available · $${((portfolio.payout - portfolio.balance) / 100).toFixed(2)} 持仓总价`);

  console.log("\n拉 持仓 positions…");
  const positions = await pullPositions();
  console.log(`  共 ${positions.length} 持仓`);
  for (const p of positions) {
    console.log(`  ${p.ticker} · pos=${p.position} · realized_pnl=${(p.realized_pnl/100).toFixed(2)} · market_exposure=${(p.market_exposure/100).toFixed(2)}`);
  }

  console.log("\n拉 历史 fills (最近 200)…");
  const fills = await pullFills(200);
  console.log(`  共 ${fills.length} fills`);

  if (process.argv.includes("--sync")) {
    console.log("\n同步进 Supabase paper_picks…");
    const synced = await syncToSupabase(positions, fills);
    console.log(`✓ 同步 ${synced} 条`);
  } else {
    console.log("\n💡 加 --sync 同步进 Supabase");
  }
}

main().catch((e) => {
  console.error("失败 ·", e.message);
  process.exit(1);
});
