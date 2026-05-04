// 财富模块 · Supabase 持久化 · CRUD + 聚合

import { createClient } from "@supabase/supabase-js";
import type { WealthAccount, WealthBalance, WealthGoal, NetWorthSummary, AccountCategory } from "./types";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("缺 SUPABASE 配置");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─────── Accounts ───────

export async function listAccounts(activeOnly = true): Promise<WealthAccount[]> {
  const c = sb();
  let q = c.from("wealth_accounts").select("*").order("category", { ascending: true });
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function findAccount(slug: string): Promise<WealthAccount | null> {
  const c = sb();
  const { data } = await c.from("wealth_accounts").select("*").eq("slug", slug).maybeSingle();
  return (data as any) || null;
}

export async function upsertAccount(a: Partial<WealthAccount> & { slug: string; name: string; category: AccountCategory }): Promise<WealthAccount> {
  const c = sb();
  const { data, error } = await c
    .from("wealth_accounts")
    .upsert(a, { onConflict: "slug" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─────── Balances ───────

export async function recordBalance(account_id: string, balance: number, source = "manual", notes?: string): Promise<WealthBalance> {
  const c = sb();
  const { data, error } = await c
    .from("wealth_balances")
    .insert({ account_id, balance, source, notes })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function recordBalanceBySlug(slug: string, balance: number, source = "manual", notes?: string): Promise<WealthBalance> {
  const acc = await findAccount(slug);
  if (!acc) throw new Error(`账户 ${slug} 不存在 · 先建`);
  return recordBalance(acc.id, balance, source, notes);
}

export async function latestBalanceFor(account_id: string): Promise<WealthBalance | null> {
  const c = sb();
  const { data } = await c
    .from("wealth_balances")
    .select("*")
    .eq("account_id", account_id)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as any) || null;
}

// ─────── Net Worth Summary ───────

export async function netWorthSummary(): Promise<NetWorthSummary> {
  const accounts = await listAccounts();
  const c = sb();
  let total = 0;
  const byCategory: Record<string, number> = {};
  const byAccount: NetWorthSummary["by_account"] = [];

  for (const a of accounts) {
    const latest = await latestBalanceFor(a.id);
    const bal = latest ? Number(latest.balance) : 0;
    total += bal;
    byCategory[a.category] = (byCategory[a.category] || 0) + bal;
    byAccount.push({
      slug: a.slug,
      name: a.name,
      category: a.category,
      balance: bal,
      last_ts: latest?.ts || a.created_at,
    });
  }

  // 历史快照对比 · 7d / 30d
  const ago7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: snaps } = await c
    .from("wealth_snapshots")
    .select("snapshot_date, total_usd")
    .lte("snapshot_date", ago7)
    .order("snapshot_date", { ascending: false })
    .limit(2);
  const snap7 = snaps?.find((s: any) => s.snapshot_date <= ago7);
  const { data: snaps30 } = await c
    .from("wealth_snapshots")
    .select("snapshot_date, total_usd")
    .lte("snapshot_date", ago30)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const snap30 = snaps30?.[0];

  return {
    total_usd: +total.toFixed(2),
    by_category: byCategory as any,
    by_account: byAccount,
    delta_7d: snap7 ? +(total - Number(snap7.total_usd)).toFixed(2) : undefined,
    delta_30d: snap30 ? +(total - Number(snap30.total_usd)).toFixed(2) : undefined,
    account_count: accounts.length,
    ts: new Date().toISOString(),
  };
}

// ─────── Snapshot · 每日 1 条 ───────

export async function takeSnapshot(): Promise<{ created: boolean; snapshot: any }> {
  const summary = await netWorthSummary();
  const today = new Date().toISOString().slice(0, 10);
  const c = sb();
  const { data, error } = await c
    .from("wealth_snapshots")
    .upsert(
      {
        snapshot_date: today,
        total_usd: summary.total_usd,
        by_category: summary.by_category,
        account_count: summary.account_count,
      },
      { onConflict: "user_id,snapshot_date" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return { created: true, snapshot: data };
}

// ─────── Goals ───────

export async function listGoals(): Promise<WealthGoal[]> {
  const c = sb();
  const { data } = await c.from("wealth_goals").select("*").eq("active", true).order("deadline_date", { ascending: true });
  return data || [];
}

export async function updateGoalCurrent(slug: string, current_usd: number): Promise<WealthGoal | null> {
  const c = sb();
  const { data } = await c
    .from("wealth_goals")
    .update({ current_usd })
    .eq("slug", slug)
    .select("*")
    .maybeSingle();
  return (data as any) || null;
}

// ─────── CSV Export · #22 去中心化承诺 ───────

export async function exportAllAsCsv(): Promise<string> {
  const accounts = await listAccounts(false);
  const c = sb();
  const lines = ["type,slug,name,category,balance,ts,source,notes"];

  // 账户 · 1 行 1 个 · balance = 最新
  for (const a of accounts) {
    const latest = await latestBalanceFor(a.id);
    const bal = latest ? Number(latest.balance) : 0;
    const ts = latest?.ts || a.created_at;
    lines.push(`account,${a.slug},"${a.name}",${a.category},${bal},${ts},${a.source},"${a.notes || ""}"`);
  }

  // 余额全历史
  const { data: balances } = await c
    .from("wealth_balances")
    .select("*, account:wealth_accounts(slug, name, category)")
    .order("ts", { ascending: false })
    .limit(5000);
  for (const b of balances || []) {
    const acc: any = (b as any).account;
    lines.push(`balance,${acc?.slug || ""},"${acc?.name || ""}",${acc?.category || ""},${b.balance},${b.ts},${b.source},"${b.notes || ""}"`);
  }

  // 目标
  const goals = await listGoals();
  for (const g of goals) {
    lines.push(`goal,${g.slug},"${g.name}",goal,${g.current_usd}/${g.target_usd},${g.deadline_date || ""},,"${g.notes || ""}"`);
  }

  return lines.join("\n");
}
