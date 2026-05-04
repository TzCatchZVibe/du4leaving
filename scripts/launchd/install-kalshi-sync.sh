#!/usr/bin/env bash
# install-kalshi-sync.sh · 装本地 launchd · 每 5min 同步 Kalshi fills 进 Supabase
# RSA pem 在本机 (Vercel 没法跑 · 因为 pem 不能上 git)

set -e

NODE_BIN=$(which node)
if [ -z "$NODE_BIN" ]; then
  echo "✗ node 没装 · brew install node"
  exit 1
fi

PLIST_SRC="/Users/happyglobal_tk_team/du4leaving/scripts/launchd/com.du4leaving.kalshi-sync.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.du4leaving.kalshi-sync.plist"

# 替换 node 路径
sed "s|/usr/local/bin/node|$NODE_BIN|" "$PLIST_SRC" > "$PLIST_DST"
echo "✓ plist 写到 $PLIST_DST · node=$NODE_BIN"

# unload 旧的 (如有)
launchctl unload "$PLIST_DST" 2>/dev/null || true

# load 新的
launchctl load "$PLIST_DST"
echo "✓ launchd 加载 · 每 5min 自动跑 pull-positions --sync"
echo ""
echo "查日志 · tail -f /tmp/du4-kalshi-sync.log"
echo "停 · launchctl unload $PLIST_DST"
echo ""
echo "立刻跑 1 次测试 ·"
launchctl start com.du4leaving.kalshi-sync
sleep 5
echo "=== 5s 后日志 ==="
tail -10 /tmp/du4-kalshi-sync.log 2>/dev/null
