-- 财富 W1 · 账户 + 余额历史 + 快照
-- 阶段 1 #1 起床 1 屏看完所有钱
-- 阶段 1 #22 1 键导出 CSV (去中心化承诺)

-- 账户 · 银行 / 加密 / Kalshi / 现金 / EP 基金 / etc.
create table public.wealth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'tz',                 -- 多用户预备 · 现在 'tz'
  slug text unique not null,                          -- 'bank-chase' / 'kalshi' / 'coinbase' / 'cash'
  name text not null,                                 -- "Chase 主账户"
  category text not null check (category in ('bank', 'crypto', 'prediction', 'cash', 'goal', 'broker', 'other')),
  currency text not null default 'USD',
  source text not null default 'manual',              -- 'manual' | 'simplefin' | 'kalshi-api' | 'coinbase-api'
  external_id text,                                    -- SimpleFIN account id / Kalshi key id 等
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text
);

-- 余额历史 · 每次更新插一条 · 不 update · 历史不丢
create table public.wealth_balances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wealth_accounts(id) on delete cascade,
  balance numeric not null,                           -- 用户币种 (大多 USD)
  ts timestamptz not null default now(),              -- 这次余额时间
  source text not null default 'manual',              -- 'manual' | 'sync' | 'system'
  notes text
);

-- 净值快照 · 每天 1 条 · 用于趋势图
create table public.wealth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'tz',
  snapshot_date date not null,
  total_usd numeric not null,
  by_category jsonb not null default '{}',            -- { bank: 123, crypto: 456, prediction: 78, cash: 9 }
  account_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

-- 目标 · 阶段 1 #2 起床看离目标多远 · 阶段 4 #21 EP 独立账户
create table public.wealth_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'tz',
  slug text unique not null,                          -- 'greencard' | 'ep-record' | 'house-down' | 'cybertruck'
  name text not null,                                 -- "绿卡基金"
  target_usd numeric not null,                        -- $X
  current_usd numeric not null default 0,
  deadline_date date,                                  -- 期望日 · null 即无截止
  emoji text default '🎯',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  notes text
);

-- index
create index idx_wealth_balances_account on public.wealth_balances (account_id, ts desc);
create index idx_wealth_snapshots_date on public.wealth_snapshots (user_id, snapshot_date desc);

-- RLS · service role 全权限
alter table public.wealth_accounts enable row level security;
alter table public.wealth_balances enable row level security;
alter table public.wealth_snapshots enable row level security;
alter table public.wealth_goals enable row level security;

create policy "service role wealth_accounts" on public.wealth_accounts for all using (true) with check (true);
create policy "service role wealth_balances" on public.wealth_balances for all using (true) with check (true);
create policy "service role wealth_snapshots" on public.wealth_snapshots for all using (true) with check (true);
create policy "service role wealth_goals" on public.wealth_goals for all using (true) with check (true);

-- 初始 · TZ 默认账户 · 你后续可改
insert into public.wealth_accounts (slug, name, category, source) values
  ('cash', '现金 · Cash', 'cash', 'manual'),
  ('kalshi', 'Kalshi 账户', 'prediction', 'kalshi-api'),
  ('coinbase', 'Coinbase 加密', 'crypto', 'manual'),
  ('bank-checking', '银行 · Checking', 'bank', 'manual'),
  ('bank-savings', '银行 · Savings', 'bank', 'manual'),
  ('hg-receivable', 'HG 应收 (未到账)', 'other', 'manual')
on conflict (slug) do nothing;

-- 初始 · 4 个目标
insert into public.wealth_goals (slug, name, target_usd, deadline_date, emoji) values
  ('greencard', '绿卡基金', 30000, '2029-12-31', '🇺🇸'),
  ('ep-record', 'EP 录音 + 推广', 3000, '2026-12-31', '🎤'),
  ('house-down', '2031 房首付', 80000, '2031-06-01', '🏠'),
  ('cybertruck', 'Cybertruck', 60000, '2031-12-31', '🛻')
on conflict (slug) do nothing;
