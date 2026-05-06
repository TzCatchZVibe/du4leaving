-- W4 终极 · 老虾 agent 记忆层
-- Cleo + Letta 3 层架构 · 工作窗 (DB) + 卷动摘要 (column) + 固定档 (静态 in code)

create table public.tg_conversations (
  id bigserial primary key,
  chat_id text not null,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text,                      -- user/assistant 文字 · tool 是 JSON
  tool_name text,                    -- assistant tool_use 调啥 · 或 tool 返回是哪个
  tool_args jsonb,                   -- function args
  tool_result jsonb,                 -- function 返回
  created_at timestamptz not null default now()
);

create index idx_tg_conv_chat_time on public.tg_conversations (chat_id, created_at desc);

-- 卷动摘要 · 每 chat 1 条 · 超过 N 轮就 summarize 老的塞进来
create table public.tg_summary (
  chat_id text primary key,
  summary text,
  last_summarized_at timestamptz,
  user_mood text,                     -- 老虾观察 · "tired" / "energized" / "stressed"
  voice_mode text default 'warm' check (voice_mode in ('warm', 'savage')),
  updated_at timestamptz not null default now()
);

alter table public.tg_conversations enable row level security;
alter table public.tg_summary enable row level security;
create policy "service role tg_conversations" on public.tg_conversations for all using (true) with check (true);
create policy "service role tg_summary" on public.tg_summary for all using (true) with check (true);
