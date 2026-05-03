// pending-orders.ts · D 模式 · AI 推荐 → TZ 1 键确认 · 待确认列表
// V0.73 W1 Day 4

import fs from "node:fs";
import path from "node:path";

const PENDING_PATH = path.join(process.env.HOME || "/tmp", ".du4leaving", "pending-orders.json");

export interface PendingOrder {
  id: string;                // 短 hash · 用作 callback_data
  ticker: string;
  side: "yes" | "no";
  stake_usd: number;
  fair_prob: number;
  last_price: number;
  ev_pct: number;
  reasoning: string;
  pushed_at: string;         // ISO
  status: "pending" | "confirmed" | "rejected" | "expired";
  user_response_at?: string;
  reject_reason?: string;
}

export function readPending(): PendingOrder[] {
  try {
    if (!fs.existsSync(PENDING_PATH)) return [];
    return JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"));
  } catch {
    return [];
  }
}

export function writePending(list: PendingOrder[]): void {
  try {
    const dir = path.dirname(PENDING_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PENDING_PATH, JSON.stringify(list, null, 2));
  } catch (e) {
    console.error("写 pending-orders 失败 ·", (e as Error).message);
  }
}

// 短 id · 8 位 hex · 用作 telegram callback_data 防超长
export function shortId(): string {
  return Math.random().toString(16).slice(2, 10);
}

export function addPending(o: Omit<PendingOrder, "id" | "pushed_at" | "status">): PendingOrder {
  const list = readPending();
  const order: PendingOrder = {
    ...o,
    id: shortId(),
    pushed_at: new Date().toISOString(),
    status: "pending",
  };
  list.push(order);
  // 保留最近 50 条 · 防文件无限涨
  if (list.length > 50) list.splice(0, list.length - 50);
  writePending(list);
  return order;
}

export function findPending(id: string): PendingOrder | null {
  return readPending().find((o) => o.id === id) || null;
}

export function updatePending(id: string, patch: Partial<PendingOrder>): PendingOrder | null {
  const list = readPending();
  const idx = list.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  writePending(list);
  return list[idx];
}

// 自动过期 · 推送超 60 分钟没回复
export function expireOldPending(maxAgeSec = 3600): number {
  const list = readPending();
  const now = Date.now();
  let expired = 0;
  for (const o of list) {
    if (o.status !== "pending") continue;
    const age = (now - new Date(o.pushed_at).getTime()) / 1000;
    if (age > maxAgeSec) {
      o.status = "expired";
      expired++;
    }
  }
  if (expired > 0) writePending(list);
  return expired;
}
