# Telegram Bot · 手机版 du4 替代方案

> v0.71 · TZ directive · "手机版用 Hermes agent 通过聊天软件交互"
> 不装 iOS app · 直接 TG 跟老虎说话

## 1 创建 bot (5 min · TG 内做)

1. TG 搜 **@BotFather** → /start
2. /newbot → 起名 "DU4 老虎" → username "tz_du4_laohu_bot" (后缀 _bot 必须)
3. 拿到 token · 形如 `1234:AAEhBP...`
4. 找 **@userinfobot** → /start → 抄你的 user ID (例 `7891234567`)

## 2 配 .env.local (Mac mini 上)

```bash
ssh mini
cd ~/du4leaving
cat >> .env.local << EOF

# V0.71 · Telegram bot
TELEGRAM_BOT_TOKEN=1234:AAEhBP...
TELEGRAM_CHAT_ID=7891234567
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 16)
EOF
launchctl unload ~/Library/LaunchAgents/com.tz.du4.next-dev.plist
launchctl load -w ~/Library/LaunchAgents/com.tz.du4.next-dev.plist
sleep 5
```

## 3 暴露 Mac mini 给 TG (TG 必须从公网 webhook · LAN/Tailscale 不通)

### 路 A · ngrok (最简单 · 免费 5min 一变 URL)

```bash
ssh mini
brew install ngrok
ngrok http 3001
# 看 Forwarding 那行 https://xxx.ngrok.io
```

### 路 B · Cloudflare Tunnel (免费 · URL 固定)

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create du4
cloudflared tunnel route dns du4 du4.your-domain.com
cloudflared tunnel run du4 --url http://localhost:3001
```

### 路 C · 部署 Vercel (生产 · webhook 走 vercel 域名)
不推荐 · 会脱离 Mac mini 本地 Hermes · 又要付云端推理

## 4 注册 webhook

```bash
TOKEN="$(grep TELEGRAM_BOT_TOKEN ~/du4leaving/.env.local | cut -d= -f2)"
SECRET="$(grep TELEGRAM_WEBHOOK_SECRET ~/du4leaving/.env.local | cut -d= -f2)"
PUBLIC_URL="https://xxx.ngrok.io"   # 抄上面那一行

curl "https://api.telegram.org/bot${TOKEN}/setWebhook?url=${PUBLIC_URL}/api/xiapan/telegram/webhook&secret_token=${SECRET}"
# {"ok":true,"result":true,"description":"Webhook was set"}
```

## 5 测

TG 找你的 bot · 发 `/start`
应自动回 ·
```
🐅 老虎 · 押注顾问

直接发问题给我 ·
  · 今天该下啥
  · KXNBAGAME-... 怎么看
  · ...

命令 ·
  /状态 · Mac mini + paper trade 状态
  /paper · 模拟单战况
  /digest · 今日早间简报
```

测试 · 发 "今天该下啥" · 老虎走 Hermes 多回合工具调 · 60s 内回简报。

## 6 现有自动 push

不用你做啥 · 装好 webhook 后 ·

| 触发 | 例子 |
|---|---|
| 老虎找到 ≥85 强信号 | 🐅 老虎 · 强信号 87 分 / KXNBA-... / 押「会」 65¢ |
| paper trade 平仓 | ✓ 模拟单 止盈 · +$1.20 / KXLOL... |
| YN high signal (近 30min) | ⚠ YN POLY · 5min / 文本 + 标的 |
| whale 大动 (≥$2k) | 🆕 新仓 · CoinHarry / market / 张 + 当前值 |

每条 5min 内同 key 不重发。

## 7 关 push · 不开 dedupe · 测试

```bash
# 想看实际推啥
ssh mini
tail -f /tmp/du4-next.log | grep -i telegram
```

## 8 维护

webhook 失效查 ·
```bash
curl "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | jq
```

ngrok URL 变了重新 setWebhook 即可。
