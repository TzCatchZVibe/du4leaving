// 百川/kalshi-live.ts · Kalshi 真钱 client (gated · 默认 OFF)
//
// V0.72 W3 · 真钱接入骨架
//
// 使用前提 ·
//   1. paper trade 满 30 单 + wr ≥ 53% + CLV > 0
//   2. 设 LIVE_TRADING=true 在 .env.local (默认 false)
//   3. 设 KALSHI_API_KEY_ID + KALSHI_PRIVATE_KEY_PATH (RSA 私钥)
//   4. 单笔上限硬写死 $5 起步 (未来手动调高)
//
// 任何调用前 · 必查 isLiveEnabled() · 否则全部 no-op

import fs from "node:fs";
import crypto from "node:crypto";

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

export interface LiveOrderInput {
  ticker: string;
  side: "yes" | "no";
  qty: number;                      // 张数
  type: "limit" | "market";
  limit_price_c?: number;           // limit 用 · 美分整数
  client_order_id: string;          // 幂等 · 你给
  bucket: "S" | "C";                // 标识来自哪桶
}

export interface LiveOrderResult {
  ok: boolean;
  order_id?: string;
  error?: string;
  raw?: unknown;
  dry_run?: boolean;                 // true = 没启用真钱 · 假装下了
}

export function isLiveEnabled(): boolean {
  return process.env.LIVE_TRADING === "true";
}

export function liveStatus(): {
  enabled: boolean;
  reason: string;
  has_key_id: boolean;
  has_private_key: boolean;
} {
  const enabled = isLiveEnabled();
  const has_key_id = !!process.env.KALSHI_API_KEY_ID;
  const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
  const has_private_key = !!keyPath && fs.existsSync(keyPath);
  let reason = "ok";
  if (!enabled) reason = "LIVE_TRADING != true · 默认 OFF · paper only";
  else if (!has_key_id) reason = "缺 KALSHI_API_KEY_ID";
  else if (!has_private_key) reason = "缺 KALSHI_PRIVATE_KEY_PATH (RSA)";
  return { enabled, reason, has_key_id, has_private_key };
}

// ───────────── Kalshi RSA 签名 (per Kalshi docs) ─────────────
//
// 每个请求 · 三个 header ·
//   KALSHI-ACCESS-KEY: API_KEY_ID
//   KALSHI-ACCESS-TIMESTAMP: 毫秒
//   KALSHI-ACCESS-SIGNATURE: base64(RSA-PSS-SHA256(timestamp + method + path))

function loadPrivateKey(): crypto.KeyObject | null {
  const path = process.env.KALSHI_PRIVATE_KEY_PATH;
  if (!path || !fs.existsSync(path)) return null;
  try {
    const pem = fs.readFileSync(path, "utf8");
    return crypto.createPrivateKey(pem);
  } catch {
    return null;
  }
}

function signRequest(method: string, urlPath: string): {
  timestamp: string;
  signature: string;
} | null {
  const key = loadPrivateKey();
  if (!key) return null;
  const timestamp = Date.now().toString();
  const message = timestamp + method + urlPath;
  try {
    const signer = crypto.createSign("SHA256");
    signer.update(message);
    signer.end();
    // PSS padding + SHA256 (Kalshi spec)
    const sig = crypto.sign(
      "sha256",
      Buffer.from(message),
      {
        key,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      }
    );
    return { timestamp, signature: sig.toString("base64") };
  } catch {
    return null;
  }
}

// ───────────── 真钱风控硬写死 ─────────────

const HARD_RISK = {
  MAX_SINGLE_STAKE_USD: 5.00,        // 单笔上限 $5 起步
  MAX_DAILY_NEW_ORDERS: 20,          // 日新单上限
  MAX_DAILY_DOLLAR_NEW: 50.00,       // 日新下钱上限
};

let _dailyState = {
  date: new Date().toISOString().slice(0, 10),
  new_orders: 0,
  new_dollars: 0,
};

function checkDailyLimits(stake_usd: number): { pass: boolean; reason?: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _dailyState.date) {
    _dailyState = { date: today, new_orders: 0, new_dollars: 0 };
  }
  if (_dailyState.new_orders >= HARD_RISK.MAX_DAILY_NEW_ORDERS) {
    return { pass: false, reason: `日新单已 ${_dailyState.new_orders} >= ${HARD_RISK.MAX_DAILY_NEW_ORDERS}` };
  }
  if (_dailyState.new_dollars + stake_usd > HARD_RISK.MAX_DAILY_DOLLAR_NEW) {
    return {
      pass: false,
      reason: `今日已下 $${_dailyState.new_dollars.toFixed(2)} + $${stake_usd.toFixed(2)} > $${HARD_RISK.MAX_DAILY_DOLLAR_NEW}`,
    };
  }
  return { pass: true };
}

// ───────────── 主入口 placeOrder ─────────────

export async function placeOrder(input: LiveOrderInput): Promise<LiveOrderResult> {
  // 1. gate · 没启用 · dry run
  const status = liveStatus();
  if (!status.enabled || !status.has_key_id || !status.has_private_key) {
    return {
      ok: true,
      dry_run: true,
      error: status.reason,
    };
  }

  // 2. 单笔风控
  const cost_per_share = input.type === "limit" ? (input.limit_price_c ?? 0) : 50;   // market 估 50¢
  const stake = (input.qty * cost_per_share) / 100;
  if (stake > HARD_RISK.MAX_SINGLE_STAKE_USD) {
    return { ok: false, error: `单笔 $${stake.toFixed(2)} > $${HARD_RISK.MAX_SINGLE_STAKE_USD}` };
  }
  if (input.qty < 1 || input.qty > 200) {
    return { ok: false, error: `qty ${input.qty} out of [1, 200]` };
  }

  // 3. 日限额
  const daily = checkDailyLimits(stake);
  if (!daily.pass) {
    return { ok: false, error: daily.reason };
  }

  // 4. 签名 + 下单
  const path = `/trade-api/v2/portfolio/orders`;
  const signed = signRequest("POST", path);
  if (!signed) return { ok: false, error: "signRequest failed" };

  const body = {
    ticker: input.ticker,
    type: input.type,
    side: input.side,
    count: input.qty,
    client_order_id: input.client_order_id,
    yes_price: input.side === "yes" ? input.limit_price_c : undefined,
    no_price: input.side === "no" ? input.limit_price_c : undefined,
    action: "buy",
  };

  try {
    const r = await fetch(`${KALSHI_API}/portfolio/orders`, {
      method: "POST",
      headers: {
        "KALSHI-ACCESS-KEY": process.env.KALSHI_API_KEY_ID!,
        "KALSHI-ACCESS-TIMESTAMP": signed.timestamp,
        "KALSHI-ACCESS-SIGNATURE": signed.signature,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, error: `HTTP ${r.status} · ${JSON.stringify(data).slice(0, 200)}`, raw: data };
    }

    // 5. 累计日限额
    _dailyState.new_orders += 1;
    _dailyState.new_dollars += stake;

    return { ok: true, order_id: data?.order?.order_id ?? data?.id, raw: data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ───────────── 拉持仓 / 余额 ─────────────

export async function fetchBalance(): Promise<{ ok: boolean; balance?: number; error?: string }> {
  const status = liveStatus();
  if (!status.enabled || !status.has_key_id || !status.has_private_key) {
    return { ok: false, error: status.reason };
  }
  const path = `/trade-api/v2/portfolio/balance`;
  const signed = signRequest("GET", path);
  if (!signed) return { ok: false, error: "signRequest failed" };
  try {
    const r = await fetch(`${KALSHI_API}/portfolio/balance`, {
      headers: {
        "KALSHI-ACCESS-KEY": process.env.KALSHI_API_KEY_ID!,
        "KALSHI-ACCESS-TIMESTAMP": signed.timestamp,
        "KALSHI-ACCESS-SIGNATURE": signed.signature,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const data = await r.json();
    const balance = parseFloat(data?.balance ?? "0");      // dollars
    return { ok: true, balance };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export const RISK_LIMITS = HARD_RISK;
