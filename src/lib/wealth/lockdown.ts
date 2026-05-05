// 冲动 lockdown · 阶段 1 #4
// 大单 ≥ $20 · /等等 记下 · 24h 后再决定 · 省钱多

import { createClient } from "@supabase/supabase-js";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("缺 SUPABASE 配置");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface PendingPurchase {
  id: string;
  short_id: string;
  amount_usd: number;
  description: string;
  category: string;
  cooldown_hours: number;
  created_at: string;
  expires_at: string;
  reminded_at?: string;
  decision: "pending" | "approved" | "cancelled" | "expired";
  decided_at?: string;
  notes?: string;
}

export const COOLDOWN_THRESHOLD_USD = 20;
export const DEFAULT_COOLDOWN_HOURS = 24;

function shortId(): string {
  return Math.random().toString(16).slice(2, 10);
}

export function classifyCategory(description: string): string {
  const d = description.toLowerCase();
  if (/[餐]|吃|饭|外卖|doordash|ubereats|food|coffee|starbucks/.test(d)) return "food";
  if (/[衣裤鞋]|淘宝|pdd|amazon|ebay|shopping|clothes/.test(d)) return "shopping";
  if (/kalshi|polymarket|赌|押|bet/.test(d)) return "kalshi";
  if (/[书课]|tech|app|订阅|subscription|software/.test(d)) return "tech";
  if (/[酒店机票]|航班|trip|hotel|flight|airbnb/.test(d)) return "travel";
  return "other";
}

export async function createPending(opts: {
  amount_usd: number;
  description: string;
  category?: string;
  cooldown_hours?: number;
  notes?: string;
}): Promise<PendingPurchase> {
  const c = sb();
  const cooldown = opts.cooldown_hours ?? DEFAULT_COOLDOWN_HOURS;
  const expires = new Date(Date.now() + cooldown * 3600 * 1000).toISOString();
  const cat = opts.category || classifyCategory(opts.description);
  const { data, error } = await c
    .from("pending_purchases")
    .insert({
      short_id: shortId(),
      amount_usd: opts.amount_usd,
      description: opts.description,
      category: cat,
      cooldown_hours: cooldown,
      expires_at: expires,
      notes: opts.notes,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listPending(): Promise<PendingPurchase[]> {
  const c = sb();
  const { data } = await c
    .from("pending_purchases")
    .select("*")
    .eq("decision", "pending")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function listAll(days = 30): Promise<PendingPurchase[]> {
  const c = sb();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await c
    .from("pending_purchases")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function decide(short_id: string, decision: "approved" | "cancelled"): Promise<PendingPurchase | null> {
  const c = sb();
  const { data, error } = await c
    .from("pending_purchases")
    .update({ decision, decided_at: new Date().toISOString() })
    .eq("short_id", short_id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function findByShortId(short_id: string): Promise<PendingPurchase | null> {
  const c = sb();
  const { data } = await c
    .from("pending_purchases")
    .select("*")
    .eq("short_id", short_id)
    .maybeSingle();
  return (data as any) || null;
}

// 找 expired (≥ 24h 还 pending 的) · 但还没标记 expired 的
export async function findExpiredNotReminded(): Promise<PendingPurchase[]> {
  const c = sb();
  const now = new Date().toISOString();
  const { data } = await c
    .from("pending_purchases")
    .select("*")
    .eq("decision", "pending")
    .lt("expires_at", now)
    .is("reminded_at", null)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function markReminded(short_id: string) {
  const c = sb();
  await c
    .from("pending_purchases")
    .update({ reminded_at: new Date().toISOString() })
    .eq("short_id", short_id);
}

// 月度统计
export async function monthSavings(monthOffset = 0): Promise<any> {
  const c = sb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1).toISOString();
  const { data } = await c
    .from("pending_purchases")
    .select("*")
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);
  const all = data || [];
  const cancelled = all.filter((p: any) => p.decision === "cancelled");
  const approved = all.filter((p: any) => p.decision === "approved");
  const pending = all.filter((p: any) => p.decision === "pending");
  const saved = cancelled.reduce((s: number, p: any) => s + Number(p.amount_usd), 0);
  const spent = approved.reduce((s: number, p: any) => s + Number(p.amount_usd), 0);
  return {
    month_start: monthStart,
    cancelled_count: cancelled.length,
    approved_count: approved.length,
    pending_count: pending.length,
    saved_usd: +saved.toFixed(2),
    spent_usd: +spent.toFixed(2),
    save_rate_pct: all.length ? +(cancelled.length / all.length * 100).toFixed(1) : 0,
  };
}
