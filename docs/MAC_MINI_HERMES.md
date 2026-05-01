# Mac mini · Hermes 本地服务器 · 完整指南

> v0.65 · 把闲置 Mac mini M4 16GB 变 du4leaving 24/7 服务器
> 跑 Ollama hermes3:8b · 0 钱 · 隐私 · 替云端

## 1 硬件确认

| 你的机器 | 跑啥 | 为啥 |
|---|---|---|
| Mac mini M4 · 16GB · 256GB | **服务器** ⭐ | always-on · 不动 · M4 unified memory 跑 8B 顺 |
| MacBook Pro M4 Pro · 24GB · 512GB | 工作机 | 你带着走 · 跑 LLM 烧电池 · 不适合 24/7 |

## 2 装 Ollama (5 min)

```bash
# Mac mini SSH 进 (或者直接物理操作)
ssh laoxia@mac-mini.local

# 装 Ollama
brew install ollama

# 启服务 (默认 :11434)
brew services start ollama

# 拉 Hermes-3 8B Q5 (4.7GB · 留 11GB 给系统 + catchzvibe)
ollama pull hermes3:8b

# 测一句
ollama run hermes3:8b "你是 prediction market 顾问 · 一句话告诉我 Polymarket 跟 Kalshi 区别"
# 应 14-17 tok/s 出答案
```

## 3 让 catchzvibe (Vercel 生产) + du4leaving (本地 dev) 都能用

### 选项 A · 仅本地 dev (最简单)

du4leaving Next.js 在 Mac mini 跑 ·

```bash
# Mac mini 上
cd ~/du4leaving
pnpm install
pnpm dev    # 默认 :3001

# .env.local
OLLAMA_URL=http://localhost:11434
HERMES_MODEL=hermes3:8b
LLM_PROVIDER=auto    # 自动 hermes → openrouter → ...
```

du4 macOS app 连这个 Mac mini · `EnvConfig.baseURL = http://mac-mini.local:3001`

### 选项 B · LAN 暴露 (推荐 · iPhone 也能用)

```bash
# Mac mini 拿 IP
ipconfig getifaddr en0
# e.g. 192.168.1.184

# 启 du4leaving
HOSTNAME=0.0.0.0 pnpm dev
# 默认 Next.js dev 已 bind 0.0.0.0 · 不用改

# du4 macOS app · EnvConfig 改
# UserDefaults · xiapan.baseURL = http://192.168.1.184:3001
```

iPhone 在同 LAN 也能访问。

### 选项 C · Tailscale (出门也能用)

```bash
# Mac mini + iPhone + MacBook 都装 Tailscale
brew install tailscale  # Mac
# iPhone App Store · Tailscale

# Mac mini 拿 Tailscale IP
tailscale ip -4
# e.g. 100.99.88.77

# du4 配置 · http://100.99.88.77:3001
# 任何网络都能连 (走 Tailscale 私有 mesh)
```

## 4 launchd 自启 (覆盖 v0.64 + 加 catchzvibe dev)

`~/Library/LaunchAgents/com.tz.du4.next-dev.plist` ·

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>com.tz.du4.next-dev</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>bash</string>
    <string>-c</string>
    <string>cd /Users/laoxia/du4leaving && /opt/homebrew/bin/pnpm dev</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/du4-next.log</string>
  <key>StandardErrorPath</key><string>/tmp/du4-next.err</string>
</dict></plist>
```

```bash
launchctl load -w ~/Library/LaunchAgents/com.tz.du4.next-dev.plist
```

之后 Mac mini 一开机 · Ollama + du4leaving Next.js + agent-runner 全自启。

## 5 验证 Hermes 真在跑

```bash
# 在 Mac mini 上测
curl http://localhost:3001/api/xiapan/agent/sage \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"question":"我应该怎么看 NBA Q4 押注","context":{}}'

# 看返回的 provider 字段
# 应该是 "hermes" (本地)
# 不是 "openrouter-hermes" (云端)
# 不是 "static" (没 LLM)
```

## 6 监控成本

```bash
# 每天看一眼 OpenRouter 账单
# (Hermes 本地用了 = 0 调用云端 · 这是目标)
open https://openrouter.ai/activity
```

期待 ·
- 90% 调用走 hermes 本地 · $0
- 10% 重活落 OpenRouter Hermes 405B · ~$3-5/月
- 总成本 < $10/月 · 远低于 $150-200 月预算

## 7 性能数据 (M4 16GB · 实测)

| 任务 | 模型 | 输入 | 输出 | 耗时 |
|---|---|---|---|---|
| 老虎简报 (5min cron) | hermes3:8b Q5 | 2000 tok | 500 tok | ~50s |
| 鸭子鲸鱼报 (1min cron) | hermes3:8b Q5 | 1500 tok | 300 tok | ~30s |
| 算盘沉淀 (nightly) | hermes3:8b Q5 | 3000 tok | 800 tok | ~70s |
| Sage 用户问答 | hermes3:8b Q5 | 1500 tok | 600 tok | ~45s |

1min cron 跑 30s 推理 · 容量够 · 不堆队。

## 8 升级路径 (未来)

如果 16GB 不够 ·
- 跳 hermes3:13b Q4 (~7GB) · 更准 · 慢 30%
- 或 Mac mini 加内存 (M4 不支持内存升级 · 卖换 32GB 版)

如果你拿到 OpenRouter Hermes-3 405B 体验 (云端 · 一次 ~$0.05) ·
- 设 LLM_PROVIDER=openrouter 强用云端
- 测对比本地 8B 输出质量
- 关键场景用 405B (sage 重要决断) · 日常用本地 8B

## 9 数据安全

Mac mini 在你家 LAN ·
- ~/.du4leaving/ 全部数据本地
- agents/<slug>/MEMORY.md 不联网
- LessonStore 不联网
- Hermes 推理本地

只联网的 ·
- Polymarket/Kalshi public API (非个人数据)
- CryptoPanic (非个人数据)
- OpenRouter (仅当本地 Hermes 不够 · 重活)
- Resend (邮件简报 · 你 inbox 单收)

VC due diligence / Sarah 审 czv 时 · 看不到这台 Mac mini · 干净。
