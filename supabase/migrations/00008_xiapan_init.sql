-- 虾盘 W1 · Kalshi × LOL 价值投注引擎 · 初始 schema
-- 执行: Supabase SQL Editor → 粘贴 → Run
-- 命名空间: 全部表加 `xiapan_` 前缀避免与现有表冲突

-- ========== Enums ==========
create type xiapan_match_status as enum ('scheduled', 'live', 'completed', 'cancelled');
create type xiapan_match_format as enum ('bo1', 'bo3', 'bo5');
create type xiapan_player_role as enum ('top', 'jungle', 'mid', 'adc', 'support', 'sub', 'coach');
create type xiapan_market_side as enum ('yes', 'no');
create type xiapan_bet_status as enum ('open', 'won', 'lost', 'refunded', 'cancelled');
create type xiapan_risk_severity as enum ('info', 'warn', 'critical');
create type xiapan_signal_level as enum ('skip', 'watch', 'strong');

-- ========== 1. Leagues · 联赛 ==========
create table public.xiapan_leagues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                  -- 'lck', 'lpl', 'msi', 'worlds'
  name text not null,                         -- 'LCK', 'League of Legends Pro League'
  region text not null,                       -- 'kr', 'cn', 'eu', 'na', 'intl'
  tier int not null default 1,                -- 1 = T1 联赛 / intl 赛事; 2 = 次级
  riot_league_id text,                        -- Riot Esports API league id
  leaguepedia_slug text,                      -- Leaguepedia page slug
  created_at timestamptz not null default now()
);

comment on table public.xiapan_leagues is '虾盘 · LOL 联赛 · LCK/LPL/LEC/LCS/MSI/Worlds';

-- ========== 2. Teams · 战队 (含 Elo) ==========
create table public.xiapan_teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                  -- 't1', 'gen', 'jdg'
  name text not null,                         -- 'T1', 'Gen.G', 'JDG Intel Esports Club'
  short_code text,                            -- 'T1', 'GEN', 'JDG'
  league_id uuid not null references public.xiapan_leagues(id) on delete cascade,
  elo_rating numeric(8,2) not null default 1500,
  elo_k_factor numeric(5,2) not null default 32,
  elo_last_updated_at timestamptz,
  leaguepedia_slug text,
  riot_team_id text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index xiapan_teams_league_idx on public.xiapan_teams(league_id);
create index xiapan_teams_elo_idx on public.xiapan_teams(elo_rating desc);

comment on table public.xiapan_teams is '虾盘 · 战队 · Elo 评分维护';

-- ========== 3. Players · 选手 ==========
create table public.xiapan_players (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                  -- 'faker', 'chovy'
  name text not null,
  team_id uuid references public.xiapan_teams(id) on delete set null,
  role xiapan_player_role not null,
  is_active boolean not null default true,
  kda_recent_json jsonb default '{}',         -- {recent10: 4.2, season: 3.8, ...}
  damage_share_recent numeric(5,3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index xiapan_players_team_idx on public.xiapan_players(team_id);

comment on table public.xiapan_players is '虾盘 · 选手 · 状态趋势 (KDA / 伤害份额)';

-- ========== 4. Matches · 比赛 ==========
create table public.xiapan_matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.xiapan_leagues(id) on delete cascade,
  team1_id uuid not null references public.xiapan_teams(id),
  team2_id uuid not null references public.xiapan_teams(id),
  scheduled_at timestamptz not null,
  format xiapan_match_format not null default 'bo3',
  patch text,                                 -- '14.8', '14.9'
  status xiapan_match_status not null default 'scheduled',
  winner_team_id uuid references public.xiapan_teams(id),
  team1_score int default 0,
  team2_score int default 0,
  riot_match_id text,
  leaguepedia_match_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index xiapan_matches_scheduled_idx on public.xiapan_matches(scheduled_at);
create index xiapan_matches_league_idx on public.xiapan_matches(league_id);
create index xiapan_matches_status_idx on public.xiapan_matches(status);
create unique index xiapan_matches_riot_idx on public.xiapan_matches(riot_match_id) where riot_match_id is not null;

comment on table public.xiapan_matches is '虾盘 · 比赛 · 调度 + 结果';

-- ========== 5. Markets · Kalshi 报价快照 ==========
create table public.xiapan_markets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.xiapan_matches(id) on delete cascade,
  kalshi_ticker text not null,                -- 'KXLOLGAME-25APR28T1GEN'
  kalshi_event_ticker text,
  kalshi_series_ticker text,
  side xiapan_market_side not null default 'yes',
  team_for_yes_id uuid references public.xiapan_teams(id),  -- yes 代表哪队赢
  yes_bid int,                                -- cents (0-100)
  yes_ask int,
  no_bid int,
  no_ask int,
  last_price int,
  volume_cents bigint default 0,
  open_interest_cents bigint default 0,
  status text default 'open',                 -- 'open' | 'closed' | 'settled'
  close_time timestamptz,
  snapshot_at timestamptz not null default now()
);

create index xiapan_markets_match_idx on public.xiapan_markets(match_id);
create index xiapan_markets_ticker_idx on public.xiapan_markets(kalshi_ticker);
create index xiapan_markets_snapshot_idx on public.xiapan_markets(snapshot_at desc);
-- 同一 ticker + snapshot_at 唯一 (避免重复抓取)
create unique index xiapan_markets_uniq on public.xiapan_markets(kalshi_ticker, snapshot_at);

comment on table public.xiapan_markets is '虾盘 · Kalshi 市场报价快照 · 5min 抓一次';

-- ========== 6. Predictions · 模型预测 ==========
create table public.xiapan_predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.xiapan_matches(id) on delete cascade,
  model_version text not null,                -- 'v0.1-elo', 'v0.2-elo+form'
  p1_win_prob numeric(5,4) not null,          -- 0.0000 - 1.0000
  confidence numeric(5,4),                    -- 0.0000 - 1.0000
  factors_json jsonb default '{}',            -- {elo_diff: 87, form_diff: 0.2, h2h: 0.55, patch_new: true}
  created_at timestamptz not null default now()
);

create index xiapan_predictions_match_idx on public.xiapan_predictions(match_id);
create index xiapan_predictions_model_idx on public.xiapan_predictions(model_version, created_at desc);

comment on table public.xiapan_predictions is '虾盘 · 预测引擎输出 · 一场比赛多个版本可共存';

-- ========== 7. Bets · 投注账本 ==========
create table public.xiapan_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  market_id uuid references public.xiapan_markets(id),
  match_id uuid references public.xiapan_matches(id),
  side xiapan_market_side not null,
  team_betted_on_id uuid references public.xiapan_teams(id),
  stake_cents bigint not null,                -- 美分入账, 避免浮点
  entry_price int not null,                   -- cents (0-100)
  signal_level xiapan_signal_level not null default 'strong',
  edge_at_entry_pp numeric(6,2),              -- percentage points, 可能为负 (反向单)
  kelly_frac numeric(5,4),
  predicted_p1_win numeric(5,4),
  respected_model boolean not null default true,
  status xiapan_bet_status not null default 'open',
  settled_at timestamptz,
  pnl_cents bigint,                           -- + 赢 / - 输, 不含本金
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index xiapan_bets_user_idx on public.xiapan_bets(user_id);
create index xiapan_bets_match_idx on public.xiapan_bets(match_id);
create index xiapan_bets_status_idx on public.xiapan_bets(status);
create index xiapan_bets_created_idx on public.xiapan_bets(created_at desc);

comment on table public.xiapan_bets is '虾盘 · 投注账本 · 一切真实/纸面下注都进这里';

-- ========== 8. Risk Flags · 风险标签 ==========
create table public.xiapan_risk_flags (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.xiapan_matches(id) on delete cascade,
  type text not null,                         -- 'patch_new', 'roster_change', 'star_player_out', 'low_liquidity'
  severity xiapan_risk_severity not null default 'info',
  note text,
  source text,                                -- 'leaguepedia', 'reddit', 'twitter', 'manual'
  created_at timestamptz not null default now()
);

create index xiapan_risk_flags_match_idx on public.xiapan_risk_flags(match_id);

comment on table public.xiapan_risk_flags is '虾盘 · 风险标签 · 投注前需要看到的提示';

-- ========== Updated_at 触发器 (复用现有 fn 如果存在, 否则创建) ==========
create or replace function public.xiapan_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger xiapan_teams_updated_at
  before update on public.xiapan_teams
  for each row execute function public.xiapan_set_updated_at();

create trigger xiapan_players_updated_at
  before update on public.xiapan_players
  for each row execute function public.xiapan_set_updated_at();

create trigger xiapan_matches_updated_at
  before update on public.xiapan_matches
  for each row execute function public.xiapan_set_updated_at();

create trigger xiapan_bets_updated_at
  before update on public.xiapan_bets
  for each row execute function public.xiapan_set_updated_at();

-- ========== RLS · 仅 admin 可读写 ==========
alter table public.xiapan_leagues enable row level security;
alter table public.xiapan_teams enable row level security;
alter table public.xiapan_players enable row level security;
alter table public.xiapan_matches enable row level security;
alter table public.xiapan_markets enable row level security;
alter table public.xiapan_predictions enable row level security;
alter table public.xiapan_bets enable row level security;
alter table public.xiapan_risk_flags enable row level security;

-- 复用 helper · 检查当前用户是否 admin
-- (catchzvibe 现有 profiles.role 字段, 'admin' 是最高权限)
create or replace function public.xiapan_is_admin()
returns boolean language sql security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 给所有 xiapan_* 表统一 admin-only 策略
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'xiapan_leagues','xiapan_teams','xiapan_players','xiapan_matches',
      'xiapan_markets','xiapan_predictions','xiapan_bets','xiapan_risk_flags'
    ])
  loop
    execute format(
      'create policy %I_admin_all on public.%I for all to authenticated using (public.xiapan_is_admin()) with check (public.xiapan_is_admin())',
      t, t
    );
  end loop;
end $$;

-- ========== Seed · 6 个核心 LOL 联赛 ==========
insert into public.xiapan_leagues (slug, name, region, tier) values
  ('lck',    'LCK',                              'kr',   1),
  ('lpl',    'LPL',                              'cn',   1),
  ('lec',    'LEC',                              'eu',   1),
  ('lcs',    'LCS',                              'na',   1),
  ('msi',    'Mid-Season Invitational',          'intl', 1),
  ('worlds', 'World Championship',               'intl', 1)
on conflict (slug) do nothing;
