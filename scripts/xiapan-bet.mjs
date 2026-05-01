// 虾盘 · 一键下单 (Kalshi)
//
// `node scripts/xiapan-bet.mjs <ticker> <yes|no> <count> [--price=79] [--type=limit|market]`
//
// 例 ·
//   node scripts/xiapan-bet.mjs KXLOLGAME-26APR290400T1NS-T1 yes 10 --price=79
//   node scripts/xiapan-bet.mjs KXLOLGAME-26APR290500JDGNIP-JDG no 5 --price=31
//
// 默认 limit + 当前 ask 价

import crypto from "node:crypto";
import { loadXiapanEnv, authedKalshi } from "./xiapan-kalshi-auth.mjs";

loadXiapanEnv();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("用法: node scripts/xiapan-bet.mjs <ticker> <yes|no> <count> [--price=79] [--type=limit|market]");
    console.log("");
    console.log("例: node scripts/xiapan-bet.mjs KXLOLGAME-26APR290400T1NS-T1 yes 10 --price=79");
    process.exit(1);
  }

  const [ticker, sideRaw, countRaw] = args;
  const side = sideRaw.toLowerCase();
  if (!["yes", "no"].includes(side)) {
    console.error("side 必须是 yes 或 no");
    process.exit(1);
  }
  const count = parseInt(countRaw, 10);
  if (isNaN(count) || count <= 0) {
    console.error("count 必须是正整数");
    process.exit(1);
  }
  const priceArg = args.find((a) => a.startsWith("--price="));
  const typeArg = args.find((a) => a.startsWith("--type="));
  const orderType = (typeArg ? typeArg.replace("--type=", "") : "limit").toLowerCase();
  let price = priceArg ? parseInt(priceArg.replace("--price=", ""), 10) : null;

  console.log("");
  console.log("🦞 虾盘 · 下单确认");
  console.log("═".repeat(60));

  // 1. 看市场当前报价
  let market;
  try {
    const mr = await authedKalshi("GET", `/markets/${ticker}`);
    market = mr.market;
  } catch (e) {
    console.error(`❌ 拉 market ${ticker} 失败: ${e.message}`);
    process.exit(1);
  }
  if (!market) {
    console.error("❌ market 不存在");
    process.exit(1);
  }
  const dolToC = (s) => (s ? Math.round(parseFloat(s) * 100) : null);
  const yesAskC = dolToC(market.yes_ask_dollars);
  const yesBidC = dolToC(market.yes_bid_dollars);
  const noAskC = dolToC(market.no_ask_dollars);
  const noBidC = dolToC(market.no_bid_dollars);
  const status = market.status;

  console.log(`   ticker:   ${ticker}`);
  console.log(`   title:    ${market.title || ""}`);
  console.log(`   yes_sub:  ${market.yes_sub_title || ""}`);
  console.log(`   no_sub:   ${market.no_sub_title || ""}`);
  console.log(`   yes:      bid ${yesBidC}¢ / ask ${yesAskC}¢`);
  console.log(`   no:       bid ${noBidC}¢ / ask ${noAskC}¢`);
  console.log(`   status:   ${status}`);
  console.log("");

  // 决定价格
  if (orderType === "limit" && price == null) {
    price = side === "yes" ? yesAskC : noAskC;
    console.log(`   (auto-price) 用当前 ${side} ask = ${price}¢`);
  }
  if (price != null && (price < 1 || price > 99)) {
    console.error(`❌ price ${price} 不合法 (1-99)`);
    process.exit(1);
  }

  const cost = (price ?? 0) * count;
  console.log("");
  console.log(`💰 订单 · ${orderType.toUpperCase()} BUY ${side.toUpperCase()} ${count} @ ${price}¢`);
  console.log(`   总成本: $${(cost / 100).toFixed(2)}`);
  console.log(`   最大盈利 (赢): $${((100 - price) * count / 100).toFixed(2)}`);
  console.log(`   最大亏损 (输): $${(cost / 100).toFixed(2)}`);
  console.log("");

  // 2. 余额检查
  try {
    const bal = await authedKalshi("GET", "/portfolio/balance");
    const dollars = (bal.balance ?? 0) / 100;
    console.log(`   现金余额: $${dollars.toFixed(2)}`);
    if ((bal.balance ?? 0) < cost) {
      console.error("❌ 余额不足");
      process.exit(1);
    }
  } catch (e) {
    console.log(`   ⚠ 余额检查跳过: ${e.message}`);
  }
  console.log("");

  // 3. 二次确认 (env XIAPAN_AUTO=1 跳过)
  if (process.env.XIAPAN_AUTO !== "1") {
    process.stdout.write("回车确认下单, Ctrl+C 取消 ... ");
    await new Promise((res) => process.stdin.once("data", res));
  }

  // 4. 下单
  const order = {
    ticker,
    client_order_id: crypto.randomUUID(),
    side,
    action: "buy",
    type: orderType,
    count,
  };
  if (orderType === "limit") {
    if (side === "yes") order.yes_price = price;
    else order.no_price = price;
  }

  console.log("");
  console.log("📤 下单中 ...");
  try {
    const res = await authedKalshi("POST", "/portfolio/orders", order);
    console.log("✅ 下单成功!");
    console.log(`   order_id:   ${res.order?.order_id || res.order_id || "?"}`);
    console.log(`   status:     ${res.order?.status || "?"}`);
    console.log(`   filled:     ${res.order?.filled_count ?? 0}/${count}`);
    console.log(`   remaining:  ${res.order?.remaining_count ?? count}`);
  } catch (e) {
    console.error(`❌ 下单失败: ${e.message}`);
    if (e.body) console.error(`   ${JSON.stringify(e.body)}`);
    process.exit(1);
  }
  console.log("");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
