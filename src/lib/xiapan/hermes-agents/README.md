# Hermes Agents · 三虾系统

> v0.55 起 · 真 agent 替 OpenClaw 模式 · 用户 directive

3 个本地 agent · 各有身份 · 各跑各的:

| | 名 | 角色 | 间隔 | 工具 |
|---|---|---|---|---|
| 🐅 | 老虎 | 市场分析师 | 5 min | get_picks · get_cross_arb · get_calibration |
| 🦆 | 鸭子 | 鲸鱼监听 | 1 min | get_whales |
| 🧮 | 算盘 | 沉淀分析 | nightly | get_calibration · get_recent_lessons |

## 工作目录

```
~/.du4leaving/agents/
├── laohu/
│   ├── IDENTITY.md       它是谁 (用户可编辑)
│   ├── SOUL.md           核心使命 (改这里 = 改行为)
│   ├── MEMORY.md         长期记忆 (你写)
│   ├── CRON.json         { interval_seconds, enabled, last_run }
│   └── daily/
│       └── 2026-05-01.md  每跑一次 append 一段
├── yazi/
└── suanpan/
```

## 怎么跑

### 选项 A · 本地长跑 (推荐)

```bash
cd ~/catchzvibe
node scripts/du4-agent-runner.mjs

# 后台跑:
nohup node scripts/du4-agent-runner.mjs > /tmp/du4-agents.log 2>&1 &

# 看日志:
tail -f /tmp/du4-agents.log
```

每 60 秒 tick 一次 · 读每个 agent 的 CRON.json · 到点就触发。

### 选项 B · Vercel Cron (生产)

`vercel.json` 已配置 · 部署时自动启:

```json
{
  "path": "/api/xiapan/agents/cron?slug=laohu",
  "schedule": "*/5 * * * *"
},
{
  "path": "/api/xiapan/agents/cron?slug=yazi",
  "schedule": "* * * * *"
},
{
  "path": "/api/xiapan/agents/cron?slug=suanpan",
  "schedule": "0 2 * * *"
}
```

设 `CRON_SECRET` env 防 abuse。

⚠ Vercel 文件系统 ephemeral · daily/ 跨 deploy 丢。生产用 Supabase 持久化 (路标)。

### 选项 C · 手动 (du4 native app)

`◇ Hermes 三虾` sidebar · 每个 agent 卡有"跑一次"按钮 · 立刻触发。

## 用户编辑 agent

直接 vim:

```bash
# 改老虎的灵魂
vim ~/.du4leaving/agents/laohu/SOUL.md

# 暂停某 agent
vim ~/.du4leaving/agents/yazi/CRON.json
# {"enabled": false, ...}

# 改间隔
# CRON.json 里改 "interval_seconds": 600
```

下次跑自动读新值 · 不用重启服务。

## 看 agent 写了啥

```bash
# 老虎今天的简报
cat ~/.du4leaving/agents/laohu/daily/2026-05-01.md

# 所有 agent 最近一天
for d in ~/.du4leaving/agents/*/; do
  echo "=== $(basename $d) ==="
  cat "$d/daily/$(date +%Y-%m-%d).md" 2>/dev/null
done
```

或在 du4 native app 的 `◇ Hermes 三虾` sidebar 里看 (最近 3 输出预览)。

## 路标

- v0.57 · 跨 agent 通信 (鸭子看到大单 → 喊老虎)
- v0.58 · push notification (大涨大跌弹手机)
- v0.59 · Supabase 持久化 (生产 cron 也能存)
