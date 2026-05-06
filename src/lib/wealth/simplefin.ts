// SimpleFIN 真交易拉取 + 自动分类
// 用 SIMPLEFIN_ACCESS_TOKEN (base64 of https://user:pass@host/path)

import { createClient } from "@supabase/supabase-js";

interface SfTransaction {
  id: string;
  posted: number;
  amount: string;        // string e.g. "-12.50"
  description: string;
  pending?: boolean;
  payee?: string;
  memo?: string;
}

interface SfAccount {
  id: string;
  name: string;
  balance: string;
  org: { name: string };
  transactions?: SfTransaction[];
}

function sfUrl() {
  const token = process.env.SIMPLEFIN_ACCESS_TOKEN;
  if (!token) throw new Error("缺 SIMPLEFIN_ACCESS_TOKEN");
  const decoded = Buffer.from(token, "base64").toString();
  const u = new URL(decoded);
  const user = decodeURIComponent(u.username);
  const pass = decodeURIComponent(u.password);
  const baseUrl = `${u.protocol}//${u.hostname}${u.pathname}`;
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  return { baseUrl, auth };
}

export async function pullSimpleFin(daysBack = 30): Promise<{ accounts: SfAccount[]; total_tx: number }> {
  const { baseUrl, auth } = sfUrl();
  const startTs = Math.floor((Date.now() - daysBack * 86400000) / 1000);
  const url = `${baseUrl}/accounts?start-date=${startTs}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`SimpleFIN HTTP ${res.status}`);
  const data = await res.json();
  let total_tx = 0;
  for (const a of data.accounts || []) {
    total_tx += (a.transactions || []).length;
  }
  return { accounts: data.accounts || [], total_tx };
}

// 关键词 → 分类 · ④ Maybe transfer 一等公民 · 内部转账不污染 spending
// internal-transfer / income / fee 都从 spending 排除
const CATEGORY_RULES: Array<{ pattern: RegExp; cat: string; emoji: string }> = [
  // 优先级最高 · 内部转账 (不算 spending)
  { pattern: /capital.*one.*mobile.*pymt|capital.*one.*ach.*deposit|capital.*one.*autopay|capital.*one.*online.*pmt/i, cat: "internal-transfer", emoji: "↔" },
  { pattern: /^zelle.*from.*haoyu|^haoyu.*zheng|own.*account|own.*xfer/i, cat: "internal-transfer", emoji: "↔" },
  { pattern: /transfer.*to.*own|transfer.*from.*own|internal.*xfer|^xfer\b/i, cat: "internal-transfer", emoji: "↔" },
  { pattern: /credit.*card.*payment|cc.*payment|cardmember.*serv/i, cat: "internal-transfer", emoji: "↔" },
  // 收入 (不算 spending)
  { pattern: /gusto|happy.*global.*payroll|salary|payroll|wozniak|catchz/i, cat: "income", emoji: "💰" },
  { pattern: /interest/i, cat: "interest", emoji: "📈" },
  // 真支出
  { pattern: /starbucks|coffee|cafe|dunkin|peet/i, cat: "coffee", emoji: "☕" },
  { pattern: /doordash|uber.*eats?|grubhub|chipotle|mcdonald|chick-fil|panda|sushi|pizza|restaurant/i, cat: "food-delivery", emoji: "🍔" },
  { pattern: /h-?mart|whole foods|kroger|trader joe|target|walmart|costco|grocery|safeway/i, cat: "groceries", emoji: "🛒" },
  { pattern: /amazon|amzn/i, cat: "amazon", emoji: "📦" },
  { pattern: /shein|temu|pdd|nordstrom|macys|nike|sephora|ulta/i, cat: "shopping", emoji: "👕" },
  { pattern: /uber|lyft|gas|shell|chevron|exxon|76 station/i, cat: "transport", emoji: "🚗" },
  { pattern: /spotify|netflix|hulu|disney|youtube|apple|cloud|adobe|chatgpt|claude|github|distrokid|suno|midjourney/i, cat: "subscription", emoji: "💳" },
  { pattern: /rent|apartment|landlord|propert/i, cat: "rent", emoji: "🏠" },
  { pattern: /electric|water|gas bill|utility|att|verizon|tmobile|comcast|spectrum/i, cat: "utility", emoji: "💡" },
  { pattern: /coinbase|kraken|gemini|binance/i, cat: "crypto-buy", emoji: "₿" },
  { pattern: /kalshi|polymarket|draftkings|fanduel/i, cat: "betting", emoji: "🎰" },
  { pattern: /atm|cash withdrawal/i, cat: "cash", emoji: "💵" },
  { pattern: /fee|service charge|maintenance/i, cat: "fee", emoji: "🧾" },
  // 兜底 · transfer 关键词放最后 · 防止误匹配
  { pattern: /transfer|wire|zelle/i, cat: "transfer", emoji: "↔" },
];

// 不算"真 spending"的类目 · 异常检测 / burn rate 都跳过
export const NON_SPENDING_CATS = new Set(["internal-transfer", "transfer", "income", "interest"]);

export function categorize(description: string): { cat: string; emoji: string } {
  for (const r of CATEGORY_RULES) {
    if (r.pattern.test(description)) return { cat: r.cat, emoji: r.emoji };
  }
  return { cat: "other", emoji: "•" };
}

export function isSpending(cat: string): boolean {
  return !NON_SPENDING_CATS.has(cat);
}

export interface CategorySummary {
  cat: string;
  emoji: string;
  count: number;
  total_usd: number;
}

export interface MonthSummary {
  month_start: string;
  total_in: number;          // 收入 (正)
  total_out: number;         // 支出 (绝对值)
  net: number;               // in - out
  by_category: CategorySummary[];
  top_5_expenses: Array<{ desc: string; amount: number; date: string; cat: string; emoji: string }>;
  txs_count: number;
  daily_avg_burn: number;    // 日均 burn rate
  days_in_month: number;
  days_passed: number;
  projected_month_burn: number;
}

// 任意窗口 · [start, end) · 周报 / 现金流 / 异常 复用
export async function summarizeWindow(startDate: Date, endDate: Date, daysBackPull = 60): Promise<MonthSummary> {
  const { accounts } = await pullSimpleFin(daysBackPull);
  const startTs = startDate.getTime() / 1000;
  const endTs = endDate.getTime() / 1000;
  const days = Math.max(1, Math.round((endTs - startTs) / 86400));

  let total_in = 0;
  let total_out = 0;
  const byCat: Record<string, { emoji: string; count: number; total: number }> = {};
  const allTx: Array<{ desc: string; amount: number; date: string; cat: string; emoji: string }> = [];

  for (const a of accounts) {
    for (const tx of a.transactions || []) {
      if (tx.posted < startTs || tx.posted >= endTs) continue;
      if (tx.pending) continue;
      const amt = parseFloat(tx.amount || "0");
      const desc = tx.description || tx.payee || "(no desc)";
      const { cat, emoji } = categorize(desc);
      const date = new Date(tx.posted * 1000).toISOString().slice(0, 10);
      allTx.push({ desc: desc.slice(0, 50), amount: amt, date, cat, emoji });
      // ④ Maybe transfer 一等公民 · 内部转账/收入/利息 不算 spending
      const skipForSpending = !isSpending(cat);
      if (amt > 0) {
        if (!skipForSpending) total_in += amt;
      } else {
        if (!skipForSpending) total_out += Math.abs(amt);
      }
      if (skipForSpending) continue;
      if (!byCat[cat]) byCat[cat] = { emoji, count: 0, total: 0 };
      byCat[cat].count++;
      byCat[cat].total += Math.abs(amt);
    }
  }

  const byCategory = Object.entries(byCat)
    .map(([cat, d]) => ({ cat, emoji: d.emoji, count: d.count, total_usd: +d.total.toFixed(2) }))
    .sort((a, b) => b.total_usd - a.total_usd);

  const top_5_expenses = allTx
    .filter((t) => t.amount < 0 && isSpending(t.cat))
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 5)
    .map((t) => ({ ...t, amount: Math.abs(t.amount) }));

  const daily_avg_burn = total_out / days;

  return {
    month_start: startDate.toISOString().slice(0, 10),
    total_in: +total_in.toFixed(2),
    total_out: +total_out.toFixed(2),
    net: +(total_in - total_out).toFixed(2),
    by_category: byCategory,
    top_5_expenses,
    txs_count: allTx.length,
    daily_avg_burn: +daily_avg_burn.toFixed(2),
    days_in_month: days,
    days_passed: days,
    projected_month_burn: +(daily_avg_burn * 30).toFixed(2),
  };
}

// 检测重复账单 (recurring) · 14 天预测复用
// 算法 · 60 天回溯 · 同 description root + 金额 ±10% · 出现 ≥ 2 次 · 视为周期账单
export interface RecurringBill {
  desc: string;
  cat: string;
  emoji: string;
  avg_amount: number;
  period_days: number;
  last_date: string;
  next_predicted: string;
  occurrences: number;
}

export async function detectRecurring(daysBackPull = 60): Promise<RecurringBill[]> {
  const { accounts } = await pullSimpleFin(daysBackPull);
  const groups: Record<string, Array<{ amount: number; ts: number; desc: string }>> = {};

  for (const a of accounts) {
    for (const tx of a.transactions || []) {
      if (tx.pending) continue;
      const amt = parseFloat(tx.amount || "0");
      if (amt >= 0) continue;     // 只看支出
      const desc = (tx.description || tx.payee || "").trim();
      if (!desc) continue;
      // root key · 取前 4 词 · lowercase · 去日期数字
      const root = desc.toLowerCase()
        .replace(/\d{2,}/g, "")
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .join(" ");
      if (!root) continue;
      if (!groups[root]) groups[root] = [];
      groups[root].push({ amount: Math.abs(amt), ts: tx.posted, desc });
    }
  }

  const out: RecurringBill[] = [];
  for (const [root, txs] of Object.entries(groups)) {
    if (txs.length < 2) continue;
    txs.sort((a, b) => a.ts - b.ts);
    const avg = txs.reduce((s, t) => s + t.amount, 0) / txs.length;
    // 金额一致性检查
    const consistent = txs.every((t) => Math.abs(t.amount - avg) / avg < 0.15);
    if (!consistent) continue;
    // 周期
    const gaps = [];
    for (let i = 1; i < txs.length; i++) gaps.push((txs[i].ts - txs[i - 1].ts) / 86400);
    const period = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (period < 5 || period > 45) continue;     // 5-45 天 · 周/双周/月
    const last = txs[txs.length - 1];
    const nextTs = last.ts + period * 86400;
    const { cat, emoji } = categorize(last.desc);
    out.push({
      desc: last.desc.slice(0, 40),
      cat, emoji,
      avg_amount: +avg.toFixed(2),
      period_days: +period.toFixed(0),
      last_date: new Date(last.ts * 1000).toISOString().slice(0, 10),
      next_predicted: new Date(nextTs * 1000).toISOString().slice(0, 10),
      occurrences: txs.length,
    });
  }
  return out.sort((a, b) => a.next_predicted.localeCompare(b.next_predicted));
}

export async function summarizeMonth(daysBack = 30): Promise<MonthSummary> {
  const { accounts } = await pullSimpleFin(daysBack);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartTs = monthStart.getTime() / 1000;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = Math.max(1, now.getDate());

  let total_in = 0;
  let total_out = 0;
  const byCat: Record<string, { emoji: string; count: number; total: number }> = {};
  const allTx: Array<{ desc: string; amount: number; date: string; cat: string; emoji: string }> = [];

  for (const a of accounts) {
    for (const tx of a.transactions || []) {
      if (tx.posted < monthStartTs) continue;
      if (tx.pending) continue;
      const amt = parseFloat(tx.amount || "0");
      const desc = tx.description || tx.payee || "(no desc)";
      const { cat, emoji } = categorize(desc);
      const date = new Date(tx.posted * 1000).toISOString().slice(0, 10);
      allTx.push({ desc: desc.slice(0, 50), amount: amt, date, cat, emoji });
      const skipForSpending = !isSpending(cat);
      if (amt > 0) {
        if (!skipForSpending) total_in += amt;
      } else {
        if (!skipForSpending) total_out += Math.abs(amt);
      }
      if (skipForSpending) continue;
      if (!byCat[cat]) byCat[cat] = { emoji, count: 0, total: 0 };
      byCat[cat].count++;
      byCat[cat].total += Math.abs(amt);
    }
  }

  const byCategory = Object.entries(byCat)
    .map(([cat, d]) => ({ cat, emoji: d.emoji, count: d.count, total_usd: +d.total.toFixed(2) }))
    .sort((a, b) => b.total_usd - a.total_usd);

  const top_5_expenses = allTx
    .filter((t) => t.amount < 0 && isSpending(t.cat))
    .sort((a, b) => a.amount - b.amount)         // 负数最小 = 最大支出
    .slice(0, 5)
    .map((t) => ({ ...t, amount: Math.abs(t.amount) }));

  const daily_avg_burn = total_out / daysPassed;
  const projected_month_burn = daily_avg_burn * daysInMonth;

  return {
    month_start: monthStart.toISOString().slice(0, 10),
    total_in: +total_in.toFixed(2),
    total_out: +total_out.toFixed(2),
    net: +(total_in - total_out).toFixed(2),
    by_category: byCategory,
    top_5_expenses,
    txs_count: allTx.length,
    daily_avg_burn: +daily_avg_burn.toFixed(2),
    days_in_month: daysInMonth,
    days_passed: daysPassed,
    projected_month_burn: +projected_month_burn.toFixed(2),
  };
}
