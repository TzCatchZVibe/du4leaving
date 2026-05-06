-- W4 终极迭代 · ① Guilty Pleasure ② True Expenses ③ Age of Money 支撑表
-- 2026-05-05 · 偷 Qapital + YNAB + Maybe 思路

-- ─────── Guilty Pleasure 罐子 (① Qapital) ───────
-- 当 TZ 在指定类目花钱 (Kalshi/外卖/Amazon 冲动) · 等额"虚拟入"目标罐
-- 不是真转账 · 是心理压力 · "$584 损失会变成 $584 EP 装备款"

create table public.guilty_jars (
  slug text primary key,
  name text not null,
  emoji text default '💰',
  target_goal_slug text,                       -- 关联到 wealth_goals.slug · 可空
  balance_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.guilty_rules (
  id uuid primary key default gen_random_uuid(),
  jar_slug text not null references public.guilty_jars(slug) on delete cascade,
  match_category text,                         -- "betting" / "food-delivery" / "amazon" 等 (categorize() 输出)
  match_pattern text,                          -- 可选 regex · 描述匹配
  multiplier numeric not null default 1.0,     -- 1.0 = 等额 · 2.0 = 双倍罚
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.guilty_events (
  id uuid primary key default gen_random_uuid(),
  jar_slug text not null references public.guilty_jars(slug),
  rule_id uuid references public.guilty_rules(id),
  simplefin_tx_id text not null,               -- dedup · 不重复计数
  tx_amount_usd numeric not null,
  jar_credit_usd numeric not null,             -- = tx * multiplier
  tx_desc text,
  tx_date date not null,
  created_at timestamptz not null default now(),
  unique (simplefin_tx_id, jar_slug)
);

create index idx_guilty_events_jar on public.guilty_events (jar_slug, tx_date desc);

-- ─────── True Expenses · 大坑提前摊月 (② YNAB) ───────
-- 例 · EB-1A 律师 $7000 · 2027-12 · → 现在每月 $200 留出 (大坑感消失)
create table public.lumpy_expenses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  emoji text default '⚠️',
  total_usd numeric not null,
  due_date date,                               -- 大概什么时候付 · 用来算月需
  paid_usd numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  notes text
);

-- ─────── 默认数据 ───────
insert into public.guilty_jars (slug, name, emoji, target_goal_slug) values
  ('ep-jar', 'EP 装备罐 (花得越多 · 罐越满)', '🎤', 'ep-record'),
  ('greencard-jar', '绿卡基金罐', '📜', 'greencard')
on conflict (slug) do nothing;

insert into public.guilty_rules (jar_slug, match_category, multiplier) values
  ('ep-jar', 'betting', 1.0),
  ('ep-jar', 'food-delivery', 1.0),
  ('ep-jar', 'amazon', 0.5),
  ('greencard-jar', 'shopping', 0.5)
on conflict do nothing;

insert into public.lumpy_expenses (slug, name, emoji, total_usd, due_date, notes) values
  ('eb1a-legal', 'EB-1A 律师费', '📜', 7000, '2027-12-31', '预估 $5-10k · 取中位'),
  ('ep-gear-physical', 'EP 装备实体 (电钢/声卡/麦)', '🎹', 1500, '2026-09-30', '电钢 $500 + 声卡 $300 + 麦 $250 + 配件 $450'),
  ('cz-camera', 'CZV 拍摄设备升级', '📷', 2000, '2026-12-31', '出镜 + 出差用'),
  ('travel-yfc', '4/12 加州 YFC 展会', '✈️', 800, '2026-04-12', '出差')
on conflict (slug) do nothing;

-- ─────── RLS ───────
alter table public.guilty_jars enable row level security;
alter table public.guilty_rules enable row level security;
alter table public.guilty_events enable row level security;
alter table public.lumpy_expenses enable row level security;
create policy "service role guilty_jars" on public.guilty_jars for all using (true) with check (true);
create policy "service role guilty_rules" on public.guilty_rules for all using (true) with check (true);
create policy "service role guilty_events" on public.guilty_events for all using (true) with check (true);
create policy "service role lumpy_expenses" on public.lumpy_expenses for all using (true) with check (true);
