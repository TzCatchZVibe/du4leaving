# INTEL v3 · 文明 6 风 RPG 新闻面板 · 设计与调研

版本 · v3.0-design
日期 · 2026-04-23
范围 · `/internal/intel` 路由重做
产出类型 · 设计文档 (无代码)
调研轮数 · 15+ WebSearch
TZ 原话 · "做出和文明游戏里一模一样的 RPG 交互面板 · 一模一样非常重要"

---

## 目录

1. Civ 6 UI 解剖
2. GitHub 精华 5 项目 (真 URL + stars)
3. 糟粕避坑清单 (users complaints)
4. HGC INTEL v3 设计 (ASCII + 组件 + tokens)
5. 实施 roadmap (phase 1-3)
6. Sources

---

## 1 · Civ 6 UI 解剖

### 1.1 总体布局 (基于官方截图与 gamepressure 教程推断)

Civ 6 的 HUD 是典型的 "包边式" 布局 · 把六边形地图放在正中间 · 四周用金属+卷轴装饰条框住 · 重要信息永远贴屏幕边缘 · 中间留给地图。

```
┌────────────────────────────────────────────────────────────────┐
│ [TOP BAR · 金属条]                                              │
│  👑Leader  🔬Science +12  🎭Culture +8  ⛪Faith +3             │
│            💰Gold 245 (+4)  ⚡Power  🕰️Turn 87 · 1580 AD      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ [LEFT 通知]             [主视图 · 六边形地图]      [RIGHT 面板] │
│ ┌──────────┐                                      ┌──────────┐│
│ │ 🔔战报  │                                       │ 🗺️迷你图 ││
│ │ 🔔政策  │    ⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡                    │ 🔬科技树 ││
│ │ 🔔建成  │    ⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡                    │ 🎭市政树 ││
│ │ 🔔发现  │    ⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡                    │ 👥外交   ││
│ │ ⚠ 灾难  │    ⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡                    │ ⚙政府   ││
│ └──────────┘                                      └──────────┘│
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ [BOTTOM] Mini 导航 ═══════ [ END TURN ⏎ ] ═══════ Era 箭头     │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 顶部 HUD (Top Bar) · 拆解

按 Civ 6 官方 + gamepressure 教程 · 顶部条从左到右依次:

```
┌─ 领袖头像 ─┬─ Science ─┬─ Culture ─┬─ Faith ─┬─ Gold ─┬─ Strategic ─┬─ Turn/Era ─┐
│  圆形徽章  │  🔬 +12   │  🎭 +8    │  ⛪ 3   │ 💰 245 │  铁 3 / 马 1 │ 1580 AD    │
│  可点开   │  /turn   │  /turn   │  /turn │ (+4)   │  Luxury 4    │ Turn 87    │
└──────────┴──────────┴──────────┴────────┴───────┴──────────────┴────────────┘
```

关键视觉特征:
- 金属盾牌质感 (embossed metal) · 宽度约 60-80px · 贴顶栏
- 每个资源图标是**圆形浮雕**金色边框
- 数字是白色 · 上方数字大 · "每回合变化" 小字在下 · 灰色 (+4)
- 切分线用细金色竖线 · 约 2px
- 顶部与屏幕顶部有 5-8px 留白 · 类似 "挂" 起来的感觉

### 1.3 左侧通知面板 (Notification Panel)

Civ 6 左侧通知按"紧急度"堆叠 · 每条是一个圆形图标 + 弹出卷轴式长条:

```
┌─┐
│⚔│ ← 战争警报 · 红底金边
├─┤
│🏛│ ← 政策可用 · 紫底金边
├─┤
│🏰│ ← 建筑完工 · 绿底金边
├─┤
│💡│ ← 新科技 · 蓝底金边
├─┤
│☠│ ← 灾难 · 暗红金边
└─┘
```

每个图标悬停或点开 → 弹出**羊皮纸卷轴** (parchment scroll) · 带装饰花纹边框 · 显示完整事件描述 + "查看"/"忽略"按钮。

### 1.4 右侧迷你地图 + 科技树入口

```
┌────────────┐
│ 🗺️ 迷你图  │ ← 当前视野缩影 · 可点任意点跳转
├────────────┤
│ 🔬 [展开]  │ ← Science Tree 入口
├────────────┤
│ 🎭 [展开]  │ ← Civics Tree 入口
├────────────┤
│ 👥 [展开]  │ ← 外交/领袖列表
├────────────┤
│ ⚙ [展开]  │ ← 政府/政策卡
└────────────┘
```

点 "🔬 展开" → 全屏遮罩 · 科技树铺满 · 每个节点是圆形徽章 · 已研究=亮金 · 可研究=亮白 · 锁住=灰。

### 1.5 底部 · End Turn 按钮

Civ 6 右下角 End Turn 按钮是全场**最大最亮**的 UI 元素:
- 直径约 80-100px · 圆形
- 蓝紫色宝石质感 · 外围金属环
- 中心闪烁旋转的 "⏎" 箭头 (当还有未决策时会变成 "?" 提示)
- 悬停会轻微放大 + 金边发光

### 1.6 色板 (从 Civ 6 截图色采样 + 社区记载推断)

注: Civ 6 官方**没有公开 hex**代码 · 以下为从游戏截图采样 + CivFanatics 社区推断的**近似值** · 用于 UI 复刻:

| 名称 | Hex | 用途 |
|------|-----|------|
| 古金 (Civ Gold) | `#c9a961` | 边框 · 图标高亮 · 金属条 |
| 深金阴影 | `#8b7339` | 边框内阴影 · 图标描边 |
| 钢蓝 (Civ Steel Blue) | `#3c5a7a` | 主按钮 · End Turn 宝石 · 蓝底通知 |
| 深蓝夜 | `#1e2a3a` | 面板底色 · 最暗背景 |
| 羊皮纸 (Parchment) | `#d9c8a3` | 卷轴通知 · 对话框底 |
| 羊皮纸暗边 | `#a89770` | 卷轴边缘渐变 |
| 墨色 | `#1a1410` | 正文字 · 深色底 |
| 暖白 | `#f4ecd8` | 数字 · 标题字 |
| 战争红 | `#8b2e2e` | 警报 · 敌对 · 灾难 |
| 科技青 | `#4a7a8b` | 新科技 · 研究 · 蓝色通知 |
| 信仰紫 | `#6a4a7a` | 宗教 · 文化 |
| 黄金高光 | `#e8c878` | 按钮悬停 · 文字强调 |

**材质特征** · Civ 6 从早期用"陶土/木刻"风 · 工业时代起变"抛光金属+蓝宝石" · 默认 UI 是后者。

### 1.7 字体 (已证实来自游戏资源目录)

CivFanatics 论坛明确列出 Civ 6 的字体文件 (Steam/steamapps/common/Sid Meier's Civilization VI/Base/Assets/UI/Fonts):

| 游戏内用途 | 字体 | Web 免费替代 |
|-----------|------|-------------|
| UI 正文 | **Noto Sans** | Noto Sans (Google Fonts) · **已有** |
| 数字 · 粗标题 | **Myriad Pro** | Inter / Source Sans 3 |
| 衬线正文 | **Minion Pro** | Cormorant / EB Garamond · **Cormorant 已有** |
| 辅助 | Helvetica Neue | Inter / System font |
| 调试工具 | Noto Mono | JetBrains Mono · **已有** |

**结论** · HGC 无需新装字体 · 已有 Noto Sans + Cormorant + JetBrains Mono · 覆盖 Civ 6 全部 UI 需求。"Trebuchet / Eras ITC" 是社区传言 · 实际游戏用的是 **Noto Sans + Myriad Pro**。

### 1.8 装饰元素目录

Civ 6 的装饰词汇相当明确 · 可在 HGC 复刻:

- **圆形浮雕徽章** (emboss medallion) · 所有资源/科技节点通用
- **金属条+铆钉** (metal bar with rivets) · 顶部/底部 HUD 骨架
- **卷轴展开** (scroll unfurl) · 通知/对话
- **六边形格子** (hex tile) · 地图基本单位 · 可填充贴图
- **齿轮环** (gear ring) · 生产/建设图标外框
- **盾牌** (shield crest) · 城市/军队符号 · 带条纹
- **绳索缠绕边框** (rope border) · 旧科技树装饰
- **藤蔓角花** (floral corner) · 对话框四角
- **宝石嵌入** (gem inlay) · End Turn 按钮 · 重要按钮中心

---

## 2 · GitHub 精华 5 项目

### 2.1 WorldMonitor (最像 TZ 愿景)

- URL · https://github.com/koala73/worldmonitor
- **Stars · 52.4k** (2026-03 最新)
- 最后 commit · 2026-03-01 (v2.5.23) · **极度活跃**
- 技术栈 · Vanilla TypeScript + Vite + globe.gl (Three.js) + deck.gl + MapLibre GL · Tauri 2 桌面端
- **最亮** · 双地图引擎 · 3D 地球仪 + WebGL 平面图 · 45 数据层 · 500+ RSS 源跨 15 类
- **精华借鉴** · 数据层分类法 (15 类 ≈ TZ 的 11 领域) · Tauri 未来可用
- **糟粕** · Vanilla TS 不是 React · 无法直接 fork · 但**数据结构 + 分类 ID** 可直接借
- **5 站点变种** · world / tech / finance / commodity / happy · 说明"多品牌共用骨架"是被验证过的

### 2.2 Unciv (Civ V 开源复刻 · UI 反面教材优秀)

- URL · https://github.com/yairm210/Unciv
- **Stars · 10.3k** · Forks 1.8k
- 最后 release · 2026-04-06 (v4.20.1) · **日更**
- 技术栈 · Kotlin + LibGDX (非 Web) · 不能直接用
- **最亮** · 完整 Civ V 信息架构 · 科技树/市政树/城市面板逻辑可 1:1 参考布局
- **糟粕** (社区 issue #4316, #12591) ·
  - "UI 看起来业余" · 没有层级 · 信息平铺堆砌
  - 桌面端字体按钮过大 · 浪费空间
  - 图标颜色太像 · 单位地图上分不清
  - 城市面板每次刷新触发全量重算 · 慢
- **借鉴方式** · 看它的**信息结构** · **避开**它的视觉风格

### 2.3 Freeciv-web (老牌 · HTML5+WebGL)

- URL · https://github.com/freeciv/freeciv-web
- **Stars · 2.2k** · Forks 371 · 5,819 commits
- 最后 release · 2015-07 (但 commit 还有新的 · develop 分支活跃)
- 技术栈 · JavaScript + Java + Python + C · Three.js WebGL + Tomcat/nginx
- **最亮** · 浏览器里跑 2D+3D 文明游戏 · 成熟的回合制前端
- **糟粕** · 技术栈老 (jQuery 时代) · 代码组织杂 · UI 视觉是 2005 水准
- **借鉴** · 看它怎么把**回合/资源状态**塞进浏览器 · 不抄代码

### 2.4 CQUI Community Edition (Civ 6 官方 UI 的修复者)

- URL · https://github.com/civfanatics/CQUI_Community-Edition
- **Stars · 168** · Lua 100%
- **最亮** · 把 Civ 6 官方 UI 的**所有痛点**整理成功能清单 · 直接就是"避坑书"
  - 顶部显示奢侈资源
  - 右键 End Turn 立即结束
  - 建筑单元"单位标签"+"升级+"标记
  - 城市 banner 显示人口增长回合数
  - 市政/科技树自动聚焦搜索
- **糟粕** · Lua + 游戏内脚本 · 代码不能搬 · 但**交互模式**可抄
- **借鉴** · 它修的每一个痛点 = HGC v3 应该**天生就有**

### 2.5 react-hexgrid + honeycomb-grid (基础构件)

- **react-hexgrid** · https://github.com/Hellenic/react-hexgrid
  - Stars · 351 · TypeScript 94.6% · SVG 渲染
  - 最后 release · 2022-01 (v1.0.4) · **维护告急** (topic tag `maintainer-wanted`)
  - 糟粕 · 拖拽实现不完善 · v2 beta 未稳
- **honeycomb-grid** · https://github.com/flauwekeul/honeycomb
  - Stars · 695 · TypeScript 97.4% · **渲染无关** (只算坐标)
  - 最后 release · 2023-11 (v4.1.5) · **活跃**
- **推荐** · 用 **honeycomb-grid** 做坐标/邻接/寻路 · 自己用 SVG/Canvas 画 · 不绑死 react-hexgrid
- **理由** · react-hexgrid 两年没更新 · 视觉定制弱 · 但坐标数学是共通的

### 2.6 (加分) Glance · 自托管仪表板

- URL · https://github.com/glanceapp/glance
- **Stars · 33.7k** · Go + HTML + CSS
- **最亮** · 极致主题化 · 轻量 (<20MB 二进制) · 广泛 widget 类型 (RSS/HN/Reddit/Weather/Twitch)
- **借鉴** · widget 可插拔架构 · 主题系统的 CSS 变量组织方式
- **糟粕** · 视觉是"整洁极简"派 · 与文明 RPG 完全对立 · 不抄视觉 · 只抄组织法

---

## 3 · 糟粕避坑清单 (基于以上用户抱怨)

从 Civ 6 原版 / Unciv / CQUI 三方交叉验证 · HGC v3 必须**规避**以下 12 坑:

| # | 坑 | 来源 | HGC v3 对策 |
|---|----|------|-------------|
| 1 | 字体过小 / 不能缩放 | Civ6 Steam 讨论 | CSS `clamp()` + min 14px · 支持用户放大 |
| 2 | 顶栏吃掉边缘滚动 | CivFanatics | 顶栏高度 56px 封顶 · 地图区留完整滚动范围 |
| 3 | 通知刷屏堆满中屏 | CivFanatics | 通知固定左侧 · 自动折叠 · max 5 可见 |
| 4 | 信息平铺无层级 (Unciv) | Issue #4316 | 严格三级层级 · 卡片用字号+描边区分 |
| 5 | 图标颜色太像 | Unciv #12591 | 11 topic 每个**独立色+独立图标** · 无重复 |
| 6 | 按钮/字体过大占屏 (Unciv 桌面) | Issue #2824 | 桌面密度中等 · 移动端才放大 |
| 7 | 城市面板全量重算慢 | Unciv #5440 | 每个 topic 卡片独立 memo · 无全局重算 |
| 8 | 关闭按钮被弹窗遮挡 | Unciv #12745 | 关闭按钮始终右上角 · z-index 最高 |
| 9 | 科技/市政看不出区别 | Civ6 CQUI 修复点 | 不同 tree 用不同色调 (金/紫/蓝) |
| 10 | 图标"2001 剪贴画" | Civ6 CivFanatics | 用 Lucide + 自绘 SVG · 统一线条风格 |
| 11 | 城邦要求看不懂 | Civ6 官方 | 每个 topic 有"一句话"悬停提示 |
| 12 | 没有"新发现"标记 | Civ6 官方 | 新事件 (24h 内) 有脉冲小红点 |

---

## 4 · HGC INTEL v3 设计

### 4.1 主布局 ASCII (1:1 还原 Civ 6)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [TOP HUD · 深蓝金属条 56px]                                                   │
│ [👑 TZ] CatchZVibe Civilization · Era: INFORMATION · Day 115 · 2026-04-23   │
│ ─────────────────────────────────────────────────────────────────────────── │
│ 🏛️政治 3   💰经济 5   💻科技 8   🧠哲学 2   📖文学 1   👥社会 4            │
│ 🎭娱乐 6   🎵音乐 3   📷摄影 2   ⚔️LoL 4   🎮主机 1  🕰️Last sync 14:22    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [LEFT 通知]        [MAIN · 六边形新闻地图]           [RIGHT 面板]            │
│ ┌─────────┐                                          ┌────────────┐         │
│ │ ⚔ 重大  │      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡                │ 🗺️ 迷你图  │         │
│ │ 5 事件  │    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡              │────────────│         │
│ │─────────│      ⬡ ⬡ [政治●] ⬡ ⬡ ⬡ ⬡              │ 🔬 科技树  │         │
│ │ 💡 发现 │    ⬡ ⬡ ⬡ ⬡ ⬡ [科技●●●] ⬡ ⬡           │ 挖深度     │         │
│ │ 3 新知  │      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡              │────────────│         │
│ │─────────│    ⬡ ⬡ ⬡ [LoL●] ⬡ ⬡ ⬡ ⬡ ⬡             │ 👥 外交   │         │
│ │ 📣 热点 │      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡              │ 团队队友 │         │
│ │ 1 突发  │    ⬡ ⬡ ⬡ ⬡ ⬡ [音乐●●] ⬡ ⬡ ⬡           │────────────│         │
│ │─────────│      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡              │ 📡 RSS 源 │         │
│ │ ⚠ 风险  │    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡              │ 已连 7/11│         │
│ │ 2 警报  │                                         └────────────┘         │
│ └─────────┘                                                                 │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ [BOTTOM · 金属条 48px]                                                       │
│  ◄ Day 114 ═══════ [ 🌅 END DAY · 结束今日 ⏎ ] ═══════ Day 116 ►           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 组件清单 (8 个 · 命名遵循 Civ 词汇)

| 组件 | 职责 | 对应 Civ 元素 |
|------|------|--------------|
| `CivHUD` | 顶部 56px 金属条 · 11 资源 + 领袖 + 回合 | Top Resources Bar |
| `CivLeaderBadge` | TZ 圆形头像 · 点开进"我的档案" | Leader Portrait |
| `CivNotificationPanel` | 左侧通知 · 按类型堆叠 · 卷轴展开 | Notification Stack |
| `CivHexMap` | 主视图 · 六边形新闻网格 · SVG 自绘 + honeycomb-grid 算坐标 | Main Map View |
| `CivHexTile` | 单个六边形 · 含 topic 色 + 事件数 + 脉冲点 | Map Tile |
| `CivRightPanel` | 右侧 · 迷你图 + 科技树入口 + 外交 | Minimap + Tree toggles |
| `CivTechTree` | 全屏遮罩 · 按 topic 展开历史事件挖深 | Science Tree popup |
| `CivEndDayButton` | 底部中央大宝石按钮 · 归档今日 · 开启明日 | End Turn Button |

辅助:
- `CivScrollBorder` · 羊皮纸卷轴边框包装器 (给通知/对话用)
- `CivMetalBar` · 顶部/底部金属条装饰容器
- `CivEmbossIcon` · 圆形浮雕图标 (11 topic 通用)

### 4.3 数据映射 (Civ 概念 → HGC 数据)

| Civ 概念 | HGC 数据 |
|---------|----------|
| Leader | TZ 自己 · 名字 "CatchZVibe Civilization" |
| Era | Era: INFORMATION · 固定 · 或按年份升格 |
| Turn | Day (YYYY-MM-DD) |
| 资源 (gold/science/faith) | 11 topic 今日事件数 |
| 地图 hex | 新闻事件 · 按 topic 着色 · 按地理聚类 |
| 通知 | 24h 内突发/重大/风险/发现 |
| 科技树 | 每 topic 历史事件串 · 可挖深到来源 RSS / 论文 / 原帖 |
| 市政树 | TZ 自己的"认知进度" · 已读/未读标记 (v2 扩展) |
| 外交 | HG 团队 · Hank / Frida / Freddy / Ranny 头像 |
| 城市 | (v2 保留) 可用来表示 TZ 关注的 "项目阵地" |
| End Turn | 归档当日 · 生成"今日简报" markdown · 进入下一日 |

### 4.4 11 Topic 资源图标 + 色

避坑 #5 (图标颜色别太像) · 每个 topic 独立视觉:

| Topic | 图标 (Lucide 基) | 主色 | 描边色 |
|-------|------------------|------|-------|
| politics 政治 | 🏛️ Landmark | `#8b2e2e` 战争红 | `#6a1e1e` |
| economy 经济 | 💰 CircleDollarSign | `#c9a961` 古金 | `#8b7339` |
| tech 科技 | 💻 Cpu | `#3c5a7a` 钢蓝 | `#1e2a3a` |
| philosophy 哲学 | 🧠 BrainCog | `#6a4a7a` 信仰紫 | `#4a3258` |
| literature 文学 | 📖 BookOpen | `#8b6a39` 羊皮褐 | `#5a4424` |
| society 社会 | 👥 Users | `#7a8b3c` 橄榄 | `#556020` |
| entertainment 娱乐 | 🎭 Theater | `#b84a7a` 玫红 | `#7a2e52` |
| music 音乐 | 🎵 Music4 | `#4a7a8b` 科技青 | `#2e5058` |
| photography 摄影 | 📷 Camera | `#2e2e2e` 墨 | `#000` |
| esports LoL | ⚔️ Swords | `#c97a1e` 战旗橙 | `#8b4e0e` |
| console-game 主机 | 🎮 Gamepad2 | `#5a3c7a` 电玩紫 | `#3e2858` |

11 色分布在色轮各个角落 · 视觉上能一眼分开。

### 4.5 Design Tokens (CSS 变量)

```
/* 色板 */
--civ-gold:          #c9a961;
--civ-gold-dark:     #8b7339;
--civ-gold-hi:       #e8c878;
--civ-steel:         #3c5a7a;
--civ-night:         #1e2a3a;
--civ-parchment:     #d9c8a3;
--civ-parchment-dk:  #a89770;
--civ-ink:           #1a1410;
--civ-warm-white:    #f4ecd8;
--civ-war-red:       #8b2e2e;
--civ-science-cyan:  #4a7a8b;
--civ-faith-violet:  #6a4a7a;

/* 排版 */
--civ-font-title:  "Cormorant Garamond", serif;  /* 已有 */
--civ-font-body:   "Noto Sans", system-ui;       /* 已有 */
--civ-font-mono:   "JetBrains Mono", monospace;  /* 已有 */
--civ-font-num:    "Inter", "Noto Sans";         /* 代替 Myriad Pro */

/* 尺寸 */
--civ-hud-h-top:     56px;
--civ-hud-h-bottom:  48px;
--civ-panel-w-left:  280px;
--civ-panel-w-right: 300px;
--civ-hex-r:         44px;   /* 单格半径 */

/* 边框/阴影 */
--civ-border-gold:   1px solid var(--civ-gold);
--civ-border-emboss: 2px solid var(--civ-gold-dark);
--civ-shadow-inset:  inset 0 1px 0 var(--civ-gold-hi), inset 0 -1px 0 var(--civ-gold-dark);
--civ-shadow-scroll: 0 4px 12px rgba(0,0,0,.3), 0 0 0 1px var(--civ-parchment-dk);
```

### 4.6 交互动效

- **Hex 悬停** · 轻微放大 1.05 + 外发光金边 (0.15s ease)
- **Hex 点击** · 右侧面板切到"该 topic 详情" · 卷轴展开 0.3s
- **通知进入** · 从左侧滑入 · 卷轴 unroll 效果 0.4s
- **End Day 按钮** · 悬停脉冲金光 · 点击全屏暗场 0.6s → 新 Day 淡入
- **资源数字变化** · 单数字翻牌 (CSS 关键帧 0.5s)
- **无音效 v1** · 可在 v2 加 Civ-style hover/click 声 (公版音源)

---

## 5 · 实施 Roadmap

### Phase 1 · UI 骨架 (2-3h)

目标 · 空壳跑通 · 所有组件位置对 · 用假数据

**任务**:
1. 新建 `src/components/civ/` · 按 4.2 清单建 8 个空组件
2. 新建 `src/styles/civ.css` · 写 4.5 tokens
3. 改 `src/app/internal/intel/page.tsx` · server · 读 `intel-events.json` (新)
4. 改 `intel-client.tsx` → `civ-client.tsx` · 装配骨架
5. 装 `honeycomb-grid` (仅坐标算法) · 不装 react-hexgrid
6. 首屏目标 · 看见 HUD + 左通知 + hex map 骨架 + 右面板 + End Day 按钮

**验收** · 打开 `/internal/intel` · 能看到文明风布局 · 所有数据是占位

### Phase 2 · 真实数据 (11 topic · 过去 24h)

目标 · 手造 30+ 条真实 2026-04 新闻 · 带真 URL · 11 topic 全覆盖

**任务**:
1. 新建 `src/data/intel-events.json` · schema:
   ```
   { id, topic, title, summary, source_url, source_name,
     published_at, lat, lng, hex_q, hex_r, severity, is_new }
   ```
2. 手工填 30 条 · 每 topic 2-3 条 · 都是 2026-04 真新闻 · 真 URL
3. Hex 坐标按"地理聚类" · 欧美/亚太/拉美/非洲四大区 · 同 topic 相邻
4. 左侧通知只显示 severity >= 3 的
5. 顶部资源数字 = 今日各 topic 事件数 · 自动算
6. `is_new` (24h 内) · 脉冲小红点动效

**验收** · 打开页面 · 11 资源有真数字 · 30+ hex 可悬停看 title · 能点开看 summary + 跳源链接

### Phase 3 · 深度挖 · 科技树

目标 · 点 topic → 弹出该 topic 的"历史事件线" · 像科技树

**任务**:
1. `CivTechTree` 组件 · 全屏遮罩 + 卷轴边框
2. 每个 topic 攒 7-10 天历史事件 (Phase 2 数据跨天积累)
3. 事件按时间轴 · 纵向排列 · 节点圆徽章 · 连线金丝
4. 点某节点 · 右侧出详情卡 · 包含 AI 摘要 (接 Claude) + 原文链接
5. "深度挖"按钮 · 触发 Apify/RSS 反查该事件的更多源
6. End Day 按钮 · 点击生成 `intel-daily-brief-YYYY-MM-DD.md` 落 Obsidian

**验收** · 点"🔬 科技树" · 看到 politics 话题的 7 天时间线 · 可挖每条新闻细节

### 预算与依赖

- 新装 npm 包 · `honeycomb-grid` (695★ · 活跃 · TypeScript · 无 React 绑定)
- **不装** · react-hexgrid (维护告急) · react-simple-maps 保留做背景层
- 图标 · Lucide (已有) + 11 个自绘 SVG emboss 徽章 (v1 用 Lucide · v2 再细化)
- 字体 · 零新增 · Noto Sans + Cormorant + JetBrains Mono + Inter 已够
- 数据源 · v1 手工 JSON · v2 接 RSS (Apify 已有脚本) · v3 接 Claude 自动摘要

---

## 6 · Sources (真 URL)

### Civ 6 UI 研究
- [Game UI Database - Civilization VI](https://www.gameuidatabase.com/gameData.php?id=639)
- [Civilization 6: Interface tips - gamepressure.com](https://www.gamepressure.com/sidmeierscivilization6/interface/ze92ba)
- [Interface In Game - Civilization VI](https://interfaceingame.com/games/sid-meiers-civilization-vi/)
- [Civ VI Fonts thread - CivFanatics](https://forums.civfanatics.com/threads/civ-vi-fonts.674787/)
- [For anyone unhappy with the Civ 6 UI - CivFanatics](https://forums.civfanatics.com/threads/for-anyone-unhappy-with-the-civ-6-ui.611252/)
- [The User-Interface Is a Serious Issue - Steam](https://steamcommunity.com/app/289070/discussions/0/340412122410817378/)
- [Art Assets in Civilization 6: A Modding Guide](https://forums.civfanatics.com/threads/art-assets-in-civilization-6-a-modding-guide.612050/)

### GitHub 项目 (已核实 stars + commit 日期)
- [WorldMonitor (52.4k★ · 2026-03)](https://github.com/koala73/worldmonitor)
- [Unciv (10.3k★ · 2026-04)](https://github.com/yairm210/Unciv)
- [Freeciv-web (2.2k★)](https://github.com/freeciv/freeciv-web)
- [CQUI Community Edition (168★)](https://github.com/civfanatics/CQUI_Community-Edition)
- [react-hexgrid (351★ · 维护告急)](https://github.com/Hellenic/react-hexgrid)
- [honeycomb-grid (695★ · 活跃)](https://github.com/flauwekeul/honeycomb)
- [Glance (33.7k★)](https://github.com/glanceapp/glance)

### Unciv UI Issues (糟粕来源)
- [suggestions/bug reports about UI · Issue #4316](https://github.com/yairm210/Unciv/issues/4316)
- [In-game UI readability · Issue #12591](https://github.com/yairm210/Unciv/issues/12591)
- [Improve Desktop Experience · Issue #2824](https://github.com/yairm210/Unciv/issues/2824)
- [City UI slow in late game · Issue #5440](https://github.com/yairm210/Unciv/issues/5440)
- [Unit info pane obscured · Issue #12745](https://github.com/yairm210/Unciv/issues/12745)

### 参考技术
- [Red Blob Games · Hexagons](https://www.redblobgames.com/grids/hexagons/implementation.html)
- [Honeycomb docs](https://abbekeultjes.nl/honeycomb/)

---

## 结语 · 给执行者 (主会话)

1. **先 Phase 1** · 骨架跑起来 · 别一上来追细节
2. **不装 react-hexgrid** · 用 honeycomb-grid + 自写 SVG · 给未来留活路
3. **Civ 6 字体不神秘** · Noto Sans + Cormorant 已经够 · 别装 Myriad Pro
4. **避开 12 坑** · 每个组件 PR 前对照一遍
5. **色板锁死** · `civ.css` tokens 是真理 · 别在组件里 hardcode 色值
6. **数据第一** · Phase 2 填真 URL 比 Phase 1 做花哨动效重要 10 倍
7. **End Day 按钮是灵魂** · 最大最亮 · 这是 Civ 6 的精神象征

完。
