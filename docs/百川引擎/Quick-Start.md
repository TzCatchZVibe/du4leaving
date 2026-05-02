# 百川 Quick Start · TZ 操作手册

> 给你看的 · 不给我 · 部署后日常运营操作
> 全部用 Telegram bot 跑 · 不用 ssh

---

## §1 初次部署 (一次性 · 5 步)

```
Step 1 · 推代码 + 重启 next-dev (mini)
─────────────────────────────────────
cd ~/du4leaving && git push origin main && \
  ssh mini 'cd ~/du4leaving && git pull && \
            launchctl unload ~/Library/LaunchAgents/com.tz.du4.next-dev.plist; \
            sleep 2; \
            launchctl load -w ~/Library/LaunchAgents/com.tz.du4.next-dev.plist'

Step 2 · 验证健康 (Telegram)
─────────────────────────────────────
/health
应看到 · 4-7 项 ✓ · 0 项 ✗
若有 ✗ · 跑 step 1 再试 (next-dev 还在编)

Step 3 · 初始化两池 (Telegram · 仅首次)
─────────────────────────────────────
/pools_init 400
应看到 ·
  P0  · $400.00
  S 池 · $360 (90%)
  C 池 · $40 (10%)

Step 4 · 看信号源是不是有反应
─────────────────────────────────────
/btc          BTC 公允价 (3 路 BS+CrossT+CrossP)
/eth /sol     ETH/SOL 同上
/weather      天气双源 (NWS + Open-Meteo)
/contrarian   反公众
/fda /mention C 桶 (凸性)
任何一个有信号 · 系统就活了

Step 5 · 等 cron 跑一轮 (5min)
─────────────────────────────────────
/pools 再看一眼
若 S/C 余额变了 · 说明 fusion 触发 · paper 已下
```

---

## §2 日常 (你每天看 1-2 次)

```
早上 (5min)
─────────────────────────
/pools     看两池余额
/health    看系统是否健康

中午 (5min · 可选)
─────────────────────────
/btc /eth /sol  看加密信号
/contrarian     看反公众有啥

晚上 (10min)
─────────────────────────
/clv       看 CLV (>0 是真 alpha)
/brier     看权重 (≥ 5 单平仓后才有数)
/settle    手动跑一次结算 (cron 03:00 自动 · 但你可以提前跑)
```

---

## §3 每周日 (每周 1 次)

```
22:00  · paper trade 周报 自动 push
22:30  · Brier 校准 自动跑 (调权重)

你做的 ·
─────────────────────────
1. 看周报 push · S 池涨了多少
2. /brier 看权重变化 · 哪信号涨了 / 退役了
3. /clv  看 30 单 CLV 趋势
4. /health 全周是否绿
```

---

## §4 每月 1 号 (每月 1 次)

```
02:00 · 月底自动结算 (allocator)
       · S 月化超 hurdle 8% → 转 C
       · C 净赚 ≥ $50 → 阶梯 cashout (30/50/70%)
       · push Telegram 月度报表

你做的 ·
─────────────────────────
1. 看 push 报表
2. cashout 部分 · 提到银行账户 (人工 · Kalshi 网站)
3. 反思 · 月化是否符合预期
```

---

## §5 真钱启用流程 (只做一次 · 严格)

```
前提 · 7 项全过 (W2 总结 §7)
─────────────────────────
☐ paper 已平仓 ≥ 30 单 (/paper · /clv 数字看)
☐ wr ≥ 53%   (paper 报表)
☐ avg CLV > 0 (/clv)
☐ Brier 校准跑过 ≥ 1 周 (/brier)
☐ /health 全绿 ≥ 7 天 连续
☐ 没出现 -8% 单日 drawdown
☐ S 池实际 vs P0 偏离 < 5%

任一 fail → paper 继续打磨 · 不接真钱

启用步骤 (paper 全过后) ·
─────────────────────────
1. Kalshi 网站 → Settings → API
   创 RSA key pair · 下载私钥 .pem

2. 上传到 mini ·
   scp private.pem mini:~/.kalshi/private.pem

3. 编辑 mini 上 .env.local ·
   ssh mini 'cat >> ~/du4leaving/.env.local << EOF
   LIVE_TRADING=true
   KALSHI_API_KEY_ID=<UUID>
   KALSHI_PRIVATE_KEY_PATH=/Users/laoxia/.kalshi/private.pem
   EOF'

4. 重启 next-dev

5. Telegram /live · 应看到 ·
   ✓ Kalshi 真钱 · 已启用
   余额 · $X.XX

6. 头 7 天 · 单笔上限 $5 · 日上限 $50 (硬写死)
   月底看月化 ROI · 不亏 + Sharpe ≥ 1 · 才上调
```

---

## §6 命令速查 (按用途分组)

```
状态查看 ·
  /状态     Mac mini + paper + cron 运行状态
  /pools    百川两池余额 P0/S/C
  /health   全链路 7 项自检
  /live     Kalshi 真钱 client gate (默认 OFF)

信号源 ·
  /btc      BTC BS+跨期限+跨平台 (3 路)
  /eth      ETH 同上 (3 路)
  /sol      SOL 同上 (3 路)
  /weather  天气 NWS+Meteo 双源
  /fda      FDA AdCom 凸性
  /mention  名人发言错价 (Catboy/Trump)
  /contrarian (or /反向) · 反公众

监控 ·
  /clv      CLV 跟踪 (verdict alpha+/neutral/alpha-)
  /brier    信号权重 + Brier 校准
  /settle   拉 Kalshi 已结算 + update PnL
  /paper    模拟单战况 (legacy · v0.67 时代)

操作 ·
  /pools_init <$>  · 注入本金 (一次性)
  /digest         · 今日早间简报

老虎团队 (legacy · 仍跑) ·
  /max  /rio  /iris  /team  /tickers
```

---

## §7 故障排查

```
问题 · /health 红 (任何 ✗)
─────────────────────────
1. 看是哪一项 ✗
2. 若是 btc-edges/weather-edges 慢 · 多半 Coinbase API 抖
   等 5-10min 自愈
3. 若是 pools 红 · 可能 ~/.du4leaving/百川/pools.json 损
   ssh mini 'cat ~/.du4leaving/百川/pools.json'  看是否完整
4. 若是 fusion 红 · 代码 bug · 联系我

问题 · /pools 显示 S 跌得快
─────────────────────────
1. 查 /clv · 是不是 alpha-
2. 查 /brier · 是不是某 signal 退役没 (权重 0)
3. drawdown 自适应应自动缩仓 · 看 /pools circuit_state
   "paused_C" 正常 (S -5% 月触发)
   "paused_all" 严重 (-15% · 等 7 天解 / 联系我)
   "red_line" 紧急 (P0 × 0.85 触发 · 总停)

问题 · paper 单一直不平仓
─────────────────────────
1. 看 ticker 是不是过期了 (Kalshi 已结算但 settle 没追上)
2. /settle 手动跑
3. 看 lessons.jsonl · 是不是 actual 还是 null

问题 · Telegram 不回我
─────────────────────────
1. 看 cloudflared tunnel 还在不在 ·
   ssh mini 'pgrep -lf cloudflared'
2. 看 Kalshi webhook 还在不在 ·
   curl "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
3. cloudflared URL 变了 · setWebhook 重注册
```

---

## §8 数据存哪 (mini 上)

```
~/.du4leaving/百川/
  pools.json          两池状态 (P0/S/C/历史)
  lessons.jsonl       每笔下单 + 平仓
  weights.json        Brier 自适应权重
  fda/
    adcom-calendar.json  FDA AdCom 人工 seed

~/du4leaving/.env.local
  TELEGRAM_BOT_TOKEN
  TELEGRAM_CHAT_ID
  TELEGRAM_WEBHOOK_SECRET
  API_TOKEN
  CRON_SECRET
  (启用真钱后) LIVE_TRADING=true 等

/tmp/du4-next.log     Next.js dev 日志
/tmp/du4-cron.log     cron-runner 日志
/tmp/cloudflared.log  tunnel 日志
```

---

## §9 紧急停 (任何时候按 1 个)

```
人工急停 · 不下任何新单
─────────────────────────
ssh mini 'echo "SAFE_MODE=true" >> ~/du4leaving/.env.local && \
          launchctl unload ~/Library/LaunchAgents/com.tz.du4.next-dev.plist && \
          launchctl load -w ~/Library/LaunchAgents/com.tz.du4.next-dev.plist'

(暂未实现 SAFE_MODE 但可以设 LIVE_TRADING=false 关真钱
 paper 不会破坏本金 · 无急停需要)

物理急停 · 关 mini
─────────────────────────
ssh mini 'sudo shutdown -h now'
(极端情况 · paper 自动停 · 真钱即时停)
```

---

## §10 月度 KPI (每月看)

```
S 池目标 · 月化 ≥ 5% · 年化 ≈ 80%
C 池目标 · 季度击中 ≥ 1 大胜 · 触发 cashout
总组合 ·
  · Sharpe ≥ 1.0
  · max drawdown ≤ 15%
  · CLV > 0 (累计)
  · 12 月后 bankroll ≥ 200% on P0

不达标 · 不上 bankroll · 不开真钱
达标 · 月底 P0 翻倍 / cashout 部分锁利
```
