#!/usr/bin/env bash
# V0.68 · 装 du4 本地 cron 到 launchd
set -e
PLIST_NAME="com.tz.du4.cron"
PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/${PLIST_NAME}.plist"
PLIST_DST="${HOME}/Library/LaunchAgents/${PLIST_NAME}.plist"

cmd="${1:-install}"
case "$cmd" in
  install)
    chmod +x "$(dirname "$0")/../local-cron-runner.sh"
    mkdir -p "${HOME}/Library/LaunchAgents"
    cp -f "$PLIST_SRC" "$PLIST_DST"
    launchctl unload "$PLIST_DST" 2>/dev/null || true
    launchctl load -w "$PLIST_DST"
    sleep 2
    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "✓ cron 已装 + 启动"
      echo "  日志: tail -f /tmp/du4-cron.log"
    else
      echo "✗ 启动失败 · 看 /tmp/du4-cron.err"
    fi
    ;;
  stop)
    launchctl unload "$PLIST_DST" 2>/dev/null && echo "✓ 停"
    ;;
  status)
    launchctl list | grep "$PLIST_NAME" || echo "✗ 没跑"
    echo ""
    echo "═══ 最近 20 行日志 ═══"
    tail -20 /tmp/du4-cron.log 2>/dev/null
    ;;
  *)
    echo "用法: $0 {install|stop|status}"
    ;;
esac
