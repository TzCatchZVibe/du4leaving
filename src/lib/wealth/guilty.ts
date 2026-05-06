// ① Guilty Pleasure (Qapital 偷) · 在指定类目花钱 → 等额"虚拟入"目标罐
// 不是真转账 (SimpleFIN 只读) · 心理压力 · 你 Kalshi 输 $584 = 罐里 +$584 = 你看见
//
// 触发链 · cron daily → pull SimpleFIN → 匹配 rules → 写 events (dedup tx_id) → 累加 jar.balance

import { createClient } from "@supabase/supabase-js";
import { pullSimpleFin, categorize, isSpending } from "./simplefin";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export interface Jar {
  slug: string;
  name: string;
  emoji: string;
  target_goal_slug: string | null;
  balance_usd: number;
}

export interface JarRule {
  id: string;
  jar_slug: string;
  match_category: string | null;
  match_pattern: string | null;
  multiplier: number;
  active: boolean;
}

export async function listJars(): Promise<Jar[]> {
  const c = sb();
  const { data } = await c.from("guilty_jars").select("*").order("slug");
  return (data as any[] || []).map((j) => ({
    slug: j.slug,
    name: j.name,
    emoji: j.emoji || "💰",
    target_goal_slug: j.target_goal_slug,
    balance_usd: Number(j.balance_usd || 0),
  }));
}

export async function listRules(): Promise<JarRule[]> {
  const c = sb();
  const { data } = await c.from("guilty_rules").select("*").eq("active", true);
  return (data as any[] || []) as JarRule[];
}

export interface JarCheckResult {
  scanned: number;
  new_events: number;
  total_jar_credit: number;
  events: Array<{ jar_slug: string; tx_amount: number; jar_credit: number; tx_desc: string; tx_date: string }>;
  jars_after: Jar[];
}

// daysBack · 扫多少天 (cron 跑 1 天 / on-demand 跑 7 天)
export async function checkGuilty(daysBack = 7): Promise<JarCheckResult> {
  const c = sb();
  const [rules, { accounts }] = await Promise.all([
    listRules(),
    pullSimpleFin(daysBack),
  ]);
  if (rules.length === 0) {
    return { scanned: 0, new_events: 0, total_jar_credit: 0, events: [], jars_after: await listJars() };
  }

  const startTs = Math.floor((Date.now() - daysBack * 86400000) / 1000);
  let scanned = 0;
  const eventsToInsert: any[] = [];
  const newEventsForReturn: JarCheckResult["events"] = [];

  for (const a of accounts) {
    for (const tx of a.transactions || []) {
      if (tx.posted < startTs) continue;
      if (tx.pending) continue;
      const amt = parseFloat(tx.amount || "0");
      if (amt >= 0) continue;     // 只看支出
      const desc = tx.description || tx.payee || "";
      const { cat } = categorize(desc);
      if (!isSpending(cat)) continue;

      scanned++;
      // 匹配 rules
      for (const rule of rules) {
        let match = false;
        if (rule.match_category && rule.match_category === cat) match = true;
        if (rule.match_pattern) {
          try {
            if (new RegExp(rule.match_pattern, "i").test(desc)) match = true;
          } catch { /* bad regex */ }
        }
        if (!match) continue;

        const txAmount = Math.abs(amt);
        const credit = +(txAmount * rule.multiplier).toFixed(2);
        const txDate = new Date(tx.posted * 1000).toISOString().slice(0, 10);

        eventsToInsert.push({
          jar_slug: rule.jar_slug,
          rule_id: rule.id,
          simplefin_tx_id: tx.id,
          tx_amount_usd: txAmount,
          jar_credit_usd: credit,
          tx_desc: desc.slice(0, 200),
          tx_date: txDate,
        });
        newEventsForReturn.push({
          jar_slug: rule.jar_slug, tx_amount: txAmount, jar_credit: credit, tx_desc: desc.slice(0, 80), tx_date: txDate,
        });
      }
    }
  }

  // 批量 upsert · unique (simplefin_tx_id, jar_slug) 去重
  let new_events = 0;
  if (eventsToInsert.length > 0) {
    const { data: inserted } = await c
      .from("guilty_events")
      .upsert(eventsToInsert, { onConflict: "simplefin_tx_id,jar_slug", ignoreDuplicates: true })
      .select("jar_slug, jar_credit_usd");
    new_events = inserted?.length || 0;

    // 更新 jar balance · 简单粗暴 · 重算
    const totalsByJar: Record<string, number> = {};
    const { data: allEvents } = await c.from("guilty_events").select("jar_slug, jar_credit_usd");
    for (const e of (allEvents as any[] || [])) {
      totalsByJar[e.jar_slug] = (totalsByJar[e.jar_slug] || 0) + Number(e.jar_credit_usd);
    }
    for (const [slug, total] of Object.entries(totalsByJar)) {
      await c.from("guilty_jars").update({ balance_usd: +total.toFixed(2) }).eq("slug", slug);
    }
  }

  return {
    scanned,
    new_events,
    total_jar_credit: +newEventsForReturn.reduce((s, e) => s + e.jar_credit, 0).toFixed(2),
    events: newEventsForReturn,
    jars_after: await listJars(),
  };
}
