# Supabase 接入指南

## 1 · 创建 Supabase 项目

1. 打开 https://supabase.com · 用 GitHub 登录
2. New project · 起名 `catchzvibe-studio`
3. Region 选 **US East (Virginia)** 或 **US West (Oregon)**
4. 数据库密码 · 记住或存 1Password
5. 等 project 起好（2-3 分钟）

## 2 · 拿 Keys

Project Settings → API →

- `Project URL` → 贴到 `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → 贴到 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` → 贴到 `SUPABASE_SERVICE_ROLE_KEY`

## 3 · 执行 schema

1. Supabase Dashboard → SQL Editor → New query
2. 复制 [00001_initial_schema.sql](migrations/00001_initial_schema.sql) 全部内容
3. Run · 应该没报错

## 4 · 创建黄金会员（TZ / Fri / Hank）

Dashboard → Authentication → Users → Add user：

| Email | Password |
|---|---|
| tz@catchzvibe.studio | 自定义 |
| fri@catchzvibe.studio | 自定义 |
| hank@catchzvibe.studio | 自定义 |

建完后去 SQL Editor 运行：

```sql
update public.profiles set role = 'gold', handle = '@tz_CatchZVibe.Studio', display_name = 'TZ' where email = 'tz@catchzvibe.studio';
update public.profiles set role = 'gold', handle = '@fri_CatchZVibe.Studio', display_name = 'Fri' where email = 'fri@catchzvibe.studio';
update public.profiles set role = 'gold', handle = '@hank_CatchZVibe.Studio', display_name = 'Hank' where email = 'hank@catchzvibe.studio';
```

## 5 · 前端配置 keys

```bash
cp .env.local.example .env.local
# 编辑 .env.local · 填 3 个 Supabase key
```

## 6 · 重启 dev server

```bash
# preview tool 自动 reload · 或手动:
npm run dev
```

现在 `/login` 就能真的登录了 · `/internal/*` 会鉴权。

---

## Schema 概览

| 表 | 作用 |
|---|---|
| `profiles` | 用户 · role = bronze/silver/gold/hg_employee/admin |
| `clips` | 素材库 · 6 字段标签 + 代理 URL |
| `wiki_pages` | 后 AI 图书馆的笔记 |
| `recipe_runs` | 菜谱执行记录 · 哪些 clip 填进哪个 slot |
| `wholesale_orders` | HG 员工的批发订单 |
| `publish_queue` | 7 账号发布排期 |

## RLS 规则

| 表 | 读 | 写 |
|---|---|---|
| profiles | 自己 · admin | 自己 · admin |
| clips | silver+ | gold+ |
| wiki_pages | silver+ | gold+ |
| recipe_runs | gold+ | gold+ |
| wholesale_orders | 自己订单 + gold+ | 同左 |
