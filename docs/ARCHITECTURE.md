# DU4LEAVING · 整体架构与全部细节

> 给策略人看的 · 一份文档讲清楚 · 2026-05-01 · v0.67 (建设中)
> 作者 · TZ 个人项目 · 已从 CatchZ Studio (LLC) 物理拆出来 · 法律隔离

---

## 0 一句话定位

**做给中国人看得懂的 Polymarket / Kalshi 押注助手 · iOS + Mac native + 网页 · 本地 AI 顾问 + 自动交易 · 0 钱跑得动 · VC DD 看不到。**

---

## 1 用户故事

```
TZ (创始人) ·
  35 岁 · 中国人 · 美国德州达拉斯
  押注预算 月度 $20-100 · 不是大户 · 但想 sharp
  痛点 · 美国市面所有 prediction-market dashboard 都英文 + 术语堆
        中国玩家看不懂 · 错过 8 成 alpha
  目标 · 1) 月度从亏 → 持平 → 微盈
        2) 把"每输赢都成数据"沉淀成习惯 · 越用越准
        3) 闲着的时候 AI 替我自动下小单 · 我睡觉它赚钱

  哲学 · "你帮我随时筛选出适合赌的"
        "我要的不是盲目下注 · 每次输赢都是有沉淀的 · 要有迭代"
        "不能有任何专业术语 · 高中生来都能赚钱"
```

---

## 2 宏观架构 · 3 层 + 1 神经

```
┌────────────────────────────────────────────────────────┐
│  L1 · 客户端 · 用户实际看的                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ iOS app    │ │ macOS app  │ │ 网页公开    │         │
│  │ SwiftUI    │ │ SwiftUI    │ │ /heatmap    │         │
│  │            │ │            │ │ /research   │         │
│  └────┬───────┘ └────┬───────┘ └──────┬─────┘         │
│       └─────────────┴────────────────┘                 │
│                     │                                   │
└─────────────────────┼───────────────────────────────────┘
                      │  HTTPS / LAN
                      │
┌─────────────────────┼───────────────────────────────────┐
│  L2 · 后端 Brain · 你 Mac mini 跑 (24/7)                │
│  Next.js 16.2.4 + React 19 + Tailwind 4                │
│                                                         │
│  ┌──────────── 5 路 LLM Fallback ────────────┐         │
│  │ 1. Hermes 本地 (Ollama hermes3:8b · 90%)  │         │
│  │ 2. OpenRouter Hermes 405B (10% 重活)      │         │
│  │ 3. Ollama 通用 (备)                       │         │
│  │ 4. OpenAI mini (付费 fallback)            │         │
│  │ 5. Static template (兜底)                 │         │
│  └────────────────────────────────────────────┘         │
│                                                         │
│  ┌── 28 API endpoints ──┐                              │
│  │ /api/xiapan/...       │  全部数据 / 决策 / 写仓     │
│  │   account, bet, history                             │
│  │   picks, cross-arb, mention, combos, exit-advisor   │
│  │   intel/markets, news, yn-signals, whales           │
│  │   intel/digest, digest/email, whale-diff            │
│  │   agent/sage (人问)                                 │
│  │   agents (3 虾自跑 + cron)                          │
│  └───────────────────────┘                              │
│                                                         │
│  ┌── Vercel Cron (10 个) ──┐                           │
│  │ */5  老虎扫 picks 写简报                            │
│  │ */1  鸭子监听鲸鱼                                   │
│  │ 0 2  算盘算 calibration                             │
│  │ 0 13 digest 写每日早间简报                          │
│  │ 5 13 digest email 发到你邮箱                        │
│  │ */15 whale-diff 仓位变动                            │
│  └─────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────┐
│  L3 · 数据源 · 全公开 · 不依赖 paid API                 │
│  ┌─────────────┬─────────────┬─────────────┐           │
│  │ Kalshi 公开 │ Polymarket  │ Reddit JSON │           │
│  │ /trade-api  │ data-api    │ r/Polymarket│           │
│  │ events/mkt  │ /trades     │ r/Kalshi    │           │
│  │ multivariate│ /positions  │ r/sportsbook│           │
│  ├─────────────┼─────────────┼─────────────┤           │
│  │ CryptoPanic │ Wallstreet  │ YN Telegram │           │
│  │ free 50/hr  │ CN newsnow  │ t.me/s/...  │           │
│  │             │ Mac mini    │ archive 抓  │           │
│  ├─────────────┼─────────────┼─────────────┤           │
│  │ ESPN 比赛  │ Riot esports│ Polygon 链  │           │
│  │ scoreboard  │ Supabase    │ Etherscan   │           │
│  └─────────────┴─────────────┴─────────────┘           │
└─────────────────────────────────────────────────────────┘

┌────────── 神经 · ~/.du4leaving (沉淀链路) ──────────────┐
│ agents/<slug>/                                          │
│   IDENTITY.md · SOUL.md · MEMORY.md · daily/            │
│   inbox/ · skills/                                      │
│ digest/YYYY-MM-DD.md                                    │
│ whale-snapshots/<ts>.json                               │
│ lessons (UserDefaults 同步 · iOS / Mac 共享)            │
└─────────────────────────────────────────────────────────┘
```

---

## 3 6 大押注 lane (策略并联)

### Lane 1 · Picks 引擎 (5 信号融合 · 0-100 分)

```
信号           最大权重    源
─────────────────────────────────────
edge_pp        40 分       自家模型 · Elo + 历史回归
Kelly          20 分       数学家公式 · 取一半
liquidity      15 分       vol_24h + open_interest
spread         10 分       买卖差价
level boost    10 分       live-edge 已分级
live context   +5 分       ESPN 在打 · 加分
cross-arb 增强 +3 ~ +12   两网价差 ≥3pp
AI mention 增强 +18      LLM 估实际词频 vs 市场
```

### Lane 2 · Cross-Arb 跨平台扫

```
Kalshi 9 个 sport series × Polymarket 200 active
模糊匹配 · token jaccard ≥ 0.30
价差 ≥ 3pp 即信号 · 标 cheap_yes / cheap_no
Divergence Ledger 跟踪收敛准确率 (snooze 自学)
```

### Lane 3 · Mention 盘 (Catboy 案例)

```
扫所有 KX*MENTION / KX*WORD / KXEARNINGSMENTION* series
分类 · 政论 / 财报 / 文化 / 其他
桶 · 冷门 (<30¢) · 中价 · 高位 (>70¢) · 近必中
LLM 估词频 · 算 edge_pp = est_prob - market_mid
合并入 picks · ≥8pp 才纳入 (噪音过滤)
```

### Lane 4 · Combos 错价

```
Kalshi multivariate 多市场篮
(NBA: game + spread + total + props · 等等)
隐含价 = Π(leg yes_ask)
edge = implied - combo_yes_ask
信号 · buy_cheap (篮子卖便宜) / fade_expensive
独立性假设有局限 · 跨场比同场可信
```

### Lane 5 · Mention LLM 估词频

```
Hermes-3 估 ·
  speaker (Bernie / Powell / Lucid)
  word (Socialism / inflation / quarter)
  event (FOMC / Fighting Oligarchy speech / earnings)
→ estimated_prob (0-1) + confidence (low/med/high)
缓存 30min · 内存
```

### Lane 6 · 退出顾问 (智能止盈/止损/时限)

```
默认 · 借 JMWL66/polymarket_web env schema
TAKE_PROFIT_PERCENT  20%
STOP_LOSS_PERCENT    15%
TIME_EXIT_MINUTES    60
非自动平 · 仅 advisor · ADHD watchdog
```

---

## 4 沉淀链路 (北极星)

```
你下每单 → BetLogWriter 写 ~/.du4/betLog
        ↓
LessonStore 记 (ticker + side + 你的 reason + 你的 tag)
        ↓
结算后 Kalshi history 拉回 → join 你的 reason → 自动写 Lesson
        ↓
calibrationByTag · 你 "强信号" tag 真胜率 · "复仇" tag 真胜率
        ↓
下次 Hermes 顾问看你的 calibration · 提醒你 "这次又是复仇 你 25% wr 别下"
        ↓
SkipLedger / DivergenceLedger 跟踪你跳过的盘后来表现 · 训你直觉
```

---

## 5 Hermes Agent 系统 (替 OpenClaw 思路)

### 5.1 Sage · 你问它答 (人触发)

- POST `/api/xiapan/agent/sage`
- body · `{ question, context, prefer_cloud? }`
- prefer_cloud=true → OpenRouter 405B (重大决断 · ~$0.05/次)
- 默认 → Mac mini Hermes 8B (0 钱)
- 6 个 tool · get_market / get_picks / get_cross_arb / get_calibration / get_recent_lessons / get_whales
- 多回合 (最多 3 跳)
- 输出 markdown · ## 决策 → 理由 → 风险 → 建议下多少

### 5.2 三虾 · 自跑 (cron 触发 · 各有身份)

```
🐅 老虎  · 5min cron · 市场分析师
   读 picks → 写 daily 简报
   tools: get_picks / get_cross_arb / get_calibration

🦆 鸭子  · 1min cron · 鲸鱼监听
   读 whales → 写 daily 八卦
   tools: get_whales

🧮 算盘  · 每晚 02:00 · 沉淀分析师
   读 calibration + lessons → 写月度报告
   tools: get_calibration / get_recent_lessons
```

每虾文件结构 · `~/.du4leaving/agents/<slug>/`

```
IDENTITY.md  · 它是谁 (改可立刻生效)
SOUL.md      · 核心使命
MEMORY.md    · 长期记忆 (持久)
daily/       · 每跑一次写一段 ## YYYY-MM-DD HH:MM
inbox/       · 别虾发它的消息 (跑前读 · 处理后归档)
inbox-read/  · 已处理消息归档
CRON.json    · 节奏 + last_run
```

### 5.3 跨虾通信

```
鸭子看到 $5k 大单 → 输出 markdown 含 ·
  <<MSG to=laohu urgency=high subject=whale>>
  T1 vs Hanwha BUY $5000 · 你重看下边
  <<END>>
↓
runAgent 抽出 → sendMessage 写到老虎 inbox
↓
老虎下次跑 (5min 后) 读到 inbox · 优先处理这条
```

---

## 6 客户端 native (iOS + macOS)

```
SwiftUI 6 · iOS 17+ / macOS 14+
xcodegen 项目
@Observable + @MainActor · 状态层

iOS · 4 tab
  钱 · WealthSection / MaterialismSection / BudgetSection
  单 · MatchCockpitView / PicksRail / MentionsView /
       CombosView / CrossArbView / LiveTradingView /
       TopEdges / CryptoCorner / AIReviewCard
  看 · SignalsView / WhalesView / IntelView (5 tab) /
       HeatmapView / NewsView / GuideSection
  我 · MacMiniSetupCard / SageView / DubySheet /
       LessonsView / SavingsView / 等

macOS · NavigationSplitView 16 sidebar
  总览 · ◆ Hermes 顾问 · ◇ Hermes 三虾 · ◫ 多盘
  ◉ 信号 · ≋ 鲸鱼 · ✎ Mention · ⊟ Combos
  ⇆ 跨平台 · ★ Edges · ● 实盘 · 实时 · 等
```

---

## 7 部署架构

```
你 Mac mini M4 16GB (新装 · 24/7)
├── Ollama hermes3:8b (4.7GB · 默认推理)
├── catchzvibe Next.js dev :3001 (后端)
├── ~/.du4leaving/ (agent 数据)
├── launchd 自启 (next-dev + ollama)
└── Tailscale 100.89.61.104 (出门远程)
       ↑
       │ HTTPS / LAN / Tailscale
       │
你 MacBook M4 Pro 24GB (移动)
├── du4 macOS app
└── 浏览器看 catchzvibe.studio (CZV LLC 公司主仓 · 干净版)

你 iPhone (iOS app · 同 LAN/Tailscale)

云端 Vercel
├── catchzvibe.studio (CZV LLC · Sarah/VC 看)
└── du4leaving 域名 (TZ 个人 · 待设)
   或 · 全本地 Mac mini 跑 · 不上 Vercel
```

---

## 8 v0.67 路线图 · 全自动 AI 投注

```
原则 (用户多次强调) ·
- "全自动 AI 投注" (m655-UPkJ8s + n3PkwmEZ0aQ + 你说的)
- 但要"沉淀 + 迭代" · 不是无脑下
- 必须 5 分钟客服可以平仓 / 暂停
- 必须有止损 / 止盈 / 时限三防
- 必须 Hermes 写 reason · 跑 LessonStore · 自学

阶段 ·

[A] 模拟挂单 (paper trade · 不真花钱) · 1 周
   · 老虎选 picks score ≥ 75 · 写到 paper-trades 表
   · Kelly 半仓 · max 总暴露 5% bankroll
   · 模拟止盈 / 止损 / 时限平
   · 跟真 Kalshi 数据对账 · 算 PnL
   · 你看 100 笔模拟成绩才考虑 [B]

[B] 小额真单 (live · $1-5/单) · 2 周
   · 老虎只下 score ≥ 80 · 强信号
   · ≤ $50/天 总暴露 (硬上限)
   · 每单等 5 秒缓冲 · iOS push 通知 + "10 秒内点 ✗ 取消"
   · 没点 ✗ 自动下 · 你被动

[C] 全自动 (你睡觉它赚钱) · 1 个月
   · 全 strict 模式 · 老虎可下 + 鸭子可平
   · Polygon wallet 接入 · Polymarket 真套利
   · 跨平台 cross-arb 双腿原子下单
   · 每天 8AM digest 看战报 · 不看也不影响

风控护栏 (写死 · 不能 LLM 改) ·
- 单日总下单 ≤ 5% bankroll
- 单单 ≤ 0.5% bankroll
- 任意 24h PnL ≤ -3% bankroll · 自动暂停 24h
- iOS app 可一键 "全停" · 立刻撤所有挂单
- Hermes 跑 5 跳超过 = fallback Static · 不下
```

---

## 9 不在范围

```
不做 ·
- 自家 prediction market 平台 (Kalshi/Poly 已经在做)
- 多用户 SaaS (你个人用 · solo)
- 公开 newsletter (待 newsletter 100 订阅再考虑)
- 中国大陆运营 (法律 · 美国境内 only)

未来可能 ·
- 多人订阅 newsletter (Resend Audiences · 待 catchzvibe domain 验证完)
- 体育博彩 sportsbook 比价 (Pinnacle · The Odds API)
- 0xinsider 链上鲸鱼 ML 模型
```

---

## 10 当前进度 (2026-05-01)

```
v0.31 - v0.66 · 36 版 · 2.5 天

✓ 押注 sharp 工具    cockpit + picks + 6 lane
✓ Hermes agent       sage + 三虾 + cron + inbox
✓ Intel alpha        7 数据源融合 (markets/news/yn/whales/digest/diff)
✓ 沉淀链路           LessonStore + tag calibration + skip ledger
✓ 智能退出           TP / SL / TE advisor
✓ 公开页             /heatmap + /research/pulse (OG 卡)
✓ Vercel Analytics   P2 测量启动
✓ Resend 邮件        每日 8AM 简报
✓ launchd 自启       服务器开机自启
✓ 物理拆库           catchzvibe → du4leaving · 法律隔离
✓ Mac mini 部署      Hermes 本地 + Tailscale (建设中 · 当前位置)

⏳ 当前 · Mac mini 部署 [5]/[7]
⏭ 下次 · v0.67 全自动投注 (paper trade [A] 阶段先跑 1 周)
```

---

## 给策略人看的简短评价点

1. **沉淀链路是最大独门** — 别家都看数据 · 这家"教你 sharp"
2. **5 路 LLM fallback** — Hermes 本地 0 钱 90% 调用
3. **物理拆库** — czv-os / VC DD 看不到博彩业务
4. **3 虾自跑 + 跨虾通信** — 替代 OpenClaw · 体量小但更可控
5. **公开免费页 + OG 卡** — BNB 风格引流 · 0 营销费
6. **全自动投注待 ship** — 必须 paper trade 100 笔才上线 · 非赌场
