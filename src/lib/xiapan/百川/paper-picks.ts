// paper-picks.ts · paper 跟踪库 · Supabase 持久化
// V0.73 W1 Day 5 · 4 模式 co-pilot 验证模型 ROI

import { createClient } from "@supabase/supabase-js";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("缺 SUPABASE 配置");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface PaperPick {
  pick_id: string;
  ticker: string;
  title?: string;
  yes_subtitle?: string;
  side: "yes" | "no";
  entry_price: number;
  fair_prob: number;
  ev_pct: number;
  reasoning?: string;
  source?: "cron" | "manual" | "d-confirm";
  paper_stake_usd?: number;
  market_close_at?: string;
}

export function shortPickId(): string {
  return Math.random().toString(16).slice(2, 10);
}

export async function recordPaperPick(p: PaperPick): Promise<{ id: string } | null> {
  try {
    const c = sb();
    const { data, error } = await c
      .from("baichuan_paper_picks")
      .insert({
        pick_id: p.pick_id,
        ticker: p.ticker,
        title: p.title,
        yes_subtitle: p.yes_subtitle,
        side: p.side,
        entry_price: p.entry_price,
        fair_prob: p.fair_prob,
        ev_pct: p.ev_pct,
        reasoning: p.reasoning,
        source: p.source ?? "cron",
        paper_stake_usd: p.paper_stake_usd ?? 1.0,
        market_close_at: p.market_close_at,
      })
      .select("id")
      .single();
    if (error) {
      console.error("recordPaperPick err ·", error.message);
      return null;
    }
    return { id: data.id };
  } catch (e: any) {
    console.error("recordPaperPick fail ·", e.message);
    return null;
  }
}

// 查 pending 的 paper picks · 准备 tick
export async function listPendingPicks(): Promise<any[]> {
  try {
    const c = sb();
    const { data } = await c
      .from("baichuan_paper_picks")
      .select("*")
      .in("market_status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(100);
    return data || [];
  } catch {
    return [];
  }
}

// 标记一笔为 settled · 计算 paper P&L
export async function settlePick(
  pickRow: any,
  marketResult: "yes" | "no",
  marketStatus = "finalized"
): Promise<{ pnl_usd: number; pnl_pct: number }> {
  // paper P&L 计算 ·
  // 押 yes · result yes  → 赢 · pnl = stake * (1/entry - 1)
  // 押 yes · result no   → 输 · pnl = -stake
  // 押 no  · result no   → 赢 · pnl = stake * (1/(1-entry) - 1)
  // 押 no  · result yes  → 输 · pnl = -stake
  const stake = Number(pickRow.paper_stake_usd ?? 1.0);
  const entry = Number(pickRow.entry_price);
  let pnl_usd = 0;
  if (pickRow.side === marketResult) {
    pnl_usd = pickRow.side === "yes"
      ? stake * (1 / entry - 1)
      : stake * (1 / (1 - entry) - 1);
  } else {
    pnl_usd = -stake;
  }
  const pnl_pct = (pnl_usd / stake) * 100;

  try {
    const c = sb();
    await c
      .from("baichuan_paper_picks")
      .update({
        market_status: marketStatus,
        market_result: marketResult,
        settled_at: new Date().toISOString(),
        paper_pnl_usd: pnl_usd,
        paper_pnl_pct: pnl_pct,
      })
      .eq("id", pickRow.id);
  } catch (e: any) {
    console.error("settlePick fail ·", e.message);
  }
  return { pnl_usd, pnl_pct };
}

// 统计 · 用于 /统计 命令
export async function summary(days = 7): Promise<any> {
  try {
    const c = sb();
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const { data } = await c
      .from("baichuan_paper_picks")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    const picks = data || [];
    const total = picks.length;
    const settled = picks.filter((p: any) => p.market_status === "finalized").length;
    const open = total - settled;
    const wins = picks.filter((p: any) => p.paper_pnl_usd && p.paper_pnl_usd > 0).length;
    const losses = picks.filter((p: any) => p.paper_pnl_usd && p.paper_pnl_usd < 0).length;
    const wr = settled > 0 ? (wins / settled) * 100 : 0;
    const total_pnl = picks.reduce((s: number, p: any) => s + Number(p.paper_pnl_usd ?? 0), 0);
    const total_stake = picks.reduce((s: number, p: any) => s + Number(p.paper_stake_usd ?? 0), 0);
    const roi = total_stake > 0 ? (total_pnl / total_stake) * 100 : 0;
    return {
      days,
      total,
      settled,
      open,
      wins,
      losses,
      wr_pct: +wr.toFixed(1),
      total_pnl_usd: +total_pnl.toFixed(2),
      total_stake_usd: +total_stake.toFixed(2),
      roi_pct: +roi.toFixed(1),
      recent_5: picks.slice(0, 5).map((p: any) => ({
        ticker: p.ticker,
        side: p.side,
        ev_pct: p.ev_pct,
        status: p.market_status,
        result: p.market_result,
        pnl: p.paper_pnl_usd,
      })),
    };
  } catch (e: any) {
    return { error: e.message };
  }
}
