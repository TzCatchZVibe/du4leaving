// 虾盘 · Kalshi 账户 + 持仓速查
// `node scripts/xiapan-account.mjs`

import { loadXiapanEnv, authedKalshi } from "./xiapan-kalshi-auth.mjs";

loadXiapanEnv();

async function main() {
  console.log("");
  console.log("🦞 虾盘 · Kalshi 账户");
  console.log("═".repeat(60));
  console.log("");

  // 1. 余额
  try {
    const bal = await authedKalshi("GET", "/portfolio/balance");
    const dollars = (bal.balance ?? 0) / 100;
    const payout = (bal.payout ?? 0) / 100;
    console.log(`💰 余额          $${dollars.toFixed(2)}  (cash)`);
    console.log(`📊 max payout    $${payout.toFixed(2)}  (含未结算潜在收益)`);
  } catch (e) {
    console.log(`⚠ 余额接口出错: ${e.message}`);
    if (e.body) console.log(`   ${JSON.stringify(e.body).slice(0, 200)}`);
    console.log("");
    console.log("可能原因 ·");
    console.log("  - KALSHI_API_KEY_ID 错");
    console.log("  - KALSHI_PRIVATE_KEY PEM 格式不对");
    console.log("  - 时钟不同步 (检查系统时间)");
    return;
  }
  console.log("");

  // 2. 持仓
  try {
    const pos = await authedKalshi("GET", "/portfolio/positions?limit=200");
    const market_pos = pos.market_positions || [];
    const fp = (s) => parseFloat(s || "0");
    const open = market_pos.filter((p) => fp(p.position_fp) !== 0);
    console.log(`📈 持仓 ${open.length} 个 (含未平仓)`);
    if (open.length > 0) {
      console.log("");
      let totalExposure = 0;
      let totalPnl = 0;
      for (const p of open.slice(0, 20)) {
        const posFp = fp(p.position_fp);
        const side = posFp > 0 ? "YES" : "NO ";
        const qty = Math.abs(posFp);
        const exposure = fp(p.market_exposure_dollars);
        const avg = qty > 0 ? exposure / qty : 0;
        const pnl = fp(p.realized_pnl_dollars);
        const fees = fp(p.fees_paid_dollars);
        totalExposure += exposure;
        totalPnl += pnl;
        console.log(
          `   ${side}  ${qty.toFixed(2).padStart(7)}  @ ${(avg * 100).toFixed(0)}¢  exposure $${exposure.toFixed(2)}  pnl ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}  ${p.ticker}`
        );
      }
      console.log("");
      console.log(`   合计 exposure: $${totalExposure.toFixed(2)}  ·  realized pnl: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`);
    }
  } catch (e) {
    console.log(`⚠ 持仓: ${e.message}`);
  }
  console.log("");

  // 3. 当前订单
  try {
    const ord = await authedKalshi("GET", "/portfolio/orders?status=resting");
    const orders = ord.orders || [];
    console.log(`📋 挂单 ${orders.length} 个`);
    for (const o of orders.slice(0, 10)) {
      console.log(
        `   ${o.action.toUpperCase()} ${o.side.toUpperCase()}  ${o.remaining_count}  @ ${o.yes_price ?? o.no_price}¢  ${o.ticker}`
      );
    }
  } catch (e) {
    console.log(`⚠ 订单: ${e.message}`);
  }
  console.log("");

  // 4. 最近成交
  try {
    const fills = await authedKalshi("GET", "/portfolio/fills?limit=10");
    const f = fills.fills || [];
    const fp = (s) => parseFloat(s || "0");
    console.log(`✅ 最近成交 ${f.length}`);
    for (const x of f.slice(0, 8)) {
      const t = (x.created_time || "").slice(5, 16).replace("T", " ");
      const cnt = fp(x.count_fp);
      const priceC =
        x.side === "yes"
          ? Math.round(fp(x.yes_price_dollars) * 100)
          : Math.round(fp(x.no_price_dollars) * 100);
      const fee = fp(x.fee_cost);
      console.log(
        `   ${t}  ${x.action.toUpperCase()} ${x.side.toUpperCase()}  ${cnt.toFixed(2).padStart(7)} @ ${priceC}¢  fee $${fee.toFixed(2)}  ${x.ticker}`
      );
    }
  } catch (e) {
    console.log(`⚠ fills: ${e.message}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
