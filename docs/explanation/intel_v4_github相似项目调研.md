# INTEL v4 · GitHub 相似项目深度调研

> 调研时间 · 2026-04-24  
> 调研对象 · `catchzvibe.studio/internal/intel` 全球新闻工作台 (播客人版 v4)  
> 目标 · 取其精华 · 避其糟粕 · 定 v5 方向

---

## TL;DR

- **共深挖 28 个项目** · 其中必看 3 个 · 可借鉴 8 个 · 避坑 5 个
- **最像 TZ v4 的项目** · `hipcityreg/situation-monitor` (4.1k★ · Svelte + 3D地球) 和 `unicodeveloper/globalthreatmap` (1.5k★ · Next.js + Mapbox) · **两者都做了地图+新闻+情报仪表盘这套组合**
- **最意外发现** · `lajosdeme/watchtower` (263★) · Go终端TUI · 用 RSS + AI Brief · **播客人工具流最接近 TZ 想做的事**
- **最大避坑** · `FinceptTerminal` (14.3k★) · 原生 C++/Qt6 导致跨平台崩溃 · TOP issues 全是 "crashes on Mac/Windows/Ubuntu" · **TZ 选 Next.js Web = 躲过了这颗雷**
- **最意外糟粕** · `WorldMonitor` (52.4k★) 的用户正在抱怨 "地图卡顿" · 它堆了 65+ 数据源+globe.gl+Tauri · TZ 的 11 个 topic 窄而精反而是优势
- **战略洞察** · 目前开源领域 **没有一个项目专为播客人/内容创作者** 做新闻雷达 · TZ 有空白市场

---

## 1. 必看 · 3 个最相似项目 (深度拆解)

### 1.1 `hipcityreg/situation-monitor` ★ 4,101

**URL** · https://github.com/hipcityreg/situation-monitor  
**最后 commit** · 2026-04-24 (当日活跃)  
**技术栈** · TypeScript 63% + Svelte 35.6% + Vite + Tailwind + Vercel  
**License** · 未明示  

**README 描述** · "Real-time dashboard for monitoring global news, markets, and geopolitical events"

#### 视觉设计 (从 PR 和 issue 推断)
- 有 **3D 地球** (globe.gl) + **Heads-Up Display** (Mini Dashboard) 布局 · 最新 PR "Feature/UI overhaul 01" 显示从扁平 D3 地图升级到交互式 globe.gl
- **智能标签定位 + 自适应图标缩放** (从 PR "smart label positioning with leader lines" 看出)
- **分块 panel** 设计 · Sector Heatmap / 市场 / 天气 都独立成 panel
- 深色仪表盘美学 · Svelte 组件化

#### 做对的 3 点 (可借鉴)
1. **Panel 化架构** · 每个数据源是独立 panel (新闻/热力图/BTC Fear&Greed/地方新闻) · TZ 当前左 rail+中地图+右详情是三栏死布局 · v5 可考虑把"11 topics"做成**可拖拽 panel**
2. **smart label positioning with leader lines** · 地图 pin 太密时用引线避免遮挡 · TZ v4 未处理地图标签重叠
3. **i18n 支持 PR 早已提** · 国际化用户真在问 · TZ 作为双语科技传媒公司要趁早做 zh/en 切换

#### 糟粕 / issues 用户抱怨
- **Sector heatmaps return NaN percentages** · 经典数据管道问题 · 数据源 API 挂了没 fallback · TZ 要确保 Supabase 挂掉时前端不崩
- **德国总理信息过时** (Friedrich Merz 2025年5月上任但 README 还显示旧人) · **静态数据陷阱** · 维护全球 political leaders 是无底洞
- **"Add Option for Sysadmin or Security or Local News Panel"** 用户要求 local 本地新闻 · TZ 可以做 `/intel/local` 为 FL/达拉斯这些地方定制
- **网络基础设施 layer 需求** (global internet outages) · 与 TZ 11 topics 无关 · 说明 niche 专精而非大而全才能打动用户

#### 对 TZ v4 的启发
- **把左 rail 11 topics 改成可拖拽 + 可折叠 panel** · 让播客人按今日关注调整布局
- **添加 i18n 开关** · zh/en 随时切 · TZ 是双语 Z 世代品牌 · 早做早对

---

### 1.2 `unicodeveloper/globalthreatmap` ★ 1,481

**URL** · https://github.com/unicodeveloper/globalthreatmap  
**最后 commit** · 2026-04-23 (活跃)  
**技术栈** · Next.js 16 + Mapbox GL JS + react-map-gl + Tailwind v4 + Zustand + valyu-js + OpenAI  
**License** · MIT (推测)

**描述** · "Global threat map. Learn wars, conflicts, military bases and history of nations"

#### 视觉设计 (README 详述)
- **Mapbox 深色地图** + 事件聚类 + 热力图开关
- **色彩分级威胁 markers** · 绿=美军基地 · 蓝=NATO基地 · 紫=Entity · 红=当前冲突 · 蓝=历史冲突
- **tabbed modal 国家情报** · 当前冲突/历史冲突 tab 切换
- **Auto-pan 自动地球游走** · 连续传递感
- **Intel Dossiers** · 深度研究报告 (valyu SDK 触发)

#### 做对的 3 点 (可借鉴)
1. **事件聚类 + 热力图双模式** · 缩小看热力图密度 · 放大看单事件 · TZ 当前只有单 pin · v5 加 cluster 支持
2. **基于颜色的 layer 语义** (军事/历史/当前/entity) · **给 11 topics 每个一个颜色+图标** · 现在 TZ 是"统一暗色"· v5 应 politics=红 / economy=金 / music=紫 / philosophy=白 · 每个 topic 独立色系
3. **auto-pan 地球游走** · 引人入胜 · TZ 可做 "Idle Mode" 自动漂移浏览不同 region 触发探索欲

#### 糟粕 / issues 用户抱怨
- **"/!\ Access token exposed on demo on railway"** · 前端硬编 API token · 被安全用户 call out · TZ 用 Supabase 时要确保 anon key 不暴露服务端密钥
- **"Docker image runs as root; no non-root user defined"** · 容器化随意 · TZ 发布到 Vercel 避开了这坑
- **"IDOR on deep-research task results — no ownership check"** · 任务结果访问控制失败 · TZ 如果未来开放 multi-user 要提前设 RLS
- **"No TLS enforcement"** · 基本 HTTPS 都没强制 · Vercel 自动帮 TZ 解决

#### 对 TZ v4 的启发
- **给 11 topics 每个 topic 独立颜色+图标**,地图 pin 一眼分辨 · v5 必做
- **加 cluster + 热力图开关** · 当新闻量大时避免堆积
- **"Idle Mode" auto-pan** · 无操作 30 秒后自动游走漂移 · 让 TZ 的地图变成"永动展"

---

### 1.3 `lajosdeme/watchtower` ★ 263

**URL** · https://github.com/lajosdeme/watchtower  
**最后 commit** · 2026-04-24 (当日活跃)  
**技术栈** · Go 1.22 + bubbletea + lipgloss + bubbles (Charm 生态 TUI) + gofeed (RSS) + viper  
**License** · 未明示

**描述** · "A clean, minimal, terminal-based global intelligence dashboard"

#### 视觉设计
- **终端 TUI** · 纯键盘操作 · Bloomberg 味道最浓
- **4 大模块** · Global News (100+ RSS · CRITICAL 到 INFO 威胁分级) / Markets / Local / Intel Brief (AI 合成)
- **威胁分级标签** · CRITICAL / HIGH / MEDIUM / LOW / INFO · 单词前面带颜色方块

#### 做对的 3 点 (可借鉴)
1. **威胁分级 CRITICAL → INFO** · TZ 的 Era Lv 0-5 是玩家等级 · **可以引入"新闻等级"** · 比如每条新闻贴 HOOK/WATCH/BACKGROUND 三档 · 让播客人一眼看哪条能做素材
2. **AI Intel Brief 一键合成** · 100+ RSS 取 TOP · 按 AI (Groq/OpenAI/Anthropic/Gemini/Deepseek) 合成一篇简报 · **TZ v5 应加"End of Day AI Brief"按钮** · 一键汇总今日扫过的新闻成一份晚报
3. **无 API key 默认可用** (只 AI Brief 需要 key) · 降低尝试门槛 · TZ 的 Supabase 有默认数据就好 · 不要求用户填 API key

#### 糟粕 / issues 用户抱怨
- issue 只有 4 个开放 · 没什么真抱怨 · 原因是它**极简主义** · 只做新闻/市场/天气/简报 · 没有大而全野心
- **终端 TUI 天然受众窄** · 非程序员用不了 · 也没动力扩展 Web
- 缺乏真正意义上的数据持久化 (只配置文件 yaml) · 不做历史回溯

#### 对 TZ v4 的启发
- **新增"新闻等级"字段** · HOOK (能做节目)/ WATCH (值得关注)/ BACKGROUND (知道就好) · 播客人一看就知道今天扫到 3 条 HOOK · 很有"今日收获"的满足感
- **一键"End of Day AI Brief"** · 当天结束时 Claude 合成今日简报 · 加入 End Day 归档流程
- **AI Brief 不强制 · 可选** · 没 API key 也能用 TZ · 照样扫新闻

---

## 2. 可借鉴 · 8 个相关项目 (要点)

### 2.1 `Thysrael/Horizon` ★ 1,077 · AI 新闻雷达
- **URL** · https://github.com/Thysrael/Horizon
- **技术栈** · Python 3.11 + Docker + GitHub Actions + GitHub Pages (静态站) + uv
- **关键** · **中英双语输出** (完全对应 TZ 双语战略) · 支持 Claude/GPT-4/Gemini/DeepSeek/Doubao/MiniMax · 飞书/Slack/Discord webhook
- **可抄** · **webhook 推送到飞书/Telegram** · TZ 的虾蜂巢已经搭了飞书 · Horizon 的 webhook 代码可以直接借鉴
- **糟粕** · 纯 CLI · 每天靠 GitHub Actions cron · 没有交互 UI · TZ 的 Web 地图更有"游戏感"

### 2.2 `rotemweiss57/gpt-newspaper` ★ 1,463 · GPT 自动报纸
- **URL** · https://github.com/rotemweiss57/gpt-newspaper
- **技术栈** · Python + LangGraph + 7 个 AI agents (Search/Curator/Writer/Critique/Designer/Editor/Publisher) + OpenAI + Tavily
- **关键** · **多agent 流水线** 生成个性化报纸 · HTML/CSS/JS 前端展示
- **可抄** · **Designer Agent 负责版式** · TZ 虾蜂巢可以加一个"虾编辑" agent · End Day 时为今日新闻做版式
- **糟粕 (issues金矿)** ·
  - **Tavily API 422/400/403 错误一大把** · 依赖 Tavily 搜索服务非常脆
  - **Rate limit exceeded** · 无法自定义速率
  - **Docker 不工作** · 自托管门槛高
  - **启示** · TZ 不要锁死一个 AI 供应商 · 要支持 Claude/GPT/Gemini 切换

### 2.3 `realwaynesun/crisismap` ★ 67 · 地缘危机地图
- **URL** · https://github.com/realwaynesun/crisismap
- **技术栈** · Next.js 15 + MapLibre GL (Carto Dark Matter) + Zustand + SWR + Zod + Tailwind
- **数据源宝库** · GDELT (15min) / RSS (5min) / **USGS 地震** (15min) / Polymarket (5min) / Yahoo Finance (5min) / **NASA FIRMS 卫星热点** / **Safe Airspace 飞行安全** / **ACLED 冲突数据**
- **关键** · **Taipei 时区 + 繁体中文** 双语 · 与 TZ 美洲定位互补
- **可抄** · **直接抄数据源列表** · GDELT+USGS+NASA FIRMS+Polymarket 全是公共免费 · 不需要 API key
- **糟粕** · 只有 67 星 · 说明硬核数据源不等于用户喜欢 · **数据源要包装成叙事** · 纯数据不够吸引

### 2.4 `samuelclay/NewsBlur` ★ 7,436 · 个人新闻阅读
- **URL** · https://github.com/samuelclay/NewsBlur
- **技术栈** · Python 3.7+ Django + Backbone.js + PostgreSQL + MongoDB + Redis + Elasticsearch + Celery
- **关键** · **训练式 AI 过滤** (点赞点踩让它学你喜好) · Grid/List/Split/Magazine 4 种布局 · **MCP server 让 AI agent 访问 feed**
- **可抄** · **MCP server 接口** · TZ 的 老虾 agent 可以直接读 Supabase MCP
- **糟粕 (issues金矿)** ·
  - **SLOW_LOAD_TIMES.md / DOWNTIME.md** 专门的性能+宕机文档 · 15年运营下来 102 个 open issues 充满性能抱怨
  - **"cluster 相关故事表现奇怪"** · 聚合算法总有问题
  - **启示** · 随着 RSS 源变多 · **必定遇到性能墙** · TZ 要限制 topic 新闻抓取量 (每 topic 20 条以内)

### 2.5 `newsboat/newsboat` ★ 3,771 · 终端 RSS reader
- **URL** · https://github.com/newsboat/newsboat
- **技术栈** · C++ + 正在逐步迁移 Rust (见 issues "Port ConfigContainer to Rust")
- **关键** · 行业标杆 console RSS reader · 支持 NewsBlur / FeedHQ / Old Reader 第三方账户
- **可抄** · **极简键盘快捷键** · TZ 可以加 `j/k` 上下切 topic · `Enter` 打开详情 · 让 Bloomberg 味道加倍
- **糟粕 (issues金矿)** ·
  - **"High RAM usage" #1 抱怨** (13条评论) · 长时间运行内存涨
  - **"Experiment with lock to avoid crashes when interacting during reload"** · RSS 刷新时操作会崩
  - **"Set a policy regarding LLMs"** · 社区讨论是否要加 AI · 大多数老用户反对
  - **启示** · TZ 的 Web 版不容易有 RAM 问题 · 但要注意 **刷新时不阻塞交互** · 新闻在加载时地图依然可操作

### 2.6 `wtfutil/wtf` ★ 16,863 · 终端个人信息仪表板
- **URL** · https://github.com/wtfutil/wtf
- **技术栈** · Go + tcell + tview (25+ 模块)
- **关键** · **模块化 config.yml** · 用户只开自己想要的模块 · GitHub/Trello/Google Calendar/HackerNews/Have I Been Pwned
- **可抄** · **config.yml 式模块化** · TZ 可让用户在 `/intel/settings` 开关 11 topics 中想看哪些 · 不想看的 topic 折叠/隐藏
- **糟粕 (issues金矿)** ·
  - **"informally maintained by a small collection of volunteers"** · 开源社区维护者疲劳 · 50 个 open issues 没人管
  - **"bugs may not be fixed without community incentives like BountySource bounties"** · 得付钱才能推动修 bug
  - **启示** · TZ 是商业项目 · 不要依赖社区 PR · 反而要自己建 SLA 响应

### 2.7 `glanceapp/glance` ★ 33,731 · 自托管仪表板
- **URL** · https://github.com/glanceapp/glance (TZ 已知但值得补充)
- **技术栈** · Go + HTML/JS/CSS (纯 vanilla) · <20MB binary · 页面 1s 内加载
- **关键** · **Fast & Lightweight** · 不用 React/Vue · 纯服务端渲染 + minimal JS
- **可抄** · **性能第一原则** · TZ v4 用 Next.js 16 + React 19 很重 · **考虑把"全球地图页"用服务端渲染+minimal JS** · Lighthouse 跑分冲 100
- **糟粕 (issues金矿)** ·
  - **"Request timeouts"** 用户用 Pi-Hole 时 DNS 限速导致 widget 超时
  - **"Layout problems"** · Dark Reader 浏览器扩展破坏布局
  - **"Configuration errors"** · 配置文件 duplicate "pages" keys 写错用户很头大
  - **"Pihole EOF Error"** #1 issue · 仍未修
  - **启示** · **YAML/JSON 配置对普通用户太难** · TZ 应用 UI 代替 config 文件 · 所有设置都在 `/intel/settings` 前端

### 2.8 `buzz/newsdash` ★ 65 · iGoogle 复刻
- **URL** · https://github.com/buzz/newsdash
- **技术栈** · TypeScript + Node.js + Redis + nginx + Docker + AGPL-3.0
- **关键** · **iGoogle/Netvibes 风 · dock-based 仪表盘** · 拖拽 widget · 4 种 feed 布局 (condensed/list/detailed/tiles)
- **可抄** · **dock-based 可拖拽 widget 布局** · TZ v5 让播客人自己拖 "11 topics" 成自己爱看的排列
- **糟粕** · 单人维护 (@buzz) · 2024-07 后没新 release · 说明"怀旧 iGoogle 风"虽然好看但用户留存差 · 因为**没游戏化机制**

---

## 3. 避坑 · 5 个项目的用户抱怨精华

### 3.1 `Fincept-Corporation/FinceptTerminal` ★ 14,259 · 躲!
**选了原生 C++ Qt6 的代价**:
- **"The latest version crashes when launching on mac"** (11 条评论)
- **"Mac OS Apple Silicon crashes on launch (code signing issue)"** (9 条)
- **"When adding broker the app crashes on windows"** (8 条)
- **"Crypto section crashes on Windows 11 — Qt/C++ bug"** (7 条)
- **"App crashes on UI interaction and fails to restart on Ubuntu 24.04"** (4 条)
- **"High Cpu usage while compile this project"**
- **"Cannot download from link — 404"**
- **"App crashes seconds after launch on Windows 11 — STATUS_STACK_BUFFER_OVERRUN"**

**结论** · **"原生性能"是陷阱** · Qt6+C++20 在 Mac/Win/Linux 三端都崩 · 维护成本爆炸
**TZ 的优势** · Next.js Web 浏览器运行 = 跨平台免费获得

### 3.2 `koala73/worldmonitor` ★ 52,444 · 大而全的代价
**用户主要抱怨** (从 Discussion 和 Issues 汇总):
- **"Laggy World Map / main 'Global Situation' module"** · 核心功能卡顿
- **"Desktop app updates"** · Windows/macOS 用户更新体验差
- **"OpenSky ADS-B integration failures"** · 第三方数据源挂掉没 fallback
- **"Questions about changing server ports and customization options remain unanswered"** · 开源项目维护者响应慢
- 开放 PR 看出趋势: **"perf(globe): lazy-load GlobeMap — remove three.js/globe.gl from initial bundle"** · 他们自己都发现 globe.gl+Three.js 首包太大
- **"fix(relay): bounded recursion in sendTelegram on HTTP 429"** · Telegram 推送递归爆栈

**结论** · 堆 500+ 新闻源+globe.gl+deck.gl+Tauri+5 个变体 · 代码 3,593 commits · **技术债崩塌中**
**TZ 避坑** · **坚持 11 topics + react-simple-maps** (Equal Earth 投影是 SVG · 比 globe.gl 轻 100 倍) · 窄而精打败大而全

### 3.3 `rotemweiss57/gpt-newspaper` ★ 1,463 · 依赖第三方的代价
**用户抱怨**:
- **"422 Client Error: Tavily API"** (7 条评论)
- **"Rate limit exceeded error - Any way to set the rate limit?"** (3 条)
- **"HTTPError 400 Client Error: Bad Request tavily"** (2 条)
- **"Tavily API error: 403"**
- **"not work on docker"**
- **"No result on the test"**

**结论** · LLM + Tavily + LangGraph 7-agent 链路 · **任一环节挂就整个死** · 用户无法 debug
**TZ 避坑** · v4 Supabase + 简单 fetch · 数据源挂掉 fallback 缓存数据 · 不要搞复杂 agent 链

### 3.4 `Lissy93/dashy` ★ 24,781 · 历史包袱
**主要抱怨**:
- **"[BUG] Fonts not loading"** (5 条评论)
- **"Migrate Dashy to Vue 3, Vite and Node 24"** (5 条) · Vue 2 还没升 Vue 3
- 一堆 Dependabot bump · **技术债累积**
- 维护者更新慢

**结论** · 2017 启动的 Vue 2 项目 · 2026 还没升 Vue 3 · **早期技术选型拖 10 年**
**TZ 优势** · Next.js 16 + React 19 (最新) · 避开历史包袱

### 3.5 `samuelclay/NewsBlur` ★ 7,436 · 性能墙
**用户长期抱怨**:
- **SLOW_LOAD_TIMES.md** 专门文档说性能问题
- **DOWNTIME.md** 专门文档说宕机
- **102 open issues** 大多性能或 UI 卡顿
- **"Weird cluster related stories behaviour"** · 聚合 bug 多年未修
- **iOS/Android 客户端偏好同步问题**

**结论** · **MongoDB + PostgreSQL + Redis + Elasticsearch** 4 大数据库 · 规模大了之后性能指数级变慢
**TZ 避坑** · **只用 Supabase (PostgreSQL)** · 不急着加缓存层 · 当真的扛不住时再加 Redis

---

## 4. 意外发现

### 4.1 **开源领域没有"播客人专用"新闻雷达**
- 搜索 "podcaster research"/"content creator research"/"journalist workflow" · **全是 AI 生成播客脚本** · 没有**辅助真人播客人选题**的工具
- `thefalc/podcast-research-agent` (26★) · 但只是"输入 URL 生成研究简报"· 不是每日扫全球新闻
- **TZ 的定位是空白市场** · 如果做好 · 10 万粉丝目标可以靠这个工具本身带来流量

### 4.2 **Bloomberg 美学开源项目都在终端做,Web 端没人占领**
- `watchtower` / `newsboat` / `FinTerm` / `wtfutil` · 全是 TUI
- Web 端做 Bloomberg 美学的只有少量 React 玩具项目 (个位数星) · 都是学生作业
- **TZ 做 Web + Bloomberg 美学 = 填补空白**

### 4.3 **地图+新闻 这个组合比预期小众**
- 做地图+新闻的总共也就 `worldmonitor` / `situation-monitor` / `globalthreatmap` / `crisismap` / `HSTSOL Global-Risk-Map` 5 个真做
- **加上游戏化 (Day 数 / Era Lv / End Day)** 的 **0 个**
- TZ v4 的"游戏化全球地图"是独家风格

### 4.4 **GDELT+USGS+NASA FIRMS+Polymarket 是免费公共数据源金矿**
- `crisismap` 整合了这些 · 可抄清单:
  - **GDELT** · 15min 全球新闻事件 + 情感分析 (**TZ 未用 · 强烈推荐**)
  - **USGS** · 实时地震 M2.5+
  - **NASA FIRMS** · 卫星火点 (野火/军事爆炸可见)
  - **Polymarket** · 预测市场 API (地缘事件赔率)
  - **Safe Airspace** · 飞行禁区 (战争信号)
  - **ACLED** · 政治暴力事件
  - **Yahoo Finance** · 免费实时报价

### 4.5 **"End of Day Brief" 是未被占领的 UX 模式**
- 扫了所有项目 · **没一个** 在"用户结束一天"时给 AI 合成简报
- `Horizon` 做每日早报 · 但没有"播客人视角"
- **TZ 的 End Day 机制 + AI Brief = 全新品类**

### 4.6 **`gpt-newspaper` 的 Designer Agent 模式值得借鉴**
- 7-agent 流水线: Search → Curator → Writer → Critique → Designer → Editor → Publisher
- **TZ 虾蜂巢可以映射**:
  - 虾探 = Search Agent
  - 老虾 = Curator (选题)
  - 虾写 = Writer
  - 虾编辑 = Editor
  - 虾设计 = Designer (新增 · 为 End Day Brief 做版式)

---

## 5. 直接抄作业清单 (v5 可立即借鉴)

### 5.1 组件级 (3 天内)
| 组件 | 抄自 | 做法 |
|---|---|---|
| **Topic 颜色语义化** | globalthreatmap | 11 topics 每个独立色系 · politics=血红 / economy=金 / music=紫 / philosophy=白 / 科技=青蓝 |
| **Pin cluster + 热力图切换** | globalthreatmap / worldmonitor | 缩小地图时 pin 聚合成 cluster + 可选热力图模式 |
| **Smart label leader lines** | situation-monitor | pin 太密时用细线引出标题 · 避免堆叠 |
| **新闻分级 HOOK/WATCH/BACKGROUND** | watchtower | 每条新闻贴标签 · 播客人专用 · HOOK=能做节目的选题 |
| **键盘快捷键 j/k/Enter** | newsboat | 上下切换 · 回车打开详情 · 让播客人手不离键盘 |

### 5.2 交互级 (1-2 周)
| 交互 | 抄自 | 做法 |
|---|---|---|
| **Auto-pan idle mode** | globalthreatmap | 无操作 30 秒地图自动漂移 · 配 ambient BGM |
| **可拖拽 topic panel** | newsdash / situation-monitor | 11 topics 变成可拖拽卡片 · 用户自定义布局 |
| **End of Day AI Brief** | watchtower | End Day 按钮触发 Claude 合成今日简报 (Markdown) · 自动推飞书 |
| **MCP server** | NewsBlur | 暴露新闻 DB 给 Claude Code · 老虾 agent 直接读 |
| **i18n zh/en 切换** | situation-monitor / crisismap | 右上角语言切换 · 适配 TZ 双语品牌 |

### 5.3 数据源级 (立即)
| 源 | 抄自 | 接入 |
|---|---|---|
| **GDELT** | crisismap | 免费 · 15min 间隔 · 全球事件 + 情感分析 |
| **USGS Earthquake** | crisismap | 免费 · 15min · M2.5+ 地震 |
| **NASA FIRMS** | crisismap | 免费 · 卫星火点 |
| **Polymarket** | crisismap / watchtower | 免费 · 地缘预测赔率 |
| **Reuters/BBC/Al Jazeera RSS** | 所有项目 | 免费 · 5min 刷新 |
| **飞书 webhook 推送** | Horizon | TZ 已有飞书 · 早晚报直接 push |

### 5.4 架构级 (3-4 周)
| 策略 | 启发自 | 做法 |
|---|---|---|
| **UI 设置代替 config 文件** | Glance 的 config 痛点 | `/intel/settings` 前端页可开关 topic · 不要 YAML |
| **多 AI 供应商切换** | gpt-newspaper 的 Tavily 依赖陷阱 | 支持 Claude/GPT/Gemini/DeepSeek · 一个挂切下一个 |
| **Topic 新闻数量上限** | NewsBlur 的性能墙 | 每 topic 最多 20 条 · 防止 Supabase 查询慢 |
| **数据源挂掉 fallback 缓存** | WorldMonitor 用户抱怨 | 源挂了前端继续展示上次数据 + 灰色标"数据已延迟" |
| **坚持 react-simple-maps · 不升 globe.gl** | WorldMonitor 3D 地图性能 PR | SVG 轻 100 倍 · 加载快 · 移动端友好 |

### 5.5 独特性 (定 v5 差异化)
1. **"HOOK 猎人模式"** · 开启后地图只显示 HOOK 级别新闻 · 播客人专用模式
2. **"Podcaster Profile"** · 选自己做 tech/music/geopolitics/mixed 播客类型 · 个性化推送
3. **End Day 生成"今日选题备忘录"** · 自动 Markdown · 可导出飞书/Notion
4. **Clip-to-素材包** · 每条新闻右键 "clip this" → 自动扫出官方推文/官方图/相关视频链接 · 一键存到 Lark 云盘素材库
5. **"Era 时光机"** · 点击过去某一 Day · 重现当日地图和新闻 · 复盘选题历史

---

## Sources (所有真实 URL)

### 必看级
- [hipcityreg/situation-monitor](https://github.com/hipcityreg/situation-monitor) · 4,101★
- [unicodeveloper/globalthreatmap](https://github.com/unicodeveloper/globalthreatmap) · 1,481★
- [lajosdeme/watchtower](https://github.com/lajosdeme/watchtower) · 263★

### 可借鉴级
- [Thysrael/Horizon](https://github.com/Thysrael/Horizon) · 1,077★
- [rotemweiss57/gpt-newspaper](https://github.com/rotemweiss57/gpt-newspaper) · 1,463★
- [realwaynesun/crisismap](https://github.com/realwaynesun/crisismap) · 67★
- [samuelclay/NewsBlur](https://github.com/samuelclay/NewsBlur) · 7,436★
- [newsboat/newsboat](https://github.com/newsboat/newsboat) · 3,771★
- [wtfutil/wtf](https://github.com/wtfutil/wtf) · 16,863★
- [glanceapp/glance](https://github.com/glanceapp/glance) · 33,731★
- [buzz/newsdash](https://github.com/buzz/newsdash) · 65★

### 避坑级
- [Fincept-Corporation/FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal) · 14,259★ · 原生崩溃
- [koala73/worldmonitor](https://github.com/koala73/worldmonitor) · 52,444★ · 大而全塌方中
- [Lissy93/dashy](https://github.com/Lissy93/dashy) · 24,781★ · Vue2 历史债
- [OpenBB-finance/OpenBB](https://github.com/OpenBB-finance/OpenBB) · 66,500★ · 后端连接问题

### 补充技术参考
- [zcreativelabs/react-simple-maps](https://github.com/zcreativelabs/react-simple-maps) · 3,294★ · TZ 正用
- [FreshRSS/FreshRSS](https://github.com/FreshRSS/FreshRSS) · 14,847★ · 老牌 RSS
- [Ranchero-Software/NetNewsWire](https://github.com/Ranchero-Software/NetNewsWire) · 9,960★ · macOS RSS
- [HSTSOL/Global-Risk-Map](https://github.com/HSTSOL/Global-Risk-Map) · 2★ · OpenRisk 地缘风险地图
- [finaldie/auto-news](https://github.com/finaldie/auto-news) · 870★ · 多源 LLM 过滤
- [donnemartin/haxor-news](https://github.com/donnemartin/haxor-news) · 4,078★ · HN CLI
- [Ranchero-Software/NetNewsWire](https://github.com/Ranchero-Software/NetNewsWire) · 9,960★

---

## 最后的 3 句战略话

1. **TZ v4 已经打赢了 3 场仗** · 游戏化 (Era Lv / Day) + Web (跨平台) + 11 topics 窄而精 · 这三件事别改
2. **v5 最该做的 3 件事** · (a) topic 颜色语义 + pin cluster + smart label 让地图看起来专业 · (b) 新闻分级 HOOK/WATCH/BACKGROUND 为播客人做专用标签 · (c) End of Day AI Brief + MCP 接入老虾 agent
3. **v5 最该避的 3 个陷阱** · (a) 不要学 Fincept 去做原生 C++ 客户端 · (b) 不要学 WorldMonitor 加 globe.gl · (c) 不要学 gpt-newspaper 锁死单一 AI 供应商

**睡前读完就知道 v5 该做啥 · 早上起来直接开工**
