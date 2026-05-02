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

# 周日 22:00 · paper trade 周报
dow=$(date +%w)   # 0 = Sunday
if (( dow == 0 && hour == 22 && minute == 0 )); then
  ping_one "/api/xiapan/paper-trade/weekly?cron=1" "[Sun 22:00] paper-weekly"
fi

# V0.72 · 每月 1 号 02:00 · 百川两池月度结算
day=$(date +%d)
if [[ "$day" == "01" && "$hour" == "02" && "$minute" == "00" ]]; then
  ping_one "/api/xiapan/baichuan/allocate?cron=1" "[Month 1] 百川-allocate"
fi

# V0.72 · 每天 03:00 · 拉 Kalshi 已结算 · update lessons
if [[ "$hour" == "03" && "$minute" == "00" ]]; then
  ping_one "/api/xiapan/baichuan/settle?cron=1" "[03:00] 百川-settle"
fi

# V0.72 · 每周日 22:30 · Brier 校准 · 调权重
if (( dow == 0 && hour == 22 && minute == 30 )); then
  ping_one "/api/xiapan/baichuan/brier?cron=1" "[Sun 22:30] 百川-brier"
fi

# V0.72 · 每天 12:00 · 百川健康检查 · 异常 push Telegram
if [[ "$hour" == "12" && "$minute" == "00" ]]; then
  ping_one "/api/xiapan/baichuan/health?cron=1" "[12:00] 百川-health"
fi

# V0.72 · 每 5 分钟 · BTC + ETH + SOL BS 公允价扫 (W1/W2 信号源)
if (( minute % 5 == 0 )); then
  ping_one "/api/xiapan/btc-edges" "[5min] btc-edges"
  ping_one "/api/xiapan/eth-edges" "[5min] eth-edges"
  ping_one "/api/xiapan/sol-edges" "[5min] sol-edges"
fi

# V0.72 W2 · 每 30 分钟 · FDA AdCom 凸性信号 (C 池)
if (( minute % 30 == 0 )); then
  ping_one "/api/xiapan/fda-edges" "[30min] fda-edges"
fi

# V0.72 W2 Day 5 · 每 20 分钟 · Mention 错价 (Catboy/Trump · C 池)
# 频率高 · LLM 估错价 · 抢黄金 5-15min 窗
if (( minute % 20 == 0 )); then
  ping_one "/api/xiapan/mention-edges" "[20min] mention-edges"
fi

# V0.72 W2 Day 6 · 每 10 分钟 · 反公众 (vol skew · 全品类通用)
# 高频 · trades feed 实时 · 抓 mean reversion 窗
if (( minute % 10 == 5 )); then
  ping_one "/api/xiapan/contrarian-edges" "[10min] contrarian"
fi

# V0.72 · 每 15 分钟 · 天气 NWS+Meteo (W1 Day 5 信号源)
# 天气 forecast 更新慢 · 不需要 5min · 减 API 压力
if (( minute % 15 == 0 )); then
  ping_one "/api/xiapan/weather-edges" "[15min] weather-edges"
fi

# V0.72 W3 Day 3 · 每 30 分钟 · NBA Elo (S 桶)
# NBA 比赛 Elo 不变 · 仅价格变 · 不用 5min
if (( minute % 30 == 0 )); then
  ping_one "/api/xiapan/nba-edges" "[30min] nba-edges"
fi

# V0.72 W3 Day 4 · 每 30 分钟 · 经济跨平台 (FOMC/CPI/Jobs/GDP)
if (( minute % 30 == 15 )); then
  ping_one "/api/xiapan/fed-edges" "[30min] fed-edges"
fi

# V0.72 W3 · 每周一 04:00 · 538 Elo refresh
if [[ "$dow" == "1" && "$hour" == "04" && "$minute" == "00" ]]; then
  ping_one "/api/xiapan/nba-edges?refresh=1" "[Mon 04:00] nba-elo-refresh"
fi

# V0.72 · 每 5 分钟 · 百川主入口 (signals → fusion → paper)
# 注 · 必须在 btc-edges/weather-edges 之后跑 · 让信号源先就位 · 错开 1 min
if (( minute % 5 == 1 )); then
  ping_one "/api/xiapan/baichuan/run?cron=1" "[5min] 百川-run"
fi
