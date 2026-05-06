// ③ Age of Money (YNAB) · 钱龄 · 钱挣到 → 花掉的平均天数
// 简化算法 · current_cash / daily_avg_burn = 估算天数
// 越大 = 缓冲越厚 · 越小 = 越紧 · 签证缓冲指标

import { summarizeWindow, isSpending } from "./simplefin";
import { netWorthSummary } from "./store";

export interface AgeOfMoneyReport {
  age_days: number | null;       // null = 数据不足 (没 burn rate)
  cash_now: number;
  daily_burn: number;            // 近 30 天日均
  status: "thick" | "ok" | "thin" | "danger" | "no-data";
  comparison_30d_ago: number | null;
  note?: string;
}

export async function getAgeOfMoney(): Promise<AgeOfMoneyReport> {
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 86400000);

  const [spend, networth] = await Promise.all([
    summarizeWindow(last30, now, 60).catch(() => null),
    netWorthSummary().catch(() => null),
  ]);

  const cashAccts = (networth?.by_account || []).filter((a: any) =>
    a.category === "cash" || a.category === "bank" || a.slug?.includes("bank") || a.slug?.includes("cash")
  );
  const cash_now = cashAccts.reduce((s: number, a: any) => s + Number(a.balance || 0), 0);

  const daily_burn = spend?.daily_avg_burn || 0;
  if (daily_burn <= 0) {
    return {
      age_days: null,
      cash_now: +cash_now.toFixed(2),
      daily_burn: 0,
      status: "no-data",
      comparison_30d_ago: null,
      note: "近 30 天没真支出数据 (SimpleFIN 还没同步 / 全是内部转账) · 钱龄算不出",
    };
  }
  const age_days = Math.floor(cash_now / daily_burn);
  let status: AgeOfMoneyReport["status"];
  if (age_days >= 90) status = "thick";
  else if (age_days >= 45) status = "ok";
  else if (age_days >= 21) status = "thin";
  else status = "danger";

  return {
    age_days,
    cash_now: +cash_now.toFixed(2),
    daily_burn: +daily_burn.toFixed(2),
    status,
    comparison_30d_ago: null,
  };
}
