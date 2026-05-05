// xiapan-sync-balances.mjs · 自动拉所有账户真余额 · 写进 Supabase
// V0.74 · 2026-05-05 · TZ 不要自己输
//
// 接 ·
//   ✅ Kalshi · RSA 私钥 · /portfolio/balance
//   ✅ Coinbase · API key/secret (read-only · 用户给) · /v2/accounts
//   ✅ SimpleFIN · access token · 银行余额聚合
//   △ HG receivable · Notion API (后续)
//
// 用法 · node scripts/xiapan-sync-balances.mjs

import { authedKalshi, loadXiapanEnv } from "./xiapan-kalshi-auth.mjs";
import { createClient } from "@supabase/supabase-js";

loadXiapanEnv();

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function recordBalance(slug, balance, source = "auto-sync", notes = "") {
  const c = sb();
  const { data: acc } = await c.from("wealth_accounts").select("*").eq("slug", slug).maybeSingle();
  if (!acc) {
    console.log(`  ✗ ${slug} · 账户不存在 · skip`);
    return false;
  }
  const { error } = await c.from("wealth_balances").insert({
    account_id: acc.id,
    balance,
    source,
    notes,
  });
  if (error) {
    console.log(`  ✗ ${slug} · ${error.message}`);
    return false;
  }
  console.log(`  ✓ ${slug} · $${balance.toFixed(2)} (${source})`);
  return true;
}

// ───────── Kalshi ─────────

async function syncKalshi() {
  try {
    const r = await authedKalshi("GET", "/portfolio/balance");
    // balance · cents · 转 dollars
    const cash = (r.balance ?? 0) / 100;
    const portfolioValue = ((r.payout ?? 0) - (r.balance ?? 0)) / 100;
    const total = cash + portfolioValue;
    await recordBalance("kalshi", total, "kalshi-api", `cash $${cash.toFixed(2)} + 持仓 $${portfolioValue.toFixed(2)}`);
    return true;
  } catch (e) {
    console.log(`  ✗ kalshi · ${e.message}`);
    return false;
  }
}

// ───────── Coinbase (要 user 给 API key/secret) ─────────

async function syncCoinbase() {
  const apiKey = process.env.COINBASE_API_KEY;
  const apiSecret = process.env.COINBASE_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.log("  ○ coinbase · 没设 COINBASE_API_KEY · skip (Telegram 加 key 后自动跑)");
    return false;
  }
  // Coinbase v2 · GET /v2/accounts · 用 HMAC SHA256 签名
  try {
    const crypto = await import("node:crypto");
    const ts = Math.floor(Date.now() / 1000).toString();
    const method = "GET";
    const path = "/v2/accounts";
    const body = "";
    const sig = crypto
      .createHmac("sha256", apiSecret)
      .update(ts + method + path + body)
      .digest("hex");
    const r = await fetch(`https://api.coinbase.com${path}`, {
      headers: {
        "CB-ACCESS-KEY": apiKey,
        "CB-ACCESS-SIGN": sig,
        "CB-ACCESS-TIMESTAMP": ts,
        "CB-VERSION": "2024-01-01",
      },
    });
    if (!r.ok) {
      console.log(`  ✗ coinbase · HTTP ${r.status}`);
      return false;
    }
    const d = await r.json();
    let totalUsd = 0;
    for (const acc of d.data || []) {
      const bal = parseFloat(acc.balance?.amount || "0");
      const cur = acc.balance?.currency;
      if (cur === "USD" || cur === "USDC") {
        totalUsd += bal;
      } else {
        // 拉现价转 USD
        const native = parseFloat(acc.native_balance?.amount || "0");
        totalUsd += native;
      }
    }
    await recordBalance("coinbase", +totalUsd.toFixed(2), "coinbase-api", `${(d.data || []).length} 资产`);
    return true;
  } catch (e) {
    console.log(`  ✗ coinbase · ${e.message}`);
    return false;
  }
}

// ───────── SimpleFIN (要 user 给 access_token) ─────────

async function syncSimplefin() {
  const sfToken = process.env.SIMPLEFIN_ACCESS_TOKEN;
  if (!sfToken) {
    console.log("  ○ SimpleFIN · 没设 SIMPLEFIN_ACCESS_TOKEN · skip (Telegram /sf-setup 后自动跑)");
    return false;
  }
  try {
    // SimpleFIN access token 是 base64 of url:user:pass
    const decoded = Buffer.from(sfToken, "base64").toString();
    const m = decoded.match(/^(https?:\/\/[^:]+):([^:]+):(.+)$/);
    if (!m) throw new Error("token 格式错");
    const [_, baseUrl, user, pass] = m;
    const auth = Buffer.from(`${user}:${pass}`).toString("base64");
    const r = await fetch(`${baseUrl}/accounts`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    // 按 SimpleFIN account 分类 (checking / savings / CD)
    let checking = 0;
    let savings = 0;
    for (const a of d.accounts || []) {
      const bal = parseFloat(a.balance || "0");
      const name = (a.name || "").toLowerCase();
      if (name.includes("saving") || name.includes("cd")) {
        savings += bal;
      } else {
        checking += bal;
      }
    }
    await recordBalance("bank-checking", +checking.toFixed(2), "simplefin", `${(d.accounts || []).length} 银行账户聚合`);
    await recordBalance("bank-savings", +savings.toFixed(2), "simplefin", "savings + CD");
    return true;
  } catch (e) {
    console.log(`  ✗ SimpleFIN · ${e.message}`);
    return false;
  }
}

// ───────── 主流程 ─────────

async function main() {
  console.log("自动同步余额 · " + new Date().toISOString());
  console.log("");

  const results = {
    kalshi: await syncKalshi(),
    coinbase: await syncCoinbase(),
    simplefin: await syncSimplefin(),
  };

  console.log("");
  console.log("结果 ·");
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v ? "✓" : "○"} ${k}`);
  }
  console.log("");
  console.log("📌 没接到的 (现金 / HG 应收) · 偶尔 /add 手动");
}

main().catch((e) => {
  console.error("失败 ·", e.message);
  process.exit(1);
});
