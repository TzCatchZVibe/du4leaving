// 虾盘 · server-side Kalshi auth (RSA-PSS)
// 给 API routes 用 · 与 scripts/xiapan-kalshi-auth.mjs 等价

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

export function getKalshiPrivateKey(): string {
  let key = process.env.KALSHI_PRIVATE_KEY;
  const file = process.env.KALSHI_PRIVATE_KEY_FILE;
  if (!key && file) {
    const p = file.startsWith("~")
      ? path.join(os.homedir(), file.slice(1))
      : file;
    if (fs.existsSync(p)) key = fs.readFileSync(p, "utf8");
  }
  if (!key) {
    throw new Error("缺 KALSHI_PRIVATE_KEY 或 KALSHI_PRIVATE_KEY_FILE");
  }
  return key.replace(/\\n/g, "\n");
}

export function getKalshiKeyId(): string {
  const id = process.env.KALSHI_API_KEY_ID;
  if (!id) throw new Error("缺 KALSHI_API_KEY_ID");
  return id;
}

export function signKalshi(method: string, requestPath: string) {
  const ts = Date.now().toString();
  const pathOnly = requestPath.split("?")[0];
  const msg = ts + method.toUpperCase() + pathOnly;
  const privateKey = getKalshiPrivateKey();
  const sig = crypto
    .sign("sha256", Buffer.from(msg), {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    })
    .toString("base64");
  return {
    "KALSHI-ACCESS-KEY": getKalshiKeyId(),
    "KALSHI-ACCESS-SIGNATURE": sig,
    "KALSHI-ACCESS-TIMESTAMP": ts,
  };
}

export async function authedKalshi<T = unknown>(
  method: string,
  p: string,
  body?: unknown
): Promise<T> {
  const url = `${KALSHI_BASE}${p}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Xiapan/0.1",
    ...signKalshi(method, `/trade-api/v2${p}`),
  };
  const r = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await r.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text };
  }
  if (!r.ok) {
    const e = new Error(
      `Kalshi ${method} ${p} ${r.status}: ${JSON.stringify(data).slice(0, 200)}`
    );
    (e as Error & { status?: number }).status = r.status;
    throw e;
  }
  return data as T;
}

export const KALSHI_BASE_URL = KALSHI_BASE;
