# Runbook: Sprint 1.1 应用 inquiries migration

> **Type**: How-to
> Owner: TZ (一次性手动 · 5 分钟)
> Date: 2026-04-30

## 何时跑

- Sprint 1.1 第一次 / 重置 remote DB 之后
- 文件变了重新 push: `supabase/migrations/00009_inquiries_table.sql`

## 为什么手动

- Supabase CLI 未 link (`supabase link --project-ref cguncazbdeiwdjhhtyud` 需要登录交互)
- agent 不直接 ssh 生产 DB （安全）
- 一次性 5 分钟成本 < 自动化建设成本

## 步骤

### 1. 打开 Supabase Dashboard

```
https://supabase.com/dashboard/project/cguncazbdeiwdjhhtyud/sql/new
```

### 2. 粘贴整段 SQL

打开本仓 `supabase/migrations/00009_inquiries_table.sql`，全文复制 → 粘贴到 SQL Editor → Run。

### 3. 验证

在同一 SQL Editor 跑：
```sql
select 
  tablename,
  rowsecurity 
from pg_tables 
where schemaname='public' and tablename='inquiries';
```
期望: `rowsecurity = true`

```sql
select policyname, cmd, roles
from pg_policies
where schemaname='public' and tablename='inquiries';
```
期望 4 行: `anyone_can_submit_inquiry` (insert) / `team_read_all_inquiries` (select) / `team_update_inquiries` (update) / `admin_delete_inquiries` (delete)

### 4. 跑 RLS 越权审计

```bash
node --env-file=.env.local scripts/security-rls-audit.mjs
```

期望输出:
```
✅ anon SELECT inquiries → 空数组
✅ anon INSERT inquiries → 成功
✅ anon UPDATE inquiries → 阻止
✅ service_role SELECT 验证 insert 落地
=== 结果 4/4 pass ===
```

### 5. 跑 e2e

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright test booking.spec.ts
```

## Rollback

```sql
drop table public.inquiries cascade;
```

## See also

- spec: `docs/specs/booking-quests.md`
- migration: `supabase/migrations/00009_inquiries_table.sql`
- RLS 审计: `scripts/security-rls-audit.mjs`
