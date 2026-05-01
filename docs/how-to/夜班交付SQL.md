# 夜班交付 · 待跑 SQL

> TZ 明早打开 Supabase SQL Editor · 粘贴执行 · 顺序往下跑。
> 每段跑一次就好 · 不会重复建表(用了 `create table if not exists` + `drop policy if exists`)。

---

## T4 · 00007_chat_messages.sql · Realtime 团队聊天

文件路径 · `supabase/migrations/00007_chat_messages.sql`

```sql
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  channel text not null default 'general',
  content text not null,
  created_at timestamptz default now()
);

create index if not exists chat_channel_created_idx
  on public.chat_messages(channel, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_silver_read" on public.chat_messages;
create policy "chat_silver_read" on public.chat_messages
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('silver','gold','admin','hg_employee')
    )
  );

drop policy if exists "chat_silver_write" on public.chat_messages;
create policy "chat_silver_write" on public.chat_messages
  for insert with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('silver','gold','admin')
    )
  );

alter publication supabase_realtime add table public.chat_messages;
```

**验证**: 打开 `/internal/chat` · 左侧应显示 4 channel (general/choice/snacks/pr) · 发一条消息 · 另一个浏览器看到消息实时推过去。

**如果 Realtime 没推送**:
- Supabase Dashboard → Database → Replication → 确认 `chat_messages` 在 `supabase_realtime` publication。
- Settings → API → 确认项目启用了 Realtime。
