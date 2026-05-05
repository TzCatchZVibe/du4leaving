-- DCA + 强制储蓄 · 阶段 #7
-- 每周 / 每月 自动提醒 · TZ 手动转 (后续接 Coinbase API 自动)

create table public.dca_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'tz',
  slug text unique not null,                    -- 'btc-weekly' / 'eth-weekly' / 'savings-monthly'
  name text not null,
  ticker text,                                   -- 'BTC' / 'ETH' / null (savings)
  amount_usd numeric not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  day_of_period int default 1,                  -- 1=周一 / 1=月初 (depends on frequency)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  notes text
);

create table public.dca_executions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.dca_plans(id) on delete cascade,
  scheduled_at timestamptz not null,
  amount_usd numeric not null,
  status text not null default 'pending' check (status in ('pending', 'executed', 'skipped', 'failed')),
  ticker_price_usd numeric,                     -- 执行时价 (BTC/ETH)
  notes text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create index idx_dca_executions_plan on public.dca_executions (plan_id, scheduled_at desc);
create index idx_dca_executions_status on public.dca_executions (status, scheduled_at);

alter table public.dca_plans enable row level security;
alter table public.dca_executions enable row level security;
create policy "service role dca_plans" on public.dca_plans for all using (true) with check (true);
create policy "service role dca_executions" on public.dca_executions for all using (true) with check (true);

-- 默认 plans · 你后续可改
insert into public.dca_plans (slug, name, ticker, amount_usd, frequency, day_of_period) values
  ('btc-weekly', 'BTC 周定投', 'BTC', 25, 'weekly', 1),
  ('eth-weekly', 'ETH 周定投', 'ETH', 15, 'weekly', 1),
  ('savings-monthly', '强制储蓄 (划走不动)', null, 200, 'monthly', 1)
on conflict (slug) do nothing;
