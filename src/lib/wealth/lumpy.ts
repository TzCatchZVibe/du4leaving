// ② YNAB True Expenses · 大坑提前摊月 · "EB-1A $7000 · 2027-12 · 现在 $X/月留出"

import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export interface Lumpy {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  total_usd: number;
  due_date: string | null;
  paid_usd: number;
  active: boolean;
  notes: string | null;
}

export interface LumpyEnriched extends Lumpy {
  remaining_usd: number;
  months_to_due: number | null;
  monthly_save_needed: number;
  pct_paid: number;
}

export async function listLumpy(): Promise<LumpyEnriched[]> {
  const c = sb();
  const { data } = await c.from("lumpy_expenses").select("*").eq("active", true).order("due_date", { ascending: true, nullsFirst: false });
  const now = Date.now();
  return ((data as any[]) || []).map((l) => {
    const total = Number(l.total_usd);
    const paid = Number(l.paid_usd);
    const remaining = Math.max(0, total - paid);
    let months: number | null = null;
    if (l.due_date) {
      const ms = new Date(l.due_date).getTime() - now;
      months = Math.max(1, Math.floor(ms / (30 * 86400000)));
    }
    return {
      id: l.id,
      slug: l.slug,
      name: l.name,
      emoji: l.emoji || "⚠️",
      total_usd: total,
      due_date: l.due_date,
      paid_usd: paid,
      active: l.active,
      notes: l.notes,
      remaining_usd: +remaining.toFixed(2),
      months_to_due: months,
      monthly_save_needed: months ? +(remaining / months).toFixed(2) : 0,
      pct_paid: total > 0 ? +((paid / total) * 100).toFixed(0) : 0,
    };
  });
}

export interface LumpyTotal {
  monthly_total_needed: number;
  total_remaining: number;
  items: LumpyEnriched[];
}

export async function lumpyTotal(): Promise<LumpyTotal> {
  const items = await listLumpy();
  const monthly = items.reduce((s, i) => s + i.monthly_save_needed, 0);
  const total = items.reduce((s, i) => s + i.remaining_usd, 0);
  return {
    monthly_total_needed: +monthly.toFixed(2),
    total_remaining: +total.toFixed(2),
    items,
  };
}

export async function setLumpyPaid(slug: string, paid_usd: number): Promise<Lumpy | null> {
  const c = sb();
  const { data } = await c.from("lumpy_expenses").update({ paid_usd }).eq("slug", slug).select("*").maybeSingle();
  return (data as any) || null;
}
