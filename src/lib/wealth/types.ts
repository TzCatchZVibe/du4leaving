// 财富模块 · 类型 · W1 起步

export type AccountCategory = "bank" | "crypto" | "prediction" | "cash" | "goal" | "broker" | "other";

export interface WealthAccount {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  category: AccountCategory;
  currency: string;
  source: string;
  external_id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface WealthBalance {
  id: string;
  account_id: string;
  balance: number;
  ts: string;
  source: string;
  notes?: string;
}

export interface WealthSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_usd: number;
  by_category: Record<string, number>;
  account_count: number;
  created_at: string;
}

export interface WealthGoal {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  target_usd: number;
  current_usd: number;
  deadline_date?: string;
  emoji: string;
  active: boolean;
  created_at: string;
  notes?: string;
}

export interface NetWorthSummary {
  total_usd: number;
  by_category: Record<AccountCategory, number>;
  by_account: Array<{
    slug: string;
    name: string;
    category: AccountCategory;
    balance: number;
    last_ts: string;
  }>;
  delta_7d?: number;
  delta_30d?: number;
  account_count: number;
  ts: string;
}
