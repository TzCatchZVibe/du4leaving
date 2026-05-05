-- 阶段 1 #4 · 冲动 lockdown · 大单 24h 冷静期
-- 想花钱 ≥ $20 · /等等 记下 · 24h 后系统问 "还要吗"
-- 多数时候你 24h 后不要了 · 省钱

create type purchase_decision as enum ('pending', 'approved', 'cancelled', 'expired');

create table public.pending_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'tz',
  short_id text unique not null,                     -- 8 字符 hex · Telegram 引用用
  amount_usd numeric not null,
  description text not null,
  category text default 'other',                      -- 'food' | 'shopping' | 'kalshi' | 'tech' | 'travel' | 'other'
  cooldown_hours int not null default 24,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,                    -- created_at + cooldown_hours · 之后会触发提醒
  reminded_at timestamptz,                            -- 提醒过 1 次的时间
  decision purchase_decision not null default 'pending',
  decided_at timestamptz,
  notes text                                          -- TZ 可写 "为什么想买"
);

create index idx_pending_purchases_user on public.pending_purchases (user_id, created_at desc);
create index idx_pending_purchases_status on public.pending_purchases (decision, expires_at);

alter table public.pending_purchases enable row level security;
create policy "service role pending_purchases" on public.pending_purchases for all using (true) with check (true);

-- 月度 Wrapped 用 view · 看你这月 cancel 多少 · 省了多少
create view public.lockdown_savings as
select
  user_id,
  date_trunc('month', created_at) as month,
  count(*) filter (where decision = 'cancelled') as cancelled_count,
  count(*) filter (where decision = 'approved') as approved_count,
  count(*) filter (where decision = 'pending') as pending_count,
  coalesce(sum(amount_usd) filter (where decision = 'cancelled'), 0) as saved_usd,
  coalesce(sum(amount_usd) filter (where decision = 'approved'), 0) as spent_usd
from public.pending_purchases
group by user_id, date_trunc('month', created_at);
