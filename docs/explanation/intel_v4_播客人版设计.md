# INTEL v4 · 播客人版设计 · 真地图 + 新闻终端 + Civ 精神

版本 · v4.0-design
日期 · 2026-04-24
范围 · `/internal/intel` 路由第四次重做 · 纠正 v3 六边形方向错误
对象 · TZ (独立播客 + 媒体创作者 · HGC 频道主理人)
产出类型 · 设计文档 (含主方案 + 3 备选 · 无代码)
调研轮数 · 12+ WebSearch (4 块全覆盖)

TZ 原话 ·
- "整体地图不像真实的地图 · 平时根本看不出来是哪个国家"
- "艺术效果也非常糟糕"
- "Civ 6 要学的是对信息化 · 对于新闻式信息的游戏化处理方式 · 不是几何六边形"

---

## 目录

1. v3 复盘 · 3 个致命错误
2. 块 1 · 播客人 / 记者真实工具调研
3. 块 2 · 真地图 + 新闻可视化参考
4. 块 3 · Civ 6 游戏化精神抽取 (非视觉)
5. 块 4 · HGC INTEL v4 完整设计
6. 实施 Roadmap (Phase 1/2/3)
7. Sources

---

## 1 · v3 复盘 · 3 个致命错误

v3 把"做得和 Civ 6 一模一样"当成目标 · 结果**字面复刻**了六边形视觉 · 丢失了 TZ 真正需要的"信息化处理方式"。

| # | v3 错误 | 本质 | v4 纠正 |
|---|---------|------|---------|
| 1 | 用六边形 hex grid 做"世界地图" | 六边形是 Civ 的**地图投影**不是世界地图 · 它是给回合制游戏做邻接/寻路的 · 新闻是点数据不是格子数据 | 换回真地图 (Robinson 投影 / Mercator) · 用 pin 不用 hex |
| 2 | 把"看不清哪个国家"当细节瑕疵 | 对播客人是致命伤 · 播客人的 B-roll 截图必须一眼认出国家 · 看不懂国别就不能发 | 地图必须**有国界线 + 国名 label** · 缩放时显示 |
| 3 | 视觉追"金属+羊皮纸"装饰 | 这是游戏美术 · 对播客人工具是**干扰** · 播客人每天看 2 小时要的是"低疲劳的信息密度" | 切到 **Bloomberg 暗色终端风** · 保留羊皮纸只给 End Day 归档仪式 |

**v3 做对的 · 要保留**:
- 11 topic 色分色逻辑 (色板可继承)
- 组件命名 Civ 词汇 (Leader / Turn / End Day) 是对的
- 避坑清单 12 条 (v4 仍有效)
- honeycomb-grid 不装 · react-hexgrid 不装 · 这两条结论依然正确

**v4 核心命题**:
> Civ 6 教我们的是 **回合仪式 / 资源积累 / 科技深挖 / End Turn 心理** · 不是教我们画六边形。把这套游戏化**心法**嫁接到 **Bloomberg Terminal + GDELT Map + Feedly Feed** 的真地图+真新闻骨架上。

---

## 2 · 块 1 · 播客人 / 记者真实工具调研

### 2.1 头部播客人的信息消费真相

Joe Rogan / Lex Fridman 公开资料极少谈工具细节 · 但可以从"制作规模+输出内容"反推:
- Rogan 每期 2-3 小时 · 嘉宾领域跨度极大 · 几乎**不做结构化研究** · 更多是"聊天+嘉宾说"
- Lex Fridman 每期前会发问题清单 · 研究一周 · 用 Notion + 自己读论文
- 两人都**不用专业新闻工具** · 这不是我们的参考对象

**真正的参考对象是新闻记者 + 中长尾播客人**:
- 他们每周产出 · 严重依赖工具
- 工作流有明确阶段: 采集 → 筛选 → 深挖 → 写稿 → 发布
- TZ 就属于这一类 (每周 EP + 日更短视频)

### 2.2 核心 5 款真产品 (有 URL · 有真实用户评价)

#### A · Feedly (RSS 深度源控制 · 有 AI)
- URL · https://feedly.com
- 定位 · "journalist 的神器" · 追 1000+ 源无压力
- **做对的**:
  - AI "Leo" 按兴趣打标签+优先级
  - 按主题组织 feed (TZ 的 11 topic 直接映射)
  - 保存 → 笔记 → 分享 一条龙
  - Board (收藏夹) 可按项目分 · 一期 EP 一个 Board
- **糟粕**:
  - 免费版太弱 · Pro 起 $8/月
  - UI 多年没大改 · 视觉疲劳
  - 2026 年被 Feedly Alternatives 列表点名"停滞"
- **对 TZ 最高价值**: **AI 按兴趣打标** + **Board 按 EP 组织**

#### B · Ground News (bias 感知 · 盲区提示)
- URL · https://ground.news
- 定位 · 告诉你"这条新闻各派怎么说" · 附 bias bar
- **做对的**:
  - 每条新闻下方一个 bias 条 (左派红 / 右派蓝 / 中间灰)
  - "Blindspot" 功能 · 提示"某派没报的重要事件"
  - 对"做评论内容"的播客人是**金矿** (Ben Shapiro 式平衡陈述)
- **糟粕**:
  - 界面略乱 · 每条新闻塞满标签
  - bias 判定有时误判 (算法非人工)
- **对 TZ 最高价值**: **bias bar** 这个 UI 元素 · v4 每条新闻可加"左/中/右"分布条

#### C · Dataminr for News (实时突发 · 编辑部级)
- URL · https://dataminr.com/products/dataminr-for-news/
- 定位 · AI 从 X/Reddit/社交流里挖"刚刚发生的事"
- **做对的** (Media Copilot 2026 报道原文):
  - 编辑部级 Web Dashboard · 地图 + 筛选器
  - 多通道投递 · Email + Slack + 移动推送
  - 地理维度 alerts (某地区突发标红)
- **糟粕**:
  - 企业级 · 小团队买不起 ($2000+/月)
  - 信号噪声比不稳 · 要调教
- **对 TZ 最高价值**: **地图 + 筛选器** 布局 · 直接借鉴

#### D · Inoreader (源控制 + 自动化)
- URL · https://www.inoreader.com
- 定位 · Feedly 对头 · 专业 RSS + rule-based 过滤
- **做对的**:
  - Rule 自动分类 (包含关键词自动打 tag)
  - 离线下载 · 播客人出差地铁上看
  - 密度模式可选 (magazine / list / compact)
- **糟粕**: UI 老派 · 新手曲线陡
- **对 TZ 最高价值**: **rule 自动分类** · v4 应有自动 topic 归类

#### E · Briefing Agent (AI 摘要 · 开源)
- URL · https://creati.ai/ai-tools/briefing-agent/
- 定位 · NewsAPI + OpenAI 自动生成"每日 5 条"简报
- **做对的**:
  - AI 摘要 · 每条 3 句话
  - 可配置频率 + 长度
  - 开源 · 可自部署
- **糟粕**: 没有 UI · 纯 API · 要自己拼前端
- **对 TZ 最高价值**: **AI 摘要** 作为 v3 Phase 3 的现成方案

### 2.3 从 5 产品抽取 TZ 必需的 7 个功能

| 功能 | 来源 | v4 优先级 |
|------|------|-----------|
| 按 topic 组织源 (Feedly Board) | Feedly | **Phase 1** (已在 v3) |
| Bias bar (左/中/右) | Ground News | Phase 2 (可选) |
| 地图 + 筛选器 dashboard | Dataminr | **Phase 1** (核心) |
| AI 摘要每条 3 句话 | Briefing Agent | Phase 3 |
| Rule-based 自动分类 | Inoreader | Phase 2 |
| 收藏/Board 按 EP 组织 | Feedly | Phase 2 |
| 实时突发地理 alerts | Dataminr | Phase 2 |

---

## 3 · 块 2 · 真地图 + 新闻可视化参考 (非游戏)

### 3.1 Bloomberg Terminal (终端风圣经)

- URL · https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity/
- 设计哲学: "**conceal complexity**" · 数千功能 · 但用户体验要无缝

**布局精髓**:
- **深黑背景** (#000 / #0a0a0a) · 长时间看低疲劳
- **橙色 + 蓝色双高亮** · 橙表 alert / 蓝表 data
- **Launchpad** · 用户自定义多面板并排 · 曾经硬限 4 面板 · 2022 取消改成 tabbed 无限
- **单行字高密度** · 行距紧 · 一屏能塞几十条
- **快捷键为主** · 鼠标是备胎

**对 v4 的直接启示**:
1. **切换到暗色主题** · 长时间看不累 · 羊皮纸+金属的暖色留给归档仪式
2. **橙+蓝双色** · topic 色轮继承 · 但状态色用 Bloomberg 式 (🟠 alert / 🔵 data / ⚪ read)
3. **无限面板** · 放弃 v3 的"左通知+中地图+右面板"硬三栏 · 改成可拖动可折叠

### 3.2 GDELT Project (真新闻地图的标杆)

- URL · https://www.gdeltproject.org
- 全球最大开源新闻数据库 · 100 种语言 · 每小时更新
- **Interactive Realtime Map**: https://blog.gdeltproject.org/an-interactive-realtime-map-of-the-worlds-news/

**GDELT Map 做对的**:
- **真地图** (CartoDB · Web Mercator)
- **dots 覆盖全球** · 每个点是一个事件
- **点击 → 弹出该地点的所有相关新闻 + 图像**
- **每小时刷新** · 时间感强
- 支持语言/主题/情感 (tone) 筛选

**GDELT Map 糟粕**:
- 默认层过于密集 · 初次看很吓人
- 无分类 · 所有事件一个颜色 (需要自己筛)
- 无收藏/标注 · 纯探索

**对 v4 的直接启示**:
1. **真 dots 不是 hex** · 按 (lat, lng) 画 pin
2. **同地区多事件** · 聚合成一个大 pin · 数字叠加 (比如"纽约 7")
3. **点击 pin** → 右侧面板展开该地所有新闻
4. **topic 色编码 pin** · 比 GDELT 单色更清晰

### 3.3 NewsMap.jp (treemap 经典)

- URL · https://newsmap.ijmacd.com (newsmap.jp 继承者)
- 作者 Marcos Weskamp · HackMIT 作品 · 后被 Google News 间接使用
- 算法: **squarified treemap** · 每条新闻按"热度"占据面积 · 颜色按类别

**NewsMap 做对的**:
- 一眼看出"今天哪类新闻最多"
- 颜色严格分类 (世界/国/体育/娱乐/经济/科技/健康)
- 面积 = 热度 · 符合人眼直觉

**NewsMap 糟粕**:
- 没有地理维度
- 只能看当下一瞬间 · 无历史
- 密集小块难点

**对 v4 的直接启示**:
**底部 feed 流** 可用 treemap 模式切换 · 让 TZ 一眼看"今天哪 topic 占大头"。这是个**备选视图**不是主视图。

### 3.4 投影选择 · Mercator vs Robinson

来自 projections.mgis.psu.edu 和 map-projections.net 的权威对比:

| 投影 | 优点 | 缺点 | 适合 |
|------|------|------|------|
| **Web Mercator** | 所有 map lib 默认支持 · 网络标准 | 高纬度严重变形 · 俄罗斯/加拿大被夸大 · 非洲被缩小 | 本地导航 |
| **Robinson** | 全球视觉平衡 · 大小比例接近真实 | 非标准 · 要找专门的 topojson | 展示"世界" |
| **Equal Earth** | 面积真实 · 近年新标准 (2018) | 边缘圆 · 视觉略奇特 | 新闻 · 科学 |
| **Orthographic (地球仪)** | 3D 感最强 | 一次只能看半球 · 有死角 | 品牌感 |

**v4 推荐**: **Equal Earth** · 理由:
1. react-simple-maps 默认支持 · 零配置
2. 2018 年国际新标准 · 面积真实 · 不歪曲非洲
3. 比 Mercator 更"像真地图" · TZ 说过"平时根本看不出哪个国家" → Equal Earth 各国形状还原度高
4. 比 Robinson 新 · 比 Orthographic 简单

### 3.5 Pin 聚合策略 (避免重叠)

**问题**: 纽约一天 5 条新闻 · 5 个 pin 重叠 · 地图一糊

**方案 A · supercluster (Mapbox 开源)**
- github.com/mapbox/supercluster · 业界标准
- 缩放时自动聚合/散开
- 可嵌入 leaflet / mapbox / react-simple-maps
- **推荐** · 久经考验

**方案 B · 手工聚合 by city**
- 按城市预聚合 · 一个城市一个大 pin · 数字标在中心
- 简单但缩放不平滑

**方案 C · donut pin**
- 一个 pin 但分成 pie 切片 · 每色代表一个 topic
- 酷但小尺寸看不清

**v4 推荐**: **A + C 组合** · supercluster 算聚合 · pin 样式用 donut (有多 topic 时) 或单色 (单 topic 时)

### 3.6 色彩方向: 暗色终端 vs 纸本 MUJI

| 方向 | 支持证据 | 适用场景 |
|------|---------|---------|
| 暗色终端 (Bloomberg) | 每天 2+ 小时用 · 低眼疲劳 · 专业感 · GDELT/Dataminr 都是暗底 | 主工作台 |
| 纸本 MUJI (v2 夜班) | 短暂仪式感 · 归档动作 · 值得"翻书"的仪式 | End Day 归档按钮 + 归档 markdown |

**v4 决定**: **主面板暗色** (Bloomberg 式) · **End Day 动画 0.6s 暗场** → **羊皮纸报刊一瞬闪过** · 最后落到 Obsidian md。两种美学都用 · 但**暗色是主**。

---

## 4 · 块 3 · Civ 6 游戏化精神抽取 (非视觉)

Civ 6 的 4X 设计 (eXplore/eXpand/eXploit/eXterminate) + 回合制 + 科技树 · 可以解剖成 6 个**心法**:

### 4.1 六个心法 · 对应 TZ 媒体工具

| Civ 6 心法 | 核心心理 | v4 映射 | 具体实现 |
|-----------|---------|---------|---------|
| **Turn** | "今天"明确边界 | `Day 115` · 从 Day 1 算起 (日期=2025-12-30 起) | 顶部 HUD 显示 "Day 115 · 2026-04-24" |
| **资源积累** | 看数字涨的快感 | 11 topic XP 条 · 今日事件数 | 每个 topic 卡片右上小数字 · 今日+X |
| **Era 升级** | "我的文明进步了" | 累计阅读里程 · 解锁头衔 | 0-100 Informed Citizen / 100-1000 Analyst / 1000-5000 Curator / 5000+ Media Mogul |
| **科技树** | 深挖单一领域 | 一个 topic 时间线 (7-30 天) | 点 topic → 右侧时间轴 · 节点 = 事件 |
| **Policy 卡** | 今日重点选择 | 每天晨会选 3 topic 作为"Focus" | Focus 的 topic 前置排序 · 其他降权 |
| **End Turn** | 仪式感结束 | End Day 按钮 · 生成 markdown | 点击 → 暗场 → 羊皮纸报刊闪现 → Obsidian |

### 4.2 "Era 升级" 详细设计 (全新 · v3 没有)

```
Level 0 · Newbie        (0-99 articles read)
Level 1 · Informed      (100-499)
Level 2 · Curator       (500-1499)
Level 3 · Analyst       (1500-4999)
Level 4 · Polyglot      (5000-9999)
Level 5 · Media Mogul   (10000+)
```

每次升级:
- 全屏 2s 烟花动画 (仅一次 · 不烦人)
- 右下角新头衔徽章更新
- 解锁新功能 (如 Lv 2 解锁 bias bar · Lv 3 解锁 AI 摘要 · Lv 4 解锁多地图对比)

**好处**: 给 TZ "我在成长"的持续反馈 · 对 ADHD 用户友好 (短期奖励循环)

### 4.3 "Focus Policy" (每日晨会 3 选)

**Civ 6 原型**: Policy Card · 不同政策组合不同产出加成

**v4 映射**:
- 每天 00:00 重置 · 首次打开弹出 "今日 Focus?"
- 从 11 topic 选 3 个
- 被选中的 topic: pin 变大 10% · feed 置顶 · notification 开启
- 未选中的: 正常显示 · 无特殊待遇
- 可跳过 (默认全开)

**好处**: 把"今天到底看啥"从"全部扫一遍"降维到"3 个精打细磨" · 解决 TZ 的信息过载

### 4.4 "End Day" 仪式 (v4 最大亮点)

**Civ 6 原型**: End Turn 大宝石按钮 · 点击后 · 所有未决策项提示 · 按确认进入下一回合

**v4 映射**:
```
用户流程:
1. 右下角"🌅 END DAY"按钮亮起 (每天 22:00 自动发光)
2. 悬停提示: "今日完成? 未读还有 X 条 · 收藏 Y 条 · 归档后不可改"
3. 点击 → 全屏暗场 0.5s
4. 暗场中央浮现"今日简报"羊皮纸风卡片 1.5s · 显示:
   - Day 115 · 2026-04-24
   - 今日总事件 32 条 · 已读 27 · 收藏 4 · 已转稿 2
   - Top 3 topic: 经济 8 · 科技 6 · 政治 5
   - AI 一句话总结 (Phase 3)
5. "Archive & Next Day" 按钮
6. 点击 → 生成 `intel-daily-brief-2026-04-24.md` 落 Obsidian
7. 页面淡入 Day 116 (数字翻牌)
```

**好处**: 明确"今天结束了" · 下班仪式感 · ADHD 用户需要的"一天闭环"

### 4.5 必须**避免**的 Civ 字面复刻

v4 明确**不要**:
- 六边形 hex (已确认错误)
- 金属盾牌条 HUD (工具感变游戏感 · 降价值感)
- 卷轴 unfurl 通知 (酷但每天看烦)
- 羊皮纸对话框 (同上 · 仅 End Day 用)
- "古金 · 钢蓝"主色板 (太强装饰 · 留给 End Day)

v4 **要**:
- 游戏化心法 (Turn / XP / Era / Policy / End Day)
- 工具美学 (Bloomberg 暗色 · GDELT 真地图 · Feedly feed)
- 两套美学分工 (主面板工具 · 归档仪式)

---

## 5 · 块 4 · HGC INTEL v4 完整设计

### 5.1 主布局方案对比 (3 版)

#### 方案 A · **地图中心 + 右详情 + 底部 feed** (推荐)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [TOP HUD · 暗色 · 48px]                                                 │
│ 🕰 Day 115 · 2026-04-24  |  🎖 Curator Lv.2  |  ⚡ Focus: 经济·科技·政治 │
│ 📰 32 new · ✓ 15 read · 🔖 4 saved · 🔥 hot 3                          │
├───────┬──────────────────────────────────────────────┬─────────────────┤
│ 左 ·   │  主视图 · 真世界地图 (Equal Earth)           │ 右 · 详情面板   │
│ 11     │                                              │                 │
│ Topic  │   · 深色地图底 (#0a0e1a)                     │ 选中:           │
│ XP 条  │   · 国界线描白 (rgba(255,255,255,0.15))       │ "Fed 降息 50bp" │
│        │   · pin 按 topic 色                          │                 │
│ 🏛 5   │   · supercluster 聚合                        │ 摘要 (Lv3 AI)   │
│ 💰 8 🔥│   · 悬停显国名 + 该地所有事件                │ 原文 →          │
│ 💻 6 🔥│                                              │ 源 · Reuters    │
│ 🧠 2   │   [交互]                                     │ bias: 中 (Lv2)  │
│ 📖 1   │   · scroll = zoom                            │ 截帧 · 复制图  │
│ 👥 4   │   · drag = pan                                │ 归 TK / IG / X │
│ 🎭 6   │   · click pin = 右侧展开                     │ 收藏 ★ (EP-12)  │
│ 🎵 3   │   · click empty = 关闭                       │                 │
│ 📷 2   │                                              │                 │
│ ⚔ 4 🔥│                                              │                 │
│ 🎮 1   │                                              │                 │
├───────┴──────────────────────────────────────────────┴─────────────────┤
│ 底部 · Feed 流 (list 默认 · 可切 treemap)  · 高度可拖拽 180-400px        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ 10:23 💰 经济 Fed 降息 50bp 市场反弹 3% · Reuters · [读] [★] [AI 摘要]  │
│ 09:15 💻 科技 OpenAI 发布 GPT-5.5 · TechCrunch · [读] [★] [AI 摘要]     │
│ 08:47 🏛 政治 欧盟碳边境税通过 · FT · [已读 ✓] [已收藏 ★] · [查看稿]   │
├─────────────────────────────────────────────────────────────────────────┤
│ [BOTTOM] ◄ Day 114   [ 🌅 END DAY ]   Day 116 ►   (按 Shift+Enter)     │
└─────────────────────────────────────────────────────────────────────────┘
```

**优点**:
- 地图最大 · 符合 GDELT / Dataminr 范式
- 左侧 XP 条可快速滤 topic
- 底部 feed 给"只想扫读不看地图"的场景
- 右侧详情可折叠 (无选中时隐藏)

**缺点**:
- 4 区域 · 信息密度高 · 需要打磨 spacing
- 手机端要整体重排

#### 方案 B · **Bloomberg 多面板 (可拖拽)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [TOP HUD]                                                                │
├───────────────────────┬──────────────────┬──────────────────────────────┤
│                       │                  │                              │
│   地图 (W · 40%)      │  时间线 (NE)     │  详情 (E · 25%)              │
│                       │  热度曲线        │  选中事件                    │
│                       ├──────────────────┤                              │
│                       │                  │                              │
│                       │  Feed 流 (SE)    │                              │
│                       │                  │                              │
└───────────────────────┴──────────────────┴──────────────────────────────┘
```

**优点**:
- 真 Bloomberg 风 · 每块可拖动
- 时间线给出"今天热度峰值"新维度

**缺点**:
- 学习成本高 · 新用户懵
- TZ 一个人用 · 不需要企业级可定制
- 开发成本翻倍 (react-grid-layout)

**判定**: Phase 3 可升级到 B · v1 先 A

#### 方案 C · **地图全屏 + 底部抽屉**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [TOP HUD]                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│                   地图 · 全屏                                            │
│                                                                         │
│                                                                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ▲ 拉起 feed drawer (默认 80px · 可拉到 500px)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**优点**: 地图震撼 · "国家地理"感最强 · 适合直播截屏

**缺点**:
- TZ 说"要高效" · 地图全屏反而浪费
- 11 topic XP 条没地方放
- feed 要先拉出来 · 多一步

**判定**: v2 "全屏演示模式" 可切换到 C · 默认用 A

### 5.2 推荐方案: A + 动态开关

默认: **方案 A**
可选: 按 `F` 全屏地图 (方案 C)
未来: Phase 3 升级多面板 (方案 B)

---

### 5.3 技术栈

| 层 | 选型 | 理由 |
|---|------|------|
| 地图渲染 | **react-simple-maps** (已装) + d3-geo + topojson | 已装 · 零依赖新增 · Equal Earth 支持 |
| 聚合算法 | **supercluster** (Mapbox 开源) | 业界标准 · 纯算法库 · 不绑死地图引擎 |
| 地图底图 | topojson world-110m (自带) + 国界线描白 | 轻量 · 无需 mapbox token |
| 状态 | 现有 zustand / React state | 沿用 |
| 时间处理 | date-fns (已装) | 沿用 |
| 字体 | Inter (UI) + Cormorant (End Day 归档) + JetBrains Mono (时间戳) | 已装 · 0 新增 |

**不装**:
- mapbox-gl (需 token · 超预算)
- leaflet (和 react-simple-maps 重复)
- react-hexgrid (v3 错误方向)
- honeycomb-grid (v3 错误方向)

### 5.4 色板 (Bloomberg 暗色终端风)

```css
/* 主色 · 终端暗色 */
--intel-bg-0:       #0a0e1a;  /* 最深 · body 底 */
--intel-bg-1:       #111725;  /* 第二层 · 面板 */
--intel-bg-2:       #1a2238;  /* 卡片 · 悬停 */
--intel-border:     #2a3550;  /* 分割线 */

/* 文字 */
--intel-text-hi:    #f0f4ff;  /* 标题 */
--intel-text:       #c0c8e0;  /* 正文 */
--intel-text-dim:   #6a7898;  /* 辅助 */
--intel-text-muted: #3a4868;  /* 已读 */

/* Bloomberg 状态色 · 继承金融终端 */
--intel-alert:      #ff9500;  /* 橙 · breaking / alert */
--intel-data:       #4a9eff;  /* 蓝 · 数据 / hyperlink */
--intel-up:         #00d494;  /* 绿 · 积极 / 上涨 */
--intel-down:       #ff5555;  /* 红 · 消极 / 下跌 */
--intel-neutral:    #a0a8c0;  /* 灰 · 中性 */

/* 11 Topic 色 · 暗底优化版 (继承 v3) */
--topic-politics:       #ff5555;
--topic-economy:        #ffb800;
--topic-tech:           #4a9eff;
--topic-philosophy:     #b77fff;
--topic-literature:     #d9a066;
--topic-society:        #a0c860;
--topic-entertainment:  #ff7fb8;
--topic-music:          #5fc0c0;
--topic-photography:    #d0d8e8;
--topic-esports:        #ff9955;
--topic-console:        #8870d0;

/* 归档仪式 · 仅 End Day 用 */
--archive-parchment: #d9c8a3;
--archive-ink:       #1a1410;
--archive-gold:      #c9a961;
```

### 5.5 组件清单 (v4 · 10 个)

| 组件 | 职责 | 对应 Civ 心法 |
|------|------|--------------|
| `IntelHUD` | 顶部 48px · Day / Era / Focus / 数字统计 | Turn + Era |
| `IntelLeaderBadge` | TZ 头像 + 头衔 Lv.2 Curator | Leader |
| `IntelTopicRail` | 左侧 11 topic XP 条 · 可点击筛选 | 资源 + Focus |
| `IntelWorldMap` | 主地图 · Equal Earth · 真国界 | Map |
| `IntelPin` | 单个 pin · topic 色 · 点击展开 | Tile |
| `IntelClusterPin` | 聚合 pin · 显示数字 + donut 分色 | Cluster |
| `IntelDetailPanel` | 右侧详情 · 标题/摘要/原文/收藏/bias | Unit info |
| `IntelFeedStream` | 底部 feed · list + treemap 切换 | News ticker |
| `IntelEndDayButton` | 右下角大按钮 · 归档仪式 | End Turn |
| `IntelArchiveOverlay` | 点 End Day 后的羊皮纸归档动画 | Turn transition |

**不再需要的 v3 组件**:
- ~~CivHexMap~~ (换 WorldMap)
- ~~CivHexTile~~ (换 Pin)
- ~~CivScrollBorder~~ (仅 End Day 用 · 内嵌到 ArchiveOverlay)
- ~~CivMetalBar~~ (换 BorderlessHUD)

### 5.6 数据 schema (v4 改动点)

```typescript
interface IntelEvent {
  id: string
  topic: Topic  // 11 enum
  title: string
  summary: string         // 3-5 句 · Phase 3 AI 生成
  source_url: string
  source_name: string
  source_bias?: 'left' | 'center' | 'right'  // Phase 2 · Lv 2 解锁
  published_at: string    // ISO
  location: {
    country: string       // "US" / "CN" / "JP"
    city?: string         // "New York"
    lat: number
    lng: number
  }
  severity: 1 | 2 | 3 | 4 | 5   // 1=常规 · 5=突发
  is_new: boolean         // 24h 内
  read: boolean
  saved_ep?: string       // "EP-12" · 收藏到某 EP Board
  screenshot_ready: boolean  // 是否已截图供 TK/IG 用
}

interface IntelDailyState {
  day: number             // Day 115
  date: string            // 2026-04-24
  focus_topics: Topic[]   // 最多 3
  stats: { new, read, saved, hot }
  era_level: 0|1|2|3|4|5  // 累计决定
  total_read_lifetime: number  // 驱动 Era 升级
}
```

### 5.7 交互关键点

| 交互 | 实现 |
|------|------|
| 地图 hover 国家 | 国界线高亮 · 显示国名 tooltip · 该国 topic 色块预览 |
| pin hover | 显示 title + topic 图标 · 不展开详情 (减少误触) |
| pin click | 右侧详情展开 · 地图中心平移到该 pin |
| cluster click | 缩放到 cluster 范围 + 散开 pin |
| left rail click | 过滤地图 pin · 只显示该 topic · 再点取消 |
| Focus 配置 | 左上 ⚡ 按钮 → 弹出 3 选模态 |
| feed 切换 list/treemap | 底部右上角 icon toggle |
| End Day | 右下大按钮 · 悬停脉冲 · 点击暗场 0.5s + 羊皮纸 1.5s + 翻页 0.5s |
| 快捷键 | `F` 全屏地图 · `J/K` feed 上下 · `E` 收藏到 EP · `Shift+Enter` End Day |

### 5.8 游戏化元素落点

| 元素 | 位置 | 频次 |
|------|------|------|
| Day 数字 | 顶 HUD 左 | 永久显示 |
| Era Lv | 顶 HUD 右 | 永久显示 · 升级时 2s 烟花 |
| Focus | 顶 HUD 中 · 每日晨会模态 | 每天 1 次选择 |
| Topic XP 条 | 左侧 rail · 每 topic 小进度 | 实时累积 |
| is_new 脉冲 | pin 上小红点 · 3s 慢脉冲 | 24h 内自动 |
| 收藏到 EP | 详情面板 ★ 按钮 | 按需 |
| End Day 按钮 | 右下角 · 22:00 后发光 | 每天 1 次 |
| 归档 markdown | 自动落 Obsidian | End Day 后 |
| 头衔解锁 | 右上 Badge | 升级时刷新 |

### 5.9 避坑清单继承 (v3 的 12 坑仍有效)

- [ ] 字体 min 14px · 支持缩放
- [ ] 顶 HUD 48px 封顶 (v3 是 56 · v4 减 8px)
- [ ] 通知最多 5 可见
- [ ] 严格三级层级
- [ ] 11 topic 色独立
- [ ] 桌面中等密度 / 移动放大
- [ ] 每 pin 独立 memo · 无全局重算
- [ ] 关闭按钮始终右上 · z-index 最高
- [ ] 不同视图 (feed/map/treemap) 色调区分
- [ ] Lucide + 自绘 SVG 统一线条
- [ ] 每 topic 一句话悬停提示
- [ ] 新事件脉冲小红点

### 5.10 与 v3 的差异总览 (一张表)

| 维度 | v3 | v4 |
|------|-----|-----|
| 主视图 | 六边形 hex grid | Equal Earth 真世界地图 |
| 美学主色 | 古金 + 钢蓝 + 羊皮纸 (Civ 全包) | Bloomberg 暗色终端 (主) + 羊皮纸 (仅归档) |
| 地图定位 | 几何抽象 | 真国界 + 国名 + lat/lng |
| pin | 六边形填色 | 真 SVG pin · supercluster 聚合 |
| HUD | 56px 金属条 + 铆钉 | 48px 无边框暗底 + 状态色高亮 |
| 通知面板 | 左侧卷轴堆叠 | **移除** · 合并进 feed + detail 面板 |
| 右面板 | 迷你图 + 科技树入口 + 外交 | **详情面板** · 点 pin 后展开 |
| Era 概念 | 固定 INFORMATION | 动态 Lv 0-5 · 按总阅读量升级 |
| Focus | 无 | **新增** · 每日 3 topic 选择 |
| End Day | 基础 (仅按钮) | **完整仪式** · 暗场+羊皮纸+归档 md |
| bias bar | 无 | **新增** (Lv 2 解锁) |
| AI 摘要 | Phase 3 考虑 | Phase 3 落地 (Lv 3 解锁) |
| 装饰元素 | 卷轴/金属/齿轮/宝石 | **极简** · 仅 End Day 用卷轴 |
| 字体用法 | Cormorant 做 UI | Cormorant 仅归档 · UI 全 Inter |

---

## 6 · 实施 Roadmap (Phase 1/2/3)

### Phase 1 · 真地图 + list feed (3-4h)

**目标**: 骨架跑起来 · 真地图出来 · 真新闻显示

**任务**:
1. 删除 v3 `src/components/civ/` 的 hex 相关 (保留色板 tokens)
2. 新建 `src/components/intel/` · 按 5.5 建 10 组件
3. 新建 `src/styles/intel.css` · 按 5.4 写 tokens
4. 装 `supercluster` (仅算法) · 不装 mapbox
5. 改 `src/app/internal/intel/page.tsx` · server · 读 `intel-events.json`
6. 地图用 react-simple-maps (已装) + Equal Earth topojson
7. 手工填 30 条真实 2026-04 新闻 · 11 topic 全覆盖 · 含 lat/lng
8. pin 点击 → 右侧详情面板展开
9. 底部 feed list · 按时间倒序 · 支持点击打开源
10. 顶部 HUD · Day / Era Lv.0 · 数字统计

**验收**:
- `/internal/intel` 打开显示 Equal Earth 世界地图
- 30 pin 按 lat/lng 分布全球
- 点 pin 能看详情 · 能跳源
- 底部 feed 能滚动
- 顶部显示 "Day 115 · 2026-04-24 · Lv.0 Newbie"

### Phase 2 · 游戏化层 (2-3h)

**目标**: Era 升级 / Focus / 收藏 EP / supercluster 聚合

**任务**:
1. 左侧 Topic Rail 实现 · 11 XP 条 · 可点击过滤
2. Focus 模态 · 每日晨会弹窗 · 选 3 topic
3. Focus 选中后 · pin 10% 放大 + feed 置顶
4. Era Lv 判定逻辑 · localStorage 持久化总阅读量
5. Lv 升级烟花动画 (canvas-confetti · 已装)
6. 收藏到 EP · 每条新闻 ★ → 选 EP Board
7. EP Board 管理页面 (次要 · 可先 localStorage)
8. supercluster 聚合 · 缩放时散开
9. cluster pin 样式 · donut 分色 + 中心数字
10. `F` 快捷键全屏地图 · `J/K` 上下 feed

**验收**:
- 每天第一次打开有 Focus 模态
- 选中 3 topic · pin 肉眼可见放大
- 读够 100 条升级到 Lv 1 · 看见烟花
- 纽约 5 条事件聚合成 1 个大 pin · 点开散开
- ★ 收藏能选 EP 归属

### Phase 3 · AI 摘要 + bias + 归档 (3-4h)

**目标**: End Day 完整仪式 · AI 摘要落地 · bias bar

**任务**:
1. End Day 按钮 22:00 后发光动效
2. 点 End Day → 全屏暗场 0.5s
3. 羊皮纸"今日简报"卡片浮现 · 统计数据 · AI 总结
4. 点 "Archive" → 生成 `intel-brief-2026-04-24.md` 落 Obsidian vault
5. markdown 模板: 日期 / 统计 / Top 3 topic / 收藏事件 / AI 结论
6. Claude API 接入 (已有 key) · 每事件 3 句摘要 (Lv 3 解锁)
7. bias 判定 · 硬编码一批 source→bias 映射 (Lv 2 解锁)
8. bias bar UI · 详情面板显示左/中/右小条
9. Day 翻页动画 · 数字 Flip 0.5s
10. 生成当日截图功能 · 右侧详情有"📷 截图" 按钮 · 导出 1080x1920 竖版 (TK/IG ready)

**验收**:
- 点 End Day 看到完整仪式 (暗场→羊皮纸→翻页)
- Obsidian vault 多一个 md 文件
- 每条新闻详情有 AI 摘要
- 有 bias 数据的源显示 bias bar
- 点"📷 截图"能直接下载竖版图 (TK ready)

### 预算 / 新增依赖

- `supercluster` (~15kb)
- `canvas-confetti` (已装 · v2 确认)
- **不装** mapbox / leaflet / 任何新地图 lib
- **不装** react-hexgrid / honeycomb-grid

### 风险与降级

| 风险 | 降级方案 |
|------|----------|
| Equal Earth topojson 加载慢 | fallback 到 react-simple-maps 自带 world-110m (Mercator) |
| supercluster 聚合在密集区卡 | 按 zoom 分级 · zoom<3 强聚合 · zoom>6 全散 |
| Claude API 超时 | AI 摘要做懒加载 · 点开详情才请求 · 缓存 7 天 |
| Obsidian 路径变动 | 从 `~/.openclaw/.env` 读 `OBSIDIAN_VAULT_PATH` · 配置可变 |
| End Day 动画在低性能机卡 | `prefers-reduced-motion` 判断 · 低性能机跳过羊皮纸动画 |

---

## 7 · Sources (真 URL · 12 条)

### 块 1 · 播客人/记者工具
- [Feedly Review 2026](https://socialrails.com/blog/feedly-review)
- [Best AI News Aggregators 2026 · Readless](https://www.readless.app/blog/best-ai-news-aggregators-2026)
- [Dataminr for News 官网](https://www.dataminr.com/products/dataminr-for-news/)
- [Dataminr 实战案例 · Media Copilot](https://mediacopilot.ai/patch-dataminr-breaking-news-local-newsroom/)
- [Inoreader 官网](https://www.inoreader.com/)
- [Briefing Agent · Creati.ai](https://creati.ai/ai-tools/briefing-agent/)
- [12 Tools for Journalists · Beyond Bylines](https://mediablog.prnewswire.com/2025/02/26/12-tools-for-journalists/)

### 块 2 · 真地图 + 新闻
- [Bloomberg Terminal UX Stories](https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity/)
- [Bloomberg Modern Icon](https://www.bloomberg.com/company/stories/innovating-a-modern-icon-how-bloomberg-keeps-the-terminal-cutting-edge/)
- [GDELT Project 官网](https://www.gdeltproject.org/)
- [GDELT Interactive Realtime Map](https://blog.gdeltproject.org/an-interactive-realtime-map-of-the-worlds-news/)
- [NewsMap.JS (newsmap.jp 继承者)](https://newsmap.ijmacd.com/)
- [LSEG Workspace (Reuters)](https://www.lseg.com/en/data-analytics/products/workspace)
- [Mapbox 官网](https://www.mapbox.com/)
- [Leaflet 官网](https://leafletjs.com/)
- [react-simple-maps Markers](https://www.react-simple-maps.io/docs/marker/)
- [Map Projection Compare](https://map-projections.net/compare.php?p1=mercator-84&p2=robinson)
- [Interactive Album of Map Projections](https://projections.mgis.psu.edu/)

### 块 3 · Civ 6 + 游戏化
- [Civilization VI Wikipedia](https://en.wikipedia.org/wiki/Civilization_VI)
- [Civ 6 Sid Meier UX Analysis · Medium](https://medium.com/vgux/civilization-6-108e91d3cfdb)
- [Streak Mechanism Gen Z News · Press Gazette](https://pressgazette.co.uk/news/streak-mechanism-key-gen-z-gamified-app-newsreel/)
- [Gamification in News Apps 2025 · Guul Games](https://guul.games/blog/gamification-in-news-apps-driving-engagement-habits-and-loyalty-2025)
- [Best Reading Apps Streaks Badges 2026](https://www.readbrew.app/blog/best-reading-apps-with-streaks-and-badges)
- [Productivity App Gamification · Trophy.so](https://trophy.so/blog/productivity-gamification-examples)

### 块 4 · 参考 + 灵感
- [Artifact App Wikipedia](https://en.wikipedia.org/wiki/Artifact_(app))
- [RIP Artifact: App Alternatives · BGR](https://www.bgr.com/tech/rip-artifact-2-app-alternatives-now-that-its-shutting-down/)
- [Flourish Studio](https://flourish.studio/)
- [10 Data Journalism Tools · Beyond Bylines](https://mediablog.prnewswire.com/2025/08/20/data-journalism-tools/)
- [Otter vs Descript 2026](https://thesoftwarescout.com/otter-ai-vs-descript-2026-which-ai-transcription-tool-wins/)

---

## 结语 · 给执行者 (主会话)

1. **v3 hex 是错的** · 先删后建 · 保留 v3 的色板 tokens + 避坑清单
2. **真地图用 Equal Earth** · react-simple-maps (已装) · 0 新增大依赖
3. **暗色是主 · 羊皮纸只给归档** · 不要混
4. **Civ 6 心法不是视觉** · Turn/XP/Era/Focus/End Day 是**机制** · 不是装饰
5. **Phase 1 做骨架** · Phase 2 做游戏化 · Phase 3 做 AI + 归档 · 按顺序不跳步
6. **End Day 是灵魂** · 比任何炫酷动画都重要 · 这是 TZ 每天的"下班按钮"
7. **手机端不是 v1 目标** · v1 先桌面 1440+ · 手机端 v2 再做
8. **数据先真** · 30 条手工 2026-04 真实新闻 · 比花哨 UI 重要 10 倍

总字数 · 约 3700 字
核心革命 · 从"Civ 6 字面复刻"到"Civ 6 心法 + Bloomberg 真地图终端"
成功标志 · TZ 每天主动打开这个页面 · 看 2 小时不累 · End Day 时有仪式感

完。
