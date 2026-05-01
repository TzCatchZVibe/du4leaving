#!/usr/bin/env bash
# V0.68 · Mac mini 本地 cron runner
#
# Vercel cron 配置在云端 · 但后端跑在 Mac mini · Vercel 永远 ping 不到 localhost
# 所以装这个 launchd job 在 Mac mini 本地按相同节奏 ping localhost:3001
#
# 安装 ·
#   chmod +x scripts/local-cron-runner.sh
#   bash scripts/launchd/install-cron.sh
#
# 看日志 · tail -f /tmp/du4-cron.log

set -e

BASE="http://localhost:3001"
SECRET="${CRON_SECRET:-}"           # 从 .env.local 读 · 没就空 (本地 OK)
LOG_PREFIX="[$(date '+%H:%M:%S')]"

# 拿 cron secret · 优先 env · 没就读 .env.local
if [ -z "$SECRET" ] && [ -f "$HOME/du4leaving/.env.local" ]; then
  SECRET=$(grep "^CRON_SECRET=" "$HOME/du4leaving/.env.local" | cut -d= -f2 | tr -d '"' | tr -d "'")
fi

ping_one() {
  local path="$1"
  local label="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 \
    -H "Authorization: Bearer ${SECRET}" \
    "${BASE}${path}")
  echo "$LOG_PREFIX ${label} · ${path} · HTTP ${code}"
}

minute=$(date +%M)

# 每 5 分钟 · 老虎 + Kalshi pull
if (( minute % 5 == 0 )); then
  ping_one "/api/xiapan/agents/cron?slug=laohu" "[5min] laohu"
  ping_one "/api/xiapan/cron/pull-kalshi"       "[5min] pull-kalshi"
fi

# 每 2 分钟 · 鸭子
if (( minute % 2 == 0 )); then
  ping_one "/api/xiapan/agents/cron?slug=yazi"  "[2min] yazi"
fi

# 每 10 分钟 · scan-edges + paper-trade tick
if (( minute % 10 == 0 )); then
  ping_one "/api/xiapan/cron/scan-edges"                   "[10min] scan-edges"
  ping_one "/api/xiapan/paper-trade?action=tick&cron=1"    "[10min] paper-tick"
fi

# 每 15 分钟 · whale-diff
if (( minute % 15 == 0 )); then
  ping_one "/api/xiapan/intel/whale-diff?cron=1" "[15min] whale-diff"
fi

# 整点 · 算盘 (02:00) · digest (13:00) · digest email (13:05)
hour=$(date +%H)
if (( minute == 0 )); then
  if [ "$hour" = "02" ]; then
    ping_one "/api/xiapan/agents/cron?slug=suanpan" "[02:00] suanpan"
  fi
  if [ "$hour" = "13" ]; then
    ping_one "/api/xiapan/intel/digest?cron=1" "[13:00] digest"
  fi
  # 每 6 小时 · pull-riot (00, 06, 12, 18)
  if (( hour % 6 == 0 )); then
    ping_one "/api/xiapan/cron/pull-riot" "[6h] pull-riot"
  fi
fi

if (( minute == 5 && hour == 13 )); then
  ping_one "/api/xiapan/intel/digest/email?cron=1" "[13:05] digest-email"
fi
