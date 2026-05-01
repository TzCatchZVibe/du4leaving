# Resend 自定义域名验证 · catchzvibe.studio

> v0.64 · 让早间简报从 `noreply@catchzvibe.studio` 发 · 不是默认 onboarding@resend.dev
> 默认那个会进 Gmail 垃圾箱 · 验完域名才进收件箱

## 1 在 Resend 加 domain

1. resend.com → Domains → **Add Domain**
2. 填 · `catchzvibe.studio`
3. Resend 给你 4-6 条 DNS 记录 · 都是 ·
   - 1 个 `MX` (退信回 Resend)
   - 1 个 `TXT` (SPF)
   - 1 个 `TXT` (DMARC)
   - 1-3 个 `CNAME` (DKIM)

## 2 在域名 DNS 加这些记录

如果 catchzvibe.studio 在 Vercel ·
1. vercel.com → Project · Settings → Domains
2. 看 DNS records 里加 Resend 给的那些
3. 等 5-30 min DNS 生效

如果在 Cloudflare ·
1. cloudflare.com → 域名 → DNS
2. 加记录 · **Proxy 关 (灰云)** · 不然 SPF 失效
3. 5 min 内生效

## 3 在 Resend 验证

1. 回 Resend Domains 页
2. 点 **Verify**
3. ✓ 出现 = 通过

## 4 改 .env.local

```bash
# 之前
RESEND_FROM=DU4LEAVING <onboarding@resend.dev>

# 改成
RESEND_FROM=DU4LEAVING <noreply@catchzvibe.studio>
```

重启 catchzvibe pnpm dev · 下次发简报用新发件人。

## 5 推荐 Reply-To

让用户能回 · 加 reply-to ·

```ts
// src/app/api/xiapan/intel/digest/email/route.ts
body: JSON.stringify({
  from: process.env.RESEND_FROM,
  reply_to: "tomouzheng@gmail.com",     // ← 加这行
  to: [opts.to],
  ...
})
```

## 6 多人订阅 (路标 v0.65)

未来要做 newsletter ·
- Supabase 加 `intel_subscribers` 表 · email + status + lang
- 公开页加 "订阅早间简报" 表单
- email 路由改成遍历订阅 list 发 · Resend 一次 100 封内
- 退订链接 · `/unsubscribe?token=...`

## 7 测试

```bash
# 先建一封测试 (Resend allow 同源测试)
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "noreply@catchzvibe.studio",
    "to": ["tomouzheng@gmail.com"],
    "subject": "test",
    "text": "DKIM ok"
  }'
```

查邮件头 · 应有 ·
```
Authentication-Results: ...
  spf=pass (catchzvibe.studio)
  dkim=pass header.d=catchzvibe.studio
  dmarc=pass
```

3 个 pass 都齐 = 100% inbox · 不进垃圾。

## 8 free tier 限制

- 100 封/天 (24h 滚动窗 · 不是日历)
- 一个验证域名
- 无附件大文件
- 升级 $20/mo · 50K 封/月

du4 一天就发 1 封简报 · 远低于配额。
未来订阅 100 人 · 还是 1 封 broadcast (Resend Audiences) → 仍在 free。
