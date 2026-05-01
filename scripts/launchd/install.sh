#!/usr/bin/env bash
# V0.64 · 装 du4 agent-runner 到 launchd
# 用法 ·
#   bash scripts/launchd/install.sh         装 + 启
#   bash scripts/launchd/install.sh stop    停
#   bash scripts/launchd/install.sh restart 改 plist 后重启
#   bash scripts/launchd/install.sh status  看跑没跑
#   bash scripts/launchd/install.sh logs    跟日志

set -e

PLIST_NAME="com.tz.du4.agent-runner"
PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/${PLIST_NAME}.plist"
PLIST_DST="${HOME}/Library/LaunchAgents/${PLIST_NAME}.plist"
LOG="/tmp/du4-agent-runner.log"
ERR="/tmp/du4-agent-runner.err"

cmd="${1:-install}"

case "$cmd" in
  install)
    echo "═══ 装 ${PLIST_NAME} ═══"
    if [ ! -f "$PLIST_SRC" ]; then
      echo "✗ 找不到 $PLIST_SRC"; exit 1
    fi
    mkdir -p "${HOME}/Library/LaunchAgents"
    cp -f "$PLIST_SRC" "$PLIST_DST"
    echo "✓ 复制到 $PLIST_DST"
    if launchctl list | grep -q "$PLIST_NAME"; then
      launchctl unload "$PLIST_DST" 2>/dev/null || true
    fi
    launchctl load -w "$PLIST_DST"
    sleep 1
    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "✓ 已启动 · 看日志:"
      echo "    tail -f $LOG"
      echo "    tail -f $ERR"
    else
      echo "✗ 启动失败 · 看 $ERR"
    fi
    ;;
  stop)
    echo "═══ 停 ${PLIST_NAME} ═══"
    if [ -f "$PLIST_DST" ]; then
      launchctl unload "$PLIST_DST"
      echo "✓ 已停"
    else
      echo "未装"
    fi
    ;;
  restart)
    bash "$0" stop || true
    bash "$0" install
    ;;
  status)
    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "✓ 在跑"
      launchctl list | grep "$PLIST_NAME"
    else
      echo "✗ 没跑"
    fi
    ;;
  logs)
    echo "═══ stdout ═══"
    tail -50 "$LOG" 2>/dev/null || echo "(无日志)"
    echo ""
    echo "═══ stderr ═══"
    tail -20 "$ERR" 2>/dev/null || echo "(无错误)"
    ;;
  uninstall)
    bash "$0" stop || true
    rm -f "$PLIST_DST"
    echo "✓ 已卸"
    ;;
  *)
    echo "用法: $0 {install|stop|restart|status|logs|uninstall}"
    ;;
esac
