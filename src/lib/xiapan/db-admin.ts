// 虾盘 · service role admin client
// 仅 server 用 · cron / API route / 后台任务
//
// 用 service_role key 绕过 RLS, 因为 cron 没有用户 session
//
// 注 (Sprint 4): xiapan_* 表未在 generated Database types 里 ·
// 显式 return SupabaseClient (无 generic) 让 from(...) 不落 never ·
// query 用 .returns<RowType[]>() / write payload cast as never 显式标注

import {
  createClient as createAdmin,
  type SupabaseClient,
} from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function xiapanAdminDb(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "xiapan: 缺 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  _client = createAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as SupabaseClient;
  return _client;
}

export function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 没配 secret 就不允许任何 cron · 强制 fail-closed
    return false;
  }
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}
