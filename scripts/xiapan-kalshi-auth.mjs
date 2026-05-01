// 虾盘 · Kalshi API auth helper (RSA-PSS 签名)
// 给其他 mjs 脚本 import 用
//
// 必需 env (~/.openclaw/xiapan/.env 或 ~/catchzvibe/.env.local) ·
//   KALSHI_API_KEY_ID         · Kalshi 后台拿的 key UUID
//   KALSHI_PRIVATE_KEY        · RSA private key PEM (含 BEGIN/END)
//   或 KALSHI_PRIVATE_KEY_FILE 指向 .pem 文件路径
//
// docs · https://trading-api.readme.io/reference/api-overview

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

export function loadXiapanEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.join(os.homedir(), ".openclaw/xiapan/.env"),
    path.join(os.homedir(), "catchzvibe/.env.local"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, "utf8");
    // 处理多行 PEM (允许 KEY="-----BEGIN ...\n...-----END ...")
    const lines = raw.split(/\r?\n/);
    let inMultiline = false;
    let mlKey = "";
    let mlVal = "";
    for (const line of lines) {
      if (inMultiline) {
        mlVal += "\n" + line;
        if (line.trim().endsWith('"') || line.trim().endsWith("'")) {
          mlVal = mlVal.replace(/^["']|["']$/g, "");
          if (!process.env[mlKey]) process.env[mlKey] = mlVal;
          inMultiline = false;
          mlKey = "";
          mlVal = "";
        }
        continue;
      }
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') || v.startsWith("'")) && !v.slice(1).match(/["']$/)) {
        // 多行 PEM 起始
        inMultiline = true;
        mlKey = k;
        mlVal = v.slice(1);
        continue;
      }
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

export function getPrivateKey() {
  let key = process.env.KALSHI_PRIVATE_KEY;
  const file = process.env.KALSHI_PRIVATE_KEY_FILE;
  if (!key && file) {
    const p = file.startsWith("~") ? path.join(os.homedir(), file.slice(1)) : file;
    if (fs.existsSync(p)) key = fs.readFileSync(p, "utf8");
  }
  if (!key) {
    throw new Error(
      "缺 KALSHI_PRIVATE_KEY · 设 env 或 KALSHI_PRIVATE_KEY_FILE 指向 .pem"
    );
  }
  // 处理 \n 转义
  return key.replace(/\\n/g, "\n");
}

export function getKeyId() {
  const id = process.env.KALSHI_API_KEY_ID;
  if (!id) throw new Error("缺 KALSHI_API_KEY_ID");
  return id;
}

export function signRequest(method, requestPath) {
  const ts = Date.now().toString();
  // 签名内容: timestamp + METHOD + path (不含 query string · 注意 Kalshi 文档说含 path 但不含 query)
  // 实测: Kalshi v2 要求只签 path 部分 (不含 ?query)
  const pathOnly = requestPath.split("?")[0];
  const msg = ts + method.toUpperCase() + pathOnly;
  const privateKey = getPrivateKey();
  const sig = crypto
    .sign("sha256", Buffer.from(msg), {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    })
    .toString("base64");
  return {
    "KALSHI-ACCESS-KEY": getKeyId(),
    "KALSHI-ACCESS-SIGNATURE": sig,
    "KALSHI-ACCESS-TIMESTAMP": ts,
  };
}

export async function authedKalshi(method, p, body) {
  const url = `${KALSHI_BASE}${p}`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Xiapan/0.1",
    ...signRequest(method, `/trade-api/v2${p}`),
  };
  const r = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text };
  }
  if (!r.ok) {
    const err = new Error(`Kalshi ${method} ${p} ${r.status}`);
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const KALSHI_BASE_URL = KALSHI_BASE;
