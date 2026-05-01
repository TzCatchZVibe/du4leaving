# MASTER TASK LIST · 2026-04-23 夜班 → 04-24 早 11am
# 16 任务 · 每小时 1 个 · 每个完成 · git commit + vercel --prod + changelog

> 路径 · `/Users/happyglobal_tk_team/catchzvibe`
> 部署 · `cd ~/catchzvibe && vercel --prod --yes`
> Changelog · `src/data/changelog.ts` 顶部加 entry
> 规则 · 失败不 block 下一个 · 写 changelog 标 ⚠️ 让 TZ 明早修

## 共同 · 每个 task 必做 4 步

1. **读** · `docs/下一版迭代总方案_v2.md` (背景) + 现有相关 code
2. **写** · 按 task 目标实现 · 新 file / edit existing
3. **验** · `cd ~/catchzvibe && npx tsc --noEmit` · 0 error
4. **发** · `git add -A && git commit -m "<feat>..."` + `vercel --prod --yes`
5. **通** · 给 `src/data/changelog.ts` 顶部加一条 v1.X entry · 标功能
6. **一 commit 一 deploy** · 失败 · commit 进 "⚠️ WIP" · 跳下一个

---

## T1 · INTEL · 文明 6 式世界地图新闻面板

**路由** · `/internal/intel`
**目标** · 交互世界地图 · 展示 HGC 关心的全球数据点 (TK/IG 数据 · 糖果行业新闻 · 达人活动 · 展会日程)。参考 · Flightradar24 / GitHub Globe / Civ 6 tech tree + world map。

**实现**:
- 库 · `react-simple-maps` (轻量 · SVG · 无 key) 或 · `topojson-client` + 手写 d3
- 首版 · `react-simple-maps` · 地图 · 世界 TopoJSON
- 数据 · static JSON `src/data/intel-pins.json` · 首批 20-30 pin
  - pin 包含 · { lat, lng, title, summary, category, date, url }
  - categories · event / news / competitor / kol / own
- 左侧 · pin 时间线 (最近 30 天)
- 地图 · 点 pin → 右侧抽屉 · 细节
- hover · pin 放大 + tooltip
- 色彩 · 构成主义 · 红点 (KOL) / 黑点 (own) / 琥珀 (event) / 灰 (news)
- 顶部 · 简单 filter 按 category

**文件**:
- `src/app/internal/intel/page.tsx` (新)
- `src/components/intel/world-map.tsx` (新 · 客户端)
- `src/components/intel/pin-drawer.tsx` (新)
- `src/data/intel-pins.json` (新 · 20-30 static pins · 真实糖果行业信息 + HG 相关)
- 安装 · `npm install react-simple-maps` + `@types/react-simple-maps` + `d3-geo`

**changelog** · 🌍 INTEL 世界地图上线 · 20 pin · 点 pin 看详情

---

## T2 · Cmd+K 全站命令面板

**依赖** · 全站
**目标** · 按 ⌘K 弹出命令面板 · 搜页面/动作/菜谱 · 参考 Linear / Raycast

**实现**:
- 库 · `cmdk` (Vercel/shadcn 推荐 · 轻量 · 可访问)
- 全站 `<CommandPalette />` 组件 · 挂在 `/internal/layout.tsx`
- 快捷 · ⌘K · 打开 · Esc 关
- 搜索源:
  - Page · 8 主页面 (dashboard/intel/library/learn/chat/recipe/publish/monitor)
  - Recipe · 16 active (从 registry.json)
  - Action · "导素材" "去 triage" "拆整片" 等
  - Account · 7 HG 账号 (虚拟跳转)
- UI · 暗色 modal · 中上 · 圆角 · 构成主义

**文件**:
- `src/components/command-palette.tsx` (新 · "use client")
- `src/app/internal/layout.tsx` (挂载)
- 安装 · `npm install cmdk`

**changelog** · ⌘K 全站命令面板 · 键盘驱动一切

---

## T3 · LEARN · 图书馆 Wiki

**路由** · `/internal/learn`
**目标** · 内部 wiki · 菜谱 playbook + 投流学院 + 团队 SOP

**实现**:
- 用 Supabase `wiki_pages` 表 (schema 00001 已建)
- 列表页 · 按 category 分 · search 栏
- 详情页 · Markdown 渲染 · `/learn/[slug]`
- 编辑页 · 简易 textarea (gold+ 可写)
- 库 · `react-markdown` + `remark-gfm`
- 初始 seed · 4 条内容:
  - "菜谱系统概览"
  - "打标 SOP"
  - "Bunny Stream 上传指南"
  - "HGC 频道架构"
  - 内容可从 docs/ 相关 md 抽取

**文件**:
- `src/app/internal/learn/page.tsx` (列表)
- `src/app/internal/learn/[slug]/page.tsx` (详情)
- `src/app/internal/learn/new/page.tsx` (新建)
- `src/components/markdown-renderer.tsx` (新)
- 安装 · `npm install react-markdown remark-gfm`
- Seed · 写 SQL 或 bash script insert 4 条 wiki_pages

**changelog** · 📚 LEARN 图书馆 · wiki + Markdown + 4 条种子内容

---

## T4 · CHAT · Realtime 团队频道

**路由** · `/internal/chat`
**目标** · 团队内部聊天 · Slack lite

**实现**:
- Supabase Realtime Presence + Broadcast
- Schema · 新表 `chat_messages`:
  - id / user_id / channel / content / created_at
- 默认 channel · "general"
- 页面左侧 · channel 列表 (general / choice / snacks / pr)
- 右侧 · 消息流 · 底部输入框
- Realtime · 新消息自动推
- 在线人数 presence

**文件**:
- migration `00007_chat_messages.sql` · 新表 + RLS
- `src/app/internal/chat/page.tsx`
- `src/app/internal/chat/chat-client.tsx` ("use client" · Realtime 订阅)
- `src/app/actions/chat.ts` (send message)

**changelog** · 💬 CHAT 实时聊天 · presence + broadcast

---

## T5 · PUBLISH · 发布队列

**路由** · `/internal/tools/publish`
**目标** · 管理 7 账号的发布队列

**实现**:
- 用 `publish_queue` 表 (schema 00001 已建)
- 列表 · 按账号分 · 状态 · scheduled/published/failed
- 新建 · 关联 recipe_run + 账号 + 发布时间
- 日历视图 · 简单 grid · 按天显示排期
- 功能先做查看 + 创建 · 不做真实推送 (未来接 TikTok API)

**文件**:
- `src/app/internal/tools/publish/page.tsx`
- `src/app/internal/tools/publish/new/page.tsx`
- `src/app/internal/tools/publish/calendar-view.tsx`
- `src/app/actions/publish.ts`

**changelog** · 📅 PUBLISH 发布队列 · 7 账号 · 日历视图

---

## T6 · MONITOR · 数据面板

**路由** · `/internal/tools/monitor`
**目标** · 7 账号数据一览 · 当前用模拟数据 (未来接 TK/IG API)

**实现**:
- 库 · `recharts` (轻量 React 图表)
- 7 账号卡片 · 每个显示 · 粉丝 / 本周发布数 / 平均播放
- 趋势图 · 最近 30 天 sparkline
- 模拟数据生成 (seed 数据 · 7 账号 × 30 天 × fake numbers)
- 分 tab · "流量" · "GMV" · "达人"

**文件**:
- `src/app/internal/tools/monitor/page.tsx`
- `src/components/monitor/account-card.tsx`
- `src/components/monitor/trend-chart.tsx`
- `src/data/monitor-mock.ts` (30 天 × 7 账号)
- 安装 · `npm install recharts`

**changelog** · 📊 MONITOR 数据面板 · 7 账号模拟数据 · recharts

---

## T7 · 对外首页 v2 · 视频优先

**路由** · `/`
**目标** · 按 v2 方案 · 登陆即播视频 · 字更大 · 节奏更慢

**实现**:
- Hero 视频 · 全屏 · autoplay muted loop · 暗色 overlay
- 视频源 · 用 Bunny HLS (一个 demo 街采视频) 或 · static mp4
- 标题 · Bebas 超大 · ~120px · 白色 · "CATCHZVIBE STUDIO"
- 副 · Cormorant italic · "AI 时代的摄影师工会"
- 滚下 · 作品网格 · 3 列 · hover 放大
- CTA · 顶部小 · "进入内部" 按钮

**文件**:
- `src/app/page.tsx` (重写)
- `src/components/home/hero-video.tsx`
- `src/components/home/works-grid.tsx`

**changelog** · 🎬 首页 v2 · 视频优先 · 字更大 · 进入如观影

---

## T8 · Triage · Combo Bar + 多人光标

**路由** · `/internal/library/triage`
**目标** · v2 方案里的游戏化增强

**实现**:
- 顶部 · Combo Bar · 连续打对 + XP 涨 · 达 10 combo 闪红光
- 多人光标 · Supabase Realtime broadcast · 显示其他人正在打哪个 clip
- 游戏化成就 · "50 条小白" · "100 条猎人" · "500 条大师"
- 统计卡 · 今日打了多少条

**文件**:
- 改 `src/app/internal/library/triage/triage-client.tsx`
- 新 `src/components/triage/combo-bar.tsx`
- 新 `src/components/triage/presence-cursor.tsx` (Realtime)

**changelog** · 🎮 Triage 游戏化 · Combo Bar + 多人 presence

---

## T9 · Split · 流式播放 + 键盘打点

**路由** · `/internal/library/split/[id]`
**目标** · 视频流式 · 键盘快速打 in/out

**实现**:
- hls.js 流式播放 · 大文件不卡
- J (-5s) · K (播放/暂停) · L (+5s) · 参考 Premiere
- I (in) · O (out) · 已有
- Enter (创建 sub_clip)
- Shift+← → (帧级 · 1 帧)
- 波形图 · canvas 上画静音检测 (如果时间够 · 否则跳)

**文件**:
- 改 `src/app/internal/library/split/[id]/split-client.tsx`

**changelog** · ✂️ Split 流式 + Premiere 式键盘打点

---

## T10 · 视觉 v2 tokens · 全站

**目标** · 按 v2 方案 · 落地设计 token

**实现**:
- 改 · `src/app/globals.css` · 加 CSS custom properties
- 新 tokens:
  - Shadow 4 档 (plate / card / pop / modal)
  - Motion 5 档 (instant 100 / quick 150 / smooth 220 / slow 400 / theatrical 600)
  - Color · 加 · sage/amber 更暖 · red 更深
- Tailwind 4 · @theme 扩展
- 首页 + Dashboard + Library 应用新 token

**文件**:
- `src/app/globals.css`
- 可能新 · `src/app/theme.css`

**changelog** · 🎨 视觉 v2 tokens · shadow/motion/color

---

## T11 · 购物车 MVP

**路由** · `/internal/library` (顶部加购物车按钮) + `/internal/cart`
**目标** · 选多 clip 加购物车 · 导出清单

**实现**:
- 用 `shopping_carts` 表 (已建 · migration 00005)
- LibraryGrid 每 clip 加 · "+ 加入购物车" 按钮
- 右侧 floating cart 图标 · 显示数量
- `/internal/cart` 页 · 列出购物车 clips · 可移除 · "结账"
- 结账 · 生成 manifest JSON · 下载

**文件**:
- `src/app/internal/cart/page.tsx`
- `src/app/internal/cart/cart-client.tsx`
- 改 `src/app/internal/library/grid.tsx`
- `src/app/actions/cart.ts`

**changelog** · 🛒 购物车 MVP · 选素材导 manifest

---

## T12 · Lark API · 原片下载链 (骨架)

**目标** · 建立 Lark 接入骨架 · 未来接真 API

**实现**:
- API route · `/api/lark/download/[clip_id]`
- 服务端 · 读 clip 的 `lark_file_token`
- 若有 token · 调 Lark OpenAPI `batch_get_tmp_download_url` (如果没 app credentials · 返回 mock URL)
- UI · clip 卡片右下 · "下载原片" 按钮
- env var · LARK_APP_ID / LARK_APP_SECRET (占位 · TZ 明天配)

**文件**:
- `src/app/api/lark/download/[clip_id]/route.ts`
- `src/lib/lark.ts`
- `.env.local.example` 加 Lark 占位

**changelog** · 📥 Lark API 骨架 · 下载原片按钮 (真 API 明天配)

---

## T13 · Dashboard · sparkline KPI

**路由** · `/internal/dashboard`
**目标** · 按 v2 A-01 建议 · KPI 卡加 7 天 sparkline

**实现**:
- 改 `src/components/dashboard/kpi-grid.tsx`
- 每 KPI 下 · 小 sparkline (用 recharts 或 SVG 手画)
- 数据 · 模拟 · 从 monitor-mock 拿

**文件**:
- 改 `src/components/dashboard/kpi-grid.tsx`
- 新 · `src/components/dashboard/sparkline.tsx`

**changelog** · 📈 Dashboard KPI sparkline · 数字带 7 天趋势

---

## T14 · HG 甲方 access UI

**目标** · hg_employee role 登录后 · 看限定页面

**实现**:
- `/internal/layout.tsx` · 根据 user role 隐藏部分 sidebar
- hg_employee · 只看 · dashboard / library (只读) / wholesale (下单)
- 加 `/internal/wholesale` · 素材批发页 · 简版
- 创建几个 HG staff auth 账号 (用 Admin API 脚本)

**文件**:
- 改 `src/app/internal/layout.tsx`
- `src/app/internal/wholesale/page.tsx`
- `scripts/create-hg-staff.ts` (一次性脚本)

**changelog** · 🔵 HG 甲方 access · hg_employee 专属视图

---

## T15 · 全站测试 + 修 bug

**目标** · 走一遍所有路由 · 修 bug

**实现**:
- `cd ~/catchzvibe && npx tsc --noEmit` · 修 type error
- 用 preview 工具 · 访问每个页面 · 看 console error
- 修最严重的几个 · 不追求全

**文件** · 不新增 · 按 error 修

**changelog** · 🔧 全站 bug 批量修复 · 稳定性升

---

## T16 · 最终 changelog + handoff + deploy

**目标** · 明早 TZ 打开 · 看到完整 v2 changelog

**实现**:
- `src/data/changelog.ts` · 顶部加 v2.0.0 · "夜班 16 模块一次交付"
- 汇总 T1-T15 所有改进
- 写一个 docs/夜班交付报告.md · 记录每 task 结果
- 最后 · vercel --prod 一次 · 确保上线
- 记忆文件 · project_catchzvibe_v2夜班.md · 存给未来 session

**changelog** · 🌙 夜班收官 · v2.0.0 上线 · 16 模块一气呵成
