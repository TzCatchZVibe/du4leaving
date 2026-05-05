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

// 关键词 → 分类
const CATEGORY_RULES: Array<{ pattern: RegExp; cat: string; emoji: string }> = [
  { pattern: /starbucks|coffee|cafe|dunkin|peet/i, cat: "coffee", emoji: "☕" },
  { pattern: /doordash|uber.*eats?|grubhub|chipotle|mcdonald|chick-fil|panda|sushi|pizza|restaurant/i, cat: "food-delivery", emoji: "🍔" },
  { pattern: /h-?mart|whole foods|kroger|trader joe|target|walmart|costco|grocery|safeway/i, cat: "groceries", emoji: "🛒" },
  { pattern: /amazon|amzn/i, cat: "amazon", emoji: "📦" },
  { pattern: /shein|temu|pdd|nordstrom|macys|nike|sephora|ulta/i, cat: "shopping", emoji: "👕" },
  { pattern: /uber|lyft|gas|shell|chevron|exxon|76 station/i, cat: "transport", emoji: "🚗" },
  { pattern: /spotify|netflix|hulu|disney|youtube|apple|cloud|adobe|chatgpt|claude|github/i, cat: "subscription", emoji: "💳" },
  { pattern: /rent|apartment|landlord|propert/i, cat: "rent", emoji: "🏠" },
  { pattern: /electric|water|gas bill|utility|att|verizon|tmobile|comcast|spectrum/i, cat: "utility", emoji: "💡" },
  { pattern: /coinbase|kraken|gemini|binance/i, cat: "crypto-buy", emoji: "₿" },
  { pattern: /kalshi|polymarket|draftkings|fanduel/i, cat: "betting", emoji: "🎰" },
  { pattern: /transfer.*to|wire/i, cat: "transfer", emoji: "↔" },
  { pattern: /salary|payroll|deposit.*from|happy global/i, cat: "income", emoji: "💰" },
  { pattern: /atm|cash withdrawal/i, cat: "cash", emoji: "💵" },
  { pattern: /interest/i, cat: "interest", emoji: "📈" },
  { pattern: /fee|service charge/i, cat: "fee", emoji: "🧾" },
];

export function categorize(description: string): { cat: string; emoji: string } {
  for (const r of CATEGORY_RULES) {
    if (r.pattern.test(description)) return { cat: r.cat, emoji: r.emoji };
  }
  return { cat: "other", emoji: "•" };
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
      if (amt > 0) {
        total_in += amt;
      } else {
        total_out += Math.abs(amt);
      }
      if (!byCat[cat]) byCat[cat] = { emoji, count: 0, total: 0 };
      byCat[cat].count++;
      byCat[cat].total += Math.abs(amt);
    }
  }

  const byCategory = Object.entries(byCat)
    .map(([cat, d]) => ({ cat, emoji: d.emoji, count: d.count, total_usd: +d.total.toFixed(2) }))
    .sort((a, b) => b.total_usd - a.total_usd);

  const top_5_expenses = allTx
    .filter((t) => t.amount < 0)
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
