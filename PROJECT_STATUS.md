# CatchZVibe Studio · 项目现状报告

> 写给下一个 Claude (Claude.ai) 做战略对齐 · 2026-04-27 由 Claude Code 扫描整库后写
> **诚实模式 · 不美化** · 这份报告的目的不是给老板看 · 是给同行交接

---

## 1. 项目基本信息

| 项 | 值 |
|---|---|
| **名称** | CatchZVibe Studio (`catchzvibe`) |
| **路径** | `/Users/happyglobal_tk_team/catchzvibe` |
| **创建时间** | 2026-04-21 (今天是 2026-04-27 · 6 天) |
| **最近修改** | 2026-04-26 22:18 |
| **当前分支** | `main` |
| **Vercel** | `prj_jpJPe2w8VIbO4O1Aph19vk0waigg` · `tomouzs-projects/catchzvibe` |
| **生产域名** | `catchzvibe.studio` |
| **总 commits** | 83 (6 天 · 平均日均 14 commits · 高强度迭代) |
| **首次 commit** | `34fa4a9` · 2026-04-21 18:10 |

### 最近 5 次 commit

```
ba95ab2  v35.5 · 紧急回退 · 砍 ecctrl/rapier (无法工作) · 用手写 controller + 保留质感升级
f229fb9  v35.4 · 网游质感升级第一波 · HDRI + Bloom + 4000 草叶 + 浮云
0c55c93  v35.3 · 一次到位 · 修一出生坠落 · 物理生效
450251c  v35.2 · 修一出生坠落 · 地板加厚到 2m + 出生 y=3 + floatHeight 0.35
c0d619f  v35.1 · ecctrl + rapier 真实物理控制器接入 · 3A 跳跑碰撞
```

**信号 · v35.x 一连 5 个 commit 都在修 3D 物理 · 然后回退**。这是 3D 物理路线失败的真实痕迹 · 看 §8。

---

## 2. 技术栈

### 前端

| 技术 | 版本 | 状态 |
|------|------|-----|
| Next.js | `16.2.4` | App Router · server + client components |
| React | `19.2.4` | 最新 · React Compiler ready |
| TypeScript | `^5` | strict 默认 |
| Tailwind CSS | `^4` | 新 v4 · `@theme inline` |
| Motion (Framer) | `^12.38.0` | 全站动画 |

### 3D / 游戏化 (⚠ 部分要砍)

| 技术 | 版本 | 状态 |
|------|------|-----|
| three | `^0.184.0` | ✅ 留 (战图厅地球 · 大堂场景) |
| @react-three/fiber | `^9.6.0` | ✅ 留 |
| @react-three/drei | `^10.7.7` | ✅ 留 (OrbitControls / Sky / Environment) |
| @react-three/postprocessing | `^3.0.4` | ✅ 留 (Bloom / SSAO / Vignette) |
| @react-three/rapier | `^2.2.0` | ❌ **砍** (物理调试失败) |
| ecctrl | `^1.0.97` | ❌ **砍** (第三人称控制器 TZ 报告无法移动+掉落) |

### 后端 / 数据

| 技术 | 用途 |
|------|------|
| Supabase | auth + Postgres + RLS + Storage |
| @supabase/ssr | App Router server client |
| swr | 客户端数据缓存 |
| OpenAI API | DALL-E 3 头像 + GPT-4o-mini 翻译/改写 |
| Bunny Stream | 视频 CDN (素材库 + clips) |
| YouTube IFrame API | BGM 播放 |

### 部署

- **Vercel · Production** · `catchzvibe.studio`
- 自动部署不稳 · 多次需要手动 `vercel --prod --yes` (历史: v33 v34 v35 push 后 webhook 没触发 · 手动重发)
- 自动 alias 域名

### 主要 Lib

```
react-simple-maps      战图厅 2D 世界地图
d3-geo                 投影 + centroid
recharts               监控塔图表
lucide-react           图标
cmdk                   ⌘K 命令面板
motion (framer-motion) 全站动画
hls.js                 视频流
tus-js-client          大文件上传 (Bunny)
react-markdown + remark-gfm  Wiki 渲染
```

---

## 3. 目录结构 (3 层 · 忽略 node_modules / .next / .git)

```
catchzvibe/
├── docs/                       (22 份 markdown · 设计宣言 · 研究报告 · SOP)
├── public/                     (静态资源)
├── scripts/                    (一次性脚本)
├── src/
│   ├── app/
│   │   ├── api/                (28 routes · 大多数 intel/*)
│   │   ├── booking/            (外部 · 客户预约)
│   │   ├── launch/             (发布会 keynote · 30 张 slide)
│   │   ├── login/
│   │   ├── about/
│   │   ├── portfolio/
│   │   ├── services/
│   │   ├── wholesale/
│   │   ├── [slug]/             (动态页)
│   │   ├── actions/            (server actions)
│   │   └── internal/           (会员区 · 8 房间)
│   ├── components/
│   │   ├── intel/              (战图厅 · 飞机 · 海洋 · LiveFeed · dossier · 大量)
│   │   ├── dashboard/          (大堂 · 3D scene · GameDock · QuestPanel)
│   │   ├── panels/             (T/I/C/G RPG 面板 · v36 新)
│   │   ├── bgm/                (M 键音乐台 · 灵动岛)
│   │   ├── game/               (4 角浮层 · GameOverlay)
│   │   ├── home/               (外部首页)
│   │   ├── library/            (素材库 cart)
│   │   ├── publish/            (发布)
│   │   ├── monitor/            (数据)
│   │   ├── triage/             (素材分类)
│   │   └── profile/            (化身面板)
│   ├── data/
│   │   ├── recipes/            (菜谱 JSON)
│   │   ├── docs/               (Wiki seed)
│   │   ├── monitor-mock.ts     (假数据)
│   │   ├── intel-pins.json     (intel seed pins)
│   │   ├── intel-rss-feeds.ts  (RSS 源白名单 · 25+)
│   │   ├── intel-sources-v10.json
│   │   └── world-cities-major.json
│   ├── hooks/
│   ├── lib/
│   │   ├── i18n/               (中英双语 dict + provider)
│   │   ├── bgm/                (BGM context)
│   │   ├── quests/             (接单类型 + mock · v36 新)
│   │   ├── supabase/           (server / client / middleware)
│   │   └── db/                 (DB helpers)
│   └── types/
└── supabase/
    └── migrations/             (7 个 sql 文件)
```

### 文件规模

```
src/components/dashboard/hall-scene-3d.tsx  ~1900 行 (最大单文件 · 大堂 + 仿真楼 + NPC)
src/components/intel/intel-world-map.tsx    ~900 行 (战图厅地图 · 飞机 + 海洋 + 光柱)
src/app/launch/keynote-client.tsx           ~700 行 (30 张 slide 发布会)
```

---

## 4. 已实现功能清单

### 外部站 (公开访问)

| 路由 | 程度 | 评 |
|------|------|---|
| `/` | ✅ 真在跑 | 首页 · HeroVideo + WorksGrid + PhotographerTrio |
| `/about` | ✅ 真在跑 | 团队介绍 |
| `/portfolio` | ✅ 真在跑 | 作品集 |
| `/services` | ✅ 真在跑 | 服务清单 |
| `/wholesale` | ✅ 真在跑 | B2B 批发素材 |
| `/booking` | ⚠ 仅静态 | 客户预约表单 · **没有真后端 · 表单提交未连 quests 表** |
| `/launch` | ✅ 真在跑 | 30 张 slide 发布会 keynote · DALL-E 主持 Zee · BGM 自启 |
| `/[slug]` | ✅ 真在跑 | 动态页 |
| `/login` | ✅ 真在跑 | Supabase auth |

### 内部 8 房间 (会员区)

| 路由 | 程度 | 评 |
|------|------|---|
| `/internal/dashboard` | ⚠ **大坑** | 当前是 3D 大堂 · v35.x 走过 ecctrl 物理失败 · v35.5 回退到手写 controller · 状态混乱 · 需要按 v36 plan 重做为 OrbitControls 顶视 |
| `/internal/intel` | ✅ **真核心** | 战图厅 · GDELT/RSS 34 源真数据 · OpenSky 实时飞机 · 海洋粒子 · 晨昏分界 · LiveFeed · DALL-E 头像 · 事件光柱 · MorningRead |
| `/internal/intel/clips` | ⚠ 半成品 | 素材剪辑选择 |
| `/internal/library` | ✅ 真在跑 | 素材库 grid · Supabase clips 真表 · Bunny CDN 接通 |
| `/internal/library/triage` | ✅ 真在跑 | AI 自动打标签 (suggest-tags API) |
| `/internal/library/split/[id]` | ✅ 真在跑 | 子片段切分 |
| `/internal/learn` | ⚠ 半成品 | Wiki 列表 · 框架在 · `wiki_pages` 表存在 · 但内容稀疏 |
| `/internal/learn/[slug]` | ✅ 真在跑 | Wiki 详情页 |
| `/internal/learn/new` | ✅ 真在跑 | Wiki 编辑 |
| `/internal/chat` | ✅ 真在跑 | 公会聊天 · 4 channels (general/choice/snacks/pr) · `chat_messages` 真表 |
| `/internal/cart` | ✅ 真在跑 | 购物车 · `shopping_carts` 真表 |
| `/internal/tools/recipe` | ⚠ 半成品 | 菜谱列表 · 读本地 `data/recipes/_registry.json` · **不接 DB** |
| `/internal/tools/recipe/[id]` | ⚠ 半成品 | 菜谱详情 |
| `/internal/tools/monitor` | ❌ **全 mock** | 数据看板 · `MONITOR_MOCK` seed · 无真数据 · UI 完整 |
| `/internal/tools/publish` | ⚠ 半成品 | 发布列表 · `publish_queue` 表存在 · 接通但功能简单 |
| `/internal/tools/publish/new` | ⚠ 半成品 | 新发布表单 |
| `/internal/tools/import` | ✅ 真在跑 | 大文件 tus 上传 |

### API 路由 (28 个)

✅ **真生效·有商业价值**
- `/api/intel/voice-avatar` · DALL-E 3 动森风半身像 · 60min in-memory cache
- `/api/intel/rewrite-title` · GPT-4o-mini 5W+context 标题重写
- `/api/intel/rss-batch` · 25 源并发拉取 (BBC/Reuters/NYT/财新/澎湃...)
- `/api/intel/gdelt` · 全球事件 GDELT v2 真接入
- `/api/intel/flights` · OpenSky 实时飞机 60s 刷新
- `/api/intel/event-image` · og:image 多 fallback (Wikipedia + scrape)
- `/api/intel/all` · 聚合 9 源 · 主战图厅源
- `/api/intel/hackernews` · `/techcrunch` · `/theverge` · `/arstechnica` · `/media-cn` · `/podcasts-cn` · `/github-trending` · `/polymarket` · `/usgs` · `/nasa-firms` · `/influencers`
- `/api/ai/suggest-tags` · 素材自动打标
- `/api/bunny/create-video` + `/api/bunny/video-status/[guid]` · Bunny Stream

⚠ **存在但不常用**
- `/api/intel/translate-title` · 已被 rewrite-title 覆盖
- `/api/intel/extract` (Jina Reader) · `/api/intel/deep` · `/api/intel/entities` · `/api/intel/place-history` · `/api/intel/person-ctx` · `/api/intel/ai-brief`

❌ **未做**
- 接单 API (quests CRUD) · 完全没建 · v36 plan 里规划

### 跨页面 Feature

| Feature | 程度 | 触发 |
|---------|------|---|
| 中英双语 | ✅ 真生效 | 50+ 词条 · `LanguageProvider` 全站 · 右上角切换按钮 |
| BGM 音乐台 | ✅ 真生效 | M 键开 · 9 分类 · YouTube IFrame · 50+ 真曲 (Nujabes/Re:plus/Hans Zimmer/Joe Hisaishi/Kendrick) |
| BGM 灵动岛 | ✅ 真生效 | intel 顶部胶囊 · 点击展开控件 |
| GameDock | ✅ 真生效 | 底部 1-8 数字键直达 8 房间 · Mac Dock 放大效果 |
| GameOverlay 4 角 | ✅ 真生效 | ↖ 回大堂 / ↗ 语言+登出 / ↙ 化身 / ↘ BGM mini |
| ProfilePanel 化身 | ✅ 真生效 | DALL-E 头像 + 自定义称号 + 在线状态 (mock) |
| Quest 面板 (v36 新) | ⚠ Mock | T 键开 · 4 列看板 · 12 个假任务 |
| Inventory 面板 (v36 新) | ⚠ Mock | I 键开 · 8×6 grid · 15 个假素材 |
| Character 面板 (v36 新) | ⚠ Mock | C 键开 · 化身+经验+等级 · 数据全假 |
| Guild 面板 (v36 新) | ⚠ Mock | G 键开 · 5 公会成员 · 全假 |

---

## 5. 数据库 / 数据结构

### Supabase Postgres · 7 个 migration · 8 个表

#### 1. `profiles` (用户扩展)
```
id uuid (auth.users)
email · display_name · role · handle · avatar_url · bio
cities text[]
last_changelog_seen_at timestamptz
```
`role enum` = bronze / silver / gold / hg_employee / admin
**注 · TZ 后期说"砍等级" · 但 enum 还在 DB 里 · 没改**

#### 2. `clips` (素材库 · 真在用)
```
id · filename · duration_sec · width · height · camera · shoot_time
transcript · proxy_url · thumb_url · original_url
category enum (口播/采访/反应/产品/手部/Logo/展位/人群/转场/废)
sub_category text[] · brand · participant text[]
duration_bucket enum (micro/short/mid/long/xlong)
quality enum (A/B/C)
uses text[] · assigned_recipes jsonb
notes · tags text[]
created_by uuid → profiles
```
**6 字段标签 · 索引齐全 · 支持 GIN tags 搜索**

#### 3. `wiki_pages`
```
id · slug · title · content_md · category · tags · author_id · version
```

#### 4. `recipe_runs`
```
recipe_id (string · 如 "C-03") · variant_id · target_account
filled_slots jsonb · status enum (draft/in_progress/exported/published)
exported_edl_url · exported_zip_url · caption_variants jsonb
```

#### 5. `wholesale_orders`
```
hg_employee_email · hg_employee_name · cart_clip_ids uuid[]
status enum (pending/approved/packaged/delivered/rejected)
zip_url · reviewed_by · delivered_at
```

#### 6. `publish_queue`
看 migration 自查

#### 7. `shopping_carts` (00004 · 配 Bunny)
```
user_id · clip_ids uuid[]
```

#### 8. `chat_messages` (00007)
```
channel · user_id · text · created_at
```

### 假数据位置 (mock)

| 文件 | 用途 |
|------|------|
| `src/data/monitor-mock.ts` | 监控塔账号数据 (5 账号 · 关注/转化趋势) |
| `src/data/intel-pins.json` | intel 静态 pin (主真实数据走 GDELT/RSS) |
| `src/data/recipes/_registry.json` | 16 个菜谱 ID + 元数据 |
| `src/data/world-cities-major.json` | 战图厅城市坐标 |
| `src/lib/quests/mock.ts` | **v36 新** · 12 个假任务 (Quest 面板用) |

---

## 6. 视觉风格现状

### 主色调 (`globals.css`)

```
基底 · MUJI 暖纸
  --color-paper       #f1ebdc  暖纸色 · 米基底
  --color-paper-bright #f7f2e6  高光纸
  --color-paper-deep   #e8dfc7  阴影纸

文字 · 墨色
  --color-ink       #111111  墨黑 · 主文字
  --color-ink-soft  #2a2a2a  次文字
  --color-ink-dim   #6a6052  弱文字

Accent · Rodchenko 红 (构成主义)
  --color-red       #c1272d
  --color-red-deep  #8a1c22
  --color-amber     #d89937  琥珀
  --color-sage      #6a8a6e  鼠尾草

intel 战图厅独立色板 · 12 色金铜 + 钢蓝
  --intel-gold      #c9a961
  --intel-alert     #8b2e2e
  --intel-data      #3c5a7a
```

### 字体 (Google Fonts + CDN)

```
英文 · Inter (display) · Cormorant Garamond (serif) · JetBrains Mono · VT323 (复古像素)
中文衬线 · Noto Serif SC
中文正文 · Noto Sans SC
手写 3 层 (TZ 核心要求 · 每层用途分明) ·
  L1 OS 框架  ZCOOL XiaoWei            楷书工整   sidebar / 菜单
  L2 地图层   LXGW WenKai (CDN)        手工楷体   国名 / 城名
  L3 新闻表达 Ma Shan Zheng            毛笔表达   标题 / 引语
  备用       Long Cang                 大字标识
```

### Logo / 吉祥物

- **Logo** · 文字 LOGO `CATCHZVIBE` (大字 + ·INT· 后缀) · 没有图标 logo
- **Orbie 吉祥物** · ❌ TZ 在 memory 里提过 · 但**代码里没做**。圆球龙虾形象只在 doc/memory 里描述
- 实际"吉祥物"位 · 战图厅角色用 DALL-E 生成的 ZEE (AI 主持人 · 用在 /launch keynote) · 不是固定 mascot

### 整体风格关键词

```
✓ MUJI 日系实木暖色 (主基调 · TZ 反复要求)
✓ 手写手绘 (三层手写体 · SVG feTurbulence 颤抖 filter)
✓ 鸟瞰世界 (战图厅地图 + 飞机 + 海洋 + 晨昏)
✓ 复古未来主义 (BGM 音乐台紫粉霓虹 · 与主基调 contrast)
✓ 沉浸 RPG 公会 (T/I/C/G 面板 · 妖精尾巴风)

✗ 已砍 · Synthwave Tron (TZ 说不喜欢)
✗ 已砍 · 真 3D FPS / 第三人称走动 (我做不好 · TZ 报 bug)
```

---

## 7. 当前能跑的入口

### 本地启动

```bash
cd /Users/happyglobal_tk_team/catchzvibe
npm run dev
# → http://localhost:3000
```

### 必需环境变量 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

OPENAI_API_KEY=sk-...                   # DALL-E 头像 + GPT-4o-mini

BUNNY_STREAM_API_KEY=...                 # 视频 CDN (素材库)
BUNNY_STREAM_LIBRARY_ID=...
NEXT_PUBLIC_BUNNY_LIBRARY_ID=...
NEXT_PUBLIC_BUNNY_CDN_HOSTNAME=...

NASA_FIRMS_KEY=...                       # 火点数据 (可选)
```

### 主要访问 URL

```
catchzvibe.studio                        外站首页
catchzvibe.studio/launch                 发布会 keynote (30 slide · BGM · DALL-E 主持)
catchzvibe.studio/internal/dashboard     公会大堂 (⚠ 当前 3D 状态混乱 · v36 重做中)
catchzvibe.studio/internal/intel         ★ 战图厅 (核心功能 · 真数据 · 飞机+海洋+光柱)
catchzvibe.studio/internal/library       素材库 (Supabase + Bunny)
catchzvibe.studio/internal/chat          公会聊天 (Supabase realtime ?)
```

### 测试账号

未列在 doc 里 · 走 Supabase auth 注册即可。

### 快捷键

```
M       BGM 音乐台 (Spotify 风)
1-8     底部 Dock 直达 8 房间
T       任务板 (v36 新 · mock)
I       背包 (v36 新 · mock)
C       角色卡 (v36 新 · 真 DALL-E 头像 + 假经验数据)
G       公会面板 (v36 新 · mock)
ESC     回大堂 / 关面板
```

---

## 8. 已知问题 / 卡点

### 🔴 P0 · 必须先解决

#### 1. `/internal/dashboard` 大堂状态混乱
**v35.x 这一周走过的弯路**:
- v25-v28 · 第三人称走动 + 第一人称 FPS · TZ 反馈"粗糙·不顺"
- v30-v31 · MUJI 实木 + 8 栋楼开放世界 · 视觉 OK 但走动手感差
- v35.1 · 接 `ecctrl` + `@react-three/rapier` 真物理 · TZ 报"无法移动+一直坠落"
- v35.2-v35.3 · 多次修 collider · 还是不工作
- v35.5 · 紧急回退到手写 controller · 但 TZ 说"还是太粗糙"

**根本原因**: 真 3D 物理 (ecctrl + rapier + GLTF + Mixamo) 是需要专业 3D 工程师调几周的活 · Claude Code 这种 AI 调试盲改 (看不到屏幕 / 没有 fps 数据 / 不能 iterate 真机) · 做不好。

**已批准的解决方案** · 见 `.claude/plans/twinkling-sprouting-elephant.md`:
- 砍 `ecctrl` + `rapier` (彻底卸 npm)
- 改 `OrbitControls` 顶视 City Skylines 风 (不可走动 · 拖动 + 缩放)
- 加 RPG 面板 T/I/C/G (我擅长的 2D 数据驱动 UI)
- 加 NPC walker 在城里游走 (装饰 · 简单 lerp · 无物理)

**v36 plan 已在执行** · 第一波 commit 还没 push (Phase 1 · 见 §10)。

#### 2. Vercel 自动部署偶发失败
push 后 webhook 有时不触发 · 历史 v33 v34 v35 都需要手动 `vercel --prod --yes` 重发 · 且需要手动 `vercel alias set ... catchzvibe.studio`。

### 🟡 P1 · 用户反复抱怨的

| 问题 | 出现次数 | 状态 |
|------|---------|------|
| "操作手感粗糙·不跟手" | 5+ | 永远没让 TZ 满意 · 因为本质是真 3D 物理调优 (Claude 不擅长) |
| "建筑太粗糙" | 3 | v35.0 升级仿真 (60 mesh/楼) · TZ 反馈"还是不够" · 后续要 GLTF 资产 |
| "移动太慢" | 3 | 速度从 5.5 → 11 → 22 → Shift 70 m/s · TZ 仍说"效率低" |
| "做不好就承认" | 1 (今晚) | TZ 直接问"是不是超出你能力" · 我承认了 · 见 §10 |

### 🟠 P2 · 半成品

| 模块 | 状态 |
|------|------|
| `/booking` | 表单存在 · 提交不连后端 |
| `monitor` | 全 mock 数据 · UI 完整 |
| `recipe` | 读本地 JSON · 不接 DB |
| `learn/wiki` | 表存在 · 内容稀疏 |
| `publish` | 接通但功能简单 |

### 🟢 真生效 · 高价值 · 不要动

- 战图厅 `/internal/intel` (TZ 日常用)
- 素材库 `/internal/library` (clips 表 + Bunny)
- BGM 音乐台 (M 键 · YouTube · 50+ 曲)
- DALL-E 头像生成 API
- 中英双语 i18n
- /launch 发布会 keynote

---

## 9. 未完成但已规划

### 代码里 · 没有 `// TODO` 注释 (查过)

### 已建空文件但没实现

```
src/lib/i18n/index.ts  4 行 · 是 barrel export · OK
```
其他都有内容。

### plan 文件里规划但没做的 (`.claude/plans/twinkling-sprouting-elephant.md`)

```
Phase 1 (本周) · 视角校准 + RPG UI · 进行中 (已写但未 push)
Phase 2 (下周) · 接单后端 · Supabase quests/quest_submissions/quest_ratings 表 · 未建
Phase 3 (下下周) · NPC 城市生气 · 时间昼夜 · 信使飞机
Phase 4 (后续) · RPG 反馈 · 经验/等级/技能树 K 键 · 通知中心
```

### 文档里 (`docs/`)

- `MASTER_TASK_LIST.md` · 主任务清单
- `电商自营号转型战略_2026Q2.md` · 业务战略
- `下一版迭代总方案_v2.md` · 迭代方案
- `素材管理系统_MAM研究.md` · 素材系统调研
- `tradeshow多维剪辑_SOP.md` · 拍摄 SOP

---

## 10. 给下一个 AI 的交接建议

### 🚨 这个项目最容易踩的坑

1. **TZ 喜欢游戏化 · 但不要做真 3D 走动**
   - TZ 真实需求 · "RPG 信息管理 + 城市天际线俯视 + 接单平台"
   - **不是** · 第一/三人称走动 + 真物理
   - 我已经在 v25-v35 这条路上撞了 11 个版本 · 全失败 · TZ 最后说"超出能力"
   - **你来接手 · 别再走 ecctrl/rapier 这条路**

2. **TZ 节奏极快 · 一晚上抛 20+ 指令 · 别什么都接**
   - 先用 ASCII 表格回应 · 让他选 ABC
   - 别"给惊喜不问意见" · 大方向他必须 buy in (我栽过)

3. **TZ 砍过的方向 · 不要复活**
   - ❌ 等级系统 BRONZE/SILVER/GOLD
   - ❌ 真 3D FPS / 第一人称走动
   - ❌ Synthwave Tron 黑底霓虹 (大堂用 · 砍 · 但 BGM 音乐台保留)
   - ❌ 极乐迪斯科风油画 (我做不出 · TZ 也认了)
   - ❌ ecctrl + rapier (这周这条路全失败)

4. **TZ 的"全可视化沟通" 偏好**
   - 用 ASCII 表格 / 卡片 / 视觉层级
   - **禁止大段文字**
   - ≤3 行决定一次

5. **TZ 是 ADHD/INFP**
   - 一次一个决定
   - 提供上下文
   - 选择题 ABC · 不要开放

### 📍 哪些文件最重要 · 必须先读

```
1. .claude/plans/twinkling-sprouting-elephant.md  v36 已批准的方向 · 必读
2. docs/design_manifesto_v20.md                   设计宣言 · 三大根基
3. docs/guild_mmo_worldview_v1.md                 公会 MMO 世界观
4. src/components/dashboard/hall-scene-3d.tsx     大堂 (1900 行 · 当前要重做)
5. src/components/intel/intel-world-map.tsx       战图厅地图 (核心 · 别动)
6. src/lib/i18n/dict.ts                           中英双语 50+ 词条
7. src/lib/quests/types.ts + mock.ts              v36 接单系统 (Phase 2 接 DB)
8. src/components/internal-shell.tsx              全局壳 · 4 角浮层 + Dock 挂载点
9. supabase/migrations/00001_initial_schema.sql   8 张表 schema
```

### ✅ 已定的决策 · 不要推翻

| 决策 | 何时定的 | 状态 |
|------|---------|------|
| MUJI 日系实木暖色为主基调 | v30 | 锁 |
| 三层手写字体 (ZCOOL XiaoWei / LXGW WenKai / Ma Shan Zheng) | v19 | 锁 |
| 中英双语 i18n | v19 | 锁 |
| BGM YouTube IFrame · 50+ 真曲 | v22-v32 | 锁 |
| 4 角浮层 + 底部 1-8 Dock | v26-v31 | 锁 |
| DALL-E 3 头像生成 (动森风) | v23 | 锁 |
| 8 房间命名 (大堂/战图厅/仓库/工坊/邮政/监控塔/图书馆/素材库) | v21 | 锁 |
| 战图厅核心功能 (飞机/海洋/晨昏/事件光柱/LiveFeed) | v20-v34 | 锁 |
| 公会 MMO + 妖精尾巴接单模式 (商业核心) | v33 keynote | 锁 |
| 砍 ecctrl + rapier · 改 OrbitControls 顶视 (City Skylines) | v36 plan | 锁 |
| 主持人 Zee (DALL-E AI 化身) 用在 /launch | v33 | 锁 |

### 🎯 下一步必做 (按顺序)

1. **Push 当前 v36 进度** · panel-context + 4 panels 已写 · 还没 push
2. **`npm uninstall ecctrl @react-three/rapier`** · 减包体积
3. **`hall-scene-3d.tsx` 大砍** · 移除 ThirdPersonController · 改 OrbitControls
4. **internal-shell 接 PanelProvider + 4 panels** · 让 T/I/C/G 真触发
5. **tsc + commit + vercel deploy** · 这个版本应该真能跑
6. **Phase 2 接单后端** · `supabase/migrations/00008_quests.sql` + `/api/quests/*`
7. **`/booking` 接通真后端** (现在是死表单)

### 💡 最重要的洞察 (TZ 今晚说的)

> **"游戏化的思路还是不变 · 是因为我喜欢 RPG 游戏里的管理信息的方式以及城市天际线和游戏里
> 带给我沉浸停不下来的感觉以及接单平台"**

这是 v36 plan 的全部源头。**别忘**:
- 城市天际线 = 顶视沉浸 · 不是 GTA 走动
- RPG 信息管理 = 任务/背包/角色面板 · 不是真 3D 角色
- 接单平台 = 商业核心 · 客户/摄影师/公会三方

### ⚠ 别误解的事

1. **"游戏化"不等于"做游戏"** · TZ 要的是工作平台 + 游戏感 · 不是 MMO 引擎
2. **"沉浸"不等于"3D 走动"** · 装饰沉浸 (BGM + 视觉 + 时间昼夜 + NPC 装饰) 足够
3. **"细腻"不等于"真实"** · 程序生成 + 后处理 (Bloom/SSAO/HDRI) 是 Claude 强项 · 别追 RDR2 (web 做不到)
4. **"摄影师公会"是商业核心** · 别一直做 3D · 真业务功能 (接单/分成/评价) 才是赚钱的

---

## 一句话总结

```
6 天 83 commits · 战图厅 + 素材库 + BGM + DALL-E 头像 是真资产 ·
3D 走动大堂这条路撞了一周失败了 · v36 plan 改顶视 + RPG 面板 + 接单平台 ·
这才是 Claude 能 ship 的方向 · 也是 TZ 真正要的。
```

> 报告位置 · `/Users/happyglobal_tk_team/catchzvibe/PROJECT_STATUS.md`
> 写于 · 2026-04-27 凌晨 · 由 Claude Code (做了 v19-v35) 扫库后写
> 给 · Claude.ai (下一棒) 做战略对齐
