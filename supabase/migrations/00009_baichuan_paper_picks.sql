-- 百川 W1 D5 · paper_picks 表 · 4 模式 co-pilot 自动跟踪
-- 每个 cron 推荐 + 用户手动确认 · 都记进来 · 自动跟踪 settled · 算 WR/ROI

create table public.baichuan_paper_picks (
  id uuid primary key default gen_random_uuid(),
  pick_id text unique not null,                -- 短 hash · 跟 telegram callback 一致

  -- 推荐时数据 ·
  ticker text not null,                         -- Kalshi market ticker
  title text,
  yes_subtitle text,                            -- "押 YES 代表"
  side text not null check (side in ('yes', 'no')),
  entry_price numeric not null,                 -- 0-1 (e.g. 0.44)
  fair_prob numeric not null,                   -- LLM 估真概率 0-1
  ev_pct numeric not null,                      -- 入场时 EV %
  reasoning text,
  source text not null default 'cron',          -- 'cron' | 'manual' | 'd-confirm'

  -- 模拟仓位 (paper · 不是真钱) ·
  paper_stake_usd numeric not null default 1.0, -- 默认每单 $1 paper

  -- 时间戳 ·
  created_at timestamptz not null default now(),
  market_close_at timestamptz,
  settled_at timestamptz,

  -- 结果 ·
  market_status text not null default 'pending', -- 'pending' | 'active' | 'finalized'
  market_result text,                            -- 'yes' | 'no'
  paper_pnl_usd numeric,                         -- 结算盈亏 (paper)
  paper_pnl_pct numeric                          -- ROI %
);

create index idx_baichuan_paper_picks_ticker on public.baichuan_paper_picks (ticker);
create index idx_baichuan_paper_picks_status on public.baichuan_paper_picks (market_status);
create index idx_baichuan_paper_picks_created on public.baichuan_paper_picks (created_at desc);

comment on table public.baichuan_paper_picks is 'paper 推荐跟踪 · LLM 估值 vs 真实结算 · 算 WR + ROI 验证模型';

-- RLS · 开 · 仅 service role 写
alter table public.baichuan_paper_picks enable row level security;

create policy "service role full access"
  on public.baichuan_paper_picks
  for all
  using (true)
  with check (true);
