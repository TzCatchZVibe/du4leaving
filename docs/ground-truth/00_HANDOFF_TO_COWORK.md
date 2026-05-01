---
title: CatchZVibe 独立站 · 项目完整打包 (给 cowork 做评估 + 迭代计划)
日期: 2026-04-29 (v2.0 接力同步)
session_id: czv-proud-hoare
作者: catchzvibe Claude Code
收件人: cowork Claude (TZ 在 cowork 那边的接续)
v2.0_status: ✅ cowork 已交付 KOZED 5 月项目全链路 v2.0 · 全部接住
---

## 🆕 v2.0 接力状态（2026-04-29 下午）

cowork 推送的 6 处颠覆性变更**全部已落地**到 ground-truth/。详见 `_CHANGELOG.md`。

新增结构（kozed/ + shoot-cards/ + personas/ + captions/ 4 个子目录），35 条脚本升级到 v2.0 schema（含 compliance_redlines 强制字段、HKRR 80+ 工程化、cozy_density、双层方法、shoot_session）。

**4 条 5/1 外景 ✅ FINAL v2.0** · 完整脚本/Frida 镜头清单/Freddy 提词卡已就绪 · Frida 5/1 周五可上。

**31 条 ⏳ rewrite_pending** · 等 cowork 5/2+ 推送。

下面 §1-§10 是 v1.0 全量打包，仍然是项目战略 ground truth。v2.0 增量见 `_CHANGELOG.md` + `kozed/` 子目录。

---

# 项目打包 · 完整上下文

## 0. TL;DR (30 秒版)

- **项目**: catchzvibe.studio · TZ 个人工作室独立站 · **对外品牌门面 + 对内工作台一体**
- **代码**: `~/catchzvibe/` · Next.js 16 + React 19 + Tailwind 4 + Supabase · v35.5 · 6 天 83 commits · 部署 Vercel
- **进度**: v1 约 25% · 框架完整 · 核心数据层就绪
- **当前状态**: 4-27 凌晨写完"诚实模式"PROJECT_STATUS.md → 4-29 全力切到 ground-truth 数据接入 (HG/Glimboo 真实业务)
- **卡点**: 3D 大堂路线失败回退 (v36 plan 已批准未完成 push) · /library /tools/recipe 半成品 · 业务方向刚切 Glimboo · 工作区一堆 xiapan 未 commit
- **想要 cowork 做的**: 基于本文档做战略评估 + 下一步 6-8 周迭代计划

---

## 1. 战略身份 (两层不要混淆)

### 1.1 CatchZVibe Studio · TZ 个人工作室

| 项 | 值 |
|---|---|
| 法律实体 | TZ 个人工作室 (独立) |
| 核心成员 | TZ (创始人/开发/策略) · Frida (内容/拍摄) · Hank (剪辑·国内) |
| IP 归属 | 所有自研工具 100% 归 CatchZVibe Studio · TZ 一人可带走 |
| 跟 HG 关系 | HG 是客户 (agency) · 不是雇主 · 合作可终止 |

### 1.2 Happy Global (HG) · 我们的客户

| 项 | 值 |
|---|---|
| 业务模式 | agency · 自有 + 合作品牌的电商代运营 |
| TZ 在 HG 汇报 | **Sarah** (Online Sales 线 · 同时管 Product/Purchasing + 🔴 Emotional Consumer Company + Independent Website) |
| Frida 在 HG 汇报 | Ranny (Marketing > Designing) |
| Hank | 不进 HG 汇报 |
| TZ 个人目标 | 抢 HG **Future Content Lead** (新岗位 · 跨线 Content Lead) |

### 1.3 HG 旗下品牌矩阵 (2026-04-29 更新)

```
HG 全资品牌:
  🔥 Glimboo       → 未来主品牌 (6/15+ 正式量产)
  CandyMaster     → 旧测试品牌 (5/底-6/15 过渡用)
  MunchyBear      → // TODO 补
  Crisup          → // TODO 补

合作品牌:
  PulseOn         → 能量饮料
  KOZED           → 软糖 (4/底-5/底 主推 · 35 条脚本已就绪)
```

### 1.4 关键对应关系

- **Sarah 管的「Emotional Consumer Company」 = Glimboo 项目**
- Glimboo 的成败 = TZ 在 HG 内部争 Content Lead 岗位的关键战役

---

## 2. 7 账号矩阵 + 三阶段切换

### 2.1 7 个账号 (CatchZVibe Studio 代运营)

| # | Handle | 平台 | 归属品牌 | 三阶段切换 |
|---|---|---|---|---|
| 1 | **@happyglobalschoice** | TK | HG · 主战场 | 🔄 KOZED → CandyMaster → **Glimboo** |
| 2 | **@happyglobalsnacks** | TK | HG | 🔄 其他零食 → 6/15 后接收 CandyMaster |
| 3 | @us_happyglobal | TK | HG | PR / 不变 |
| 4 | @pulseon.us | TK | PulseOn | 电商 / 不变 |
| 5 | @pulseon.energy.drink | TK | PulseOn | PR / 不变 |
| 6 | @happyglobal_inc | IG | HG | PR / 不变 |
| 7 | @pulseon_energy_drink | IG | PulseOn | PR / 不变 |

合计 5 TK + 2 IG = **7 账号** · 周产能 **15-20 条/周**

### 2.2 三阶段账号切换 (TZ 2026-04-29 拍板)

```
阶段       时间          Choice 号                snacks 号                工作室主战场
──────────────────────────────────────────────────────────────────────────────
🟡 窗口期  4月底-5月底    KOZED (软糖主推)          其他零食                  KOZED 内容
🟠 过渡期  5月底-6/15     CandyMaster (音乐棒棒糖)  其他零食                  CandyMaster 内容
🟢 正式期  6/15+         🔥 Glimboo (主品牌)       其他零食 + CandyMaster   Glimboo 内容
```

---

## 3. Glimboo 品牌 DNA (新主品牌)

| 项 | 值 |
|---|---|
| 品牌名 | **Glimboo** = Glimmer (微光) + Boo · 糖果乌托邦 (原名 Meloboo · v1.1 改名) |
| 主 Slogan | **A Sweet Escape** (一场甜蜜的逃离) |
| 中文专属 | Glimboo — 藏在日常里的小秘密 |
| 三系列 | Glim (骨传导音乐棒棒糖+NFC) · Art (3D/4D/5D 艺术) · Chew (软糖) |
| 人群 | 16-35 岁女性 · "内心住着小女孩，但追求力量感与自我" |
| 类比 | 旺卡 (Wonka 2023) + 小马宝莉 |
| 视觉 | 主色 魔法紫 · 活力橙 · 叛逆粉  /  辅 暗夜黑 · 奶油白 · 香槟金 |
| 设计原则 | "甜美但不幼稚 · 治愈但有棱角 · 魔幻但接地气" |
| APP | Glimboo Land (NFC 桥梁 · 解锁音乐+积分) |
| 价格 | $5 - $30 美元 |
| 渠道 | 线下便利店/CVS/Target + TikTok Shop + 独立站 |
| 商标 | 🟢 低风险 · USPTO 直接冲突 0 · 通过率 85%+ · glimboo.com 待抢注 |
| 时间表 | 5/15 (1.0 出货 CandyMaster 名义) → 5/15-22 (Logo VI 交付) → 6/15 (Glimboo 量产) → 6/底 (2.0 测完) |

**风险**: 米凯迪供应链危机 · 草莓款融化率 71% · 货补 $182 万 · 13 项测试问题报告 (GLM-MKD-QA-2026-001)

---

## 4. 当下 35 条 KOZED 脚本 (cowork 已交付)

- **总数 35** (Choice 22 + Snacks 13)
- **2026-04-29 锁定**: 全部由 **Freddy** 出镜重新拍
- **新角色 Aurora** (搞怪胖胖亚裔同事/达人 BD): #06 #16 #25
- **5 条防御视频** (A/B Hook): #04 #12 #17 #22 #30
- **6 条建议付费推**: #16 #25 #28 #30 #34 #35
- **三类脚本结构**: 7 条 ASMR / 10 条室内主口播 / 14 条新创意
- **5 种 Hook 类型**: A 反差 / B 价值感 / C ASMR / D 反应 / E 情境
- **campaign**: `may-2026-cleanout` (5 月特例集 · 6 月归档)
- **完整 schema**: 15 个字段 (id/account/release_date/release_window_et/sku_primary/intent/intent_subtype/hook_type/hook_line/selling_points/shot_requirements/duration_seconds/featured_persona/ab_variant/paid_promotion_recommended)

**逐字稿源**: `~/Library/Application Support/Claude/local-agent-mode-sessions/.../KOZED_May2026/` (10 份 md)

---

## 5. 独立站代码现状

### 5.1 项目基本信息

| 项 | 值 |
|---|---|
| 路径 | `/Users/happyglobal_tk_team/catchzvibe` |
| 框架 | **Next.js 16.2.4** (App Router) ⚠ 不是常见 Next.js · 有 breaking changes · 写代码前查 `node_modules/next/dist/docs/` |
| React | 19.2.4 (Compiler ready) |
| 样式 | Tailwind v4 (`@theme inline`) + Motion (Framer) |
| 数据库 | **Supabase** Postgres (ref: `cguncazbdeiwdjhhtyud`) · RLS 已修 |
| Storage | Supabase Storage `assets` bucket · 50MB · jpg/png/webp/mp4/mov |
| Auth | Supabase auth · iron-session · 3 黄金会员 (tz/fri/hank @ catchzvibe.studio) |
| 部署 | Vercel `prj_jpJPe2w8VIbO4O1Aph19vk0waigg` · 域名 catchzvibe.studio |
| 创建 | 2026-04-21 (6 天 · 83 commits · 当前 v35.5) |

### 5.2 已建页面 (对外 + 对内)

```
src/app/
├── (对外)
│   ├── /              主页
│   ├── /about         公会理念 + 3 成员
│   ├── /portfolio     作品集
│   ├── /services      服务范围
│   ├── /booking       预约 (表单存在但未接后端)
│   ├── /[slug]        摄影师子站 (tz/fri/hank)
│   ├── /wholesale     素材批发
│   └── /launch        Keynote 发布会 (拟人主持 Zee + 30 slide)
├── /login             Supabase auth 已接通
├── /internal (对内 · 9 房间)
│   ├── /dashboard     ⚠ 3D 大堂 · v35.x 路线失败 · v36 plan 已批准未 push
│   ├── /intel         战图厅 (TZ 日常用 · 真生效)
│   ├── /library       素材库 · 框架完成 · 缺 6 字段打标 UI
│   ├── /library/triage    分流
│   ├── /library/split/[id] 拆分
│   ├── /learn         学习中心
│   ├── /chat          团队聊天
│   ├── /tools/recipe  菜谱 (读本地 JSON · 不接 DB)
│   ├── /tools/import  导素材
│   ├── /tools/publish 发布
│   ├── /tools/monitor 监控 (全 mock)
│   ├── /xiapan        ⚠ 金融预测 (新方向 · 未 commit)
│   └── /cart          购物车
├── /xiapan + /xiapan-preview   外部应用
└── /api (40+ 路由)
    ├── /intel/*       媒体爬取 / 地理 / TechCrunch / arxiv
    ├── /xiapan/*      Kalshi / Riot Games
    ├── /bunny/*       视频处理
    └── /ai/*          标签建议
```

### 5.3 Supabase 表 (8 张 · 7 migration)

| 表 | 用途 | 状态 |
|---|---|---|
| `profiles` | 用户扩展 (3 黄金会员) | ✅ |
| `clips` | 素材库 (真在用) | ⚠ 需要加 `brand` 字段 (Glimboo/KOZED/PulseOn/HappyGlobal) |
| `wiki_pages` | 学习中心 | ✅ |
| `recipe_runs` | 菜谱执行记录 | 半成品 |
| `wholesale_orders` | 批发订单 | 半成品 |
| `publish_queue` | 发布队列 | 简单接通 |
| `shopping_carts` (00004) | 配 Bunny | ✅ |
| `chat_messages` (00007) | 团队聊天 | ✅ |

### 5.4 关键资产 (43 菜谱 + 16 海报变体)

- `src/data/recipes/all-active.ts` · 43 菜谱
- `src/data/intel-rss-feeds.ts` · 信息源配置
- `src/data/docs/` · 投流学院 7500 字
- `docs/产品全景图_v1.md` · 13 章 · 4 类用户 · 6 福利 · 7 HG 账号

### 5.5 视觉风格 (已锁不要动)

- **MUJI 日系实木暖色** 为主基调 (v30+ 锁定)
- 三层手写字体: ZCOOL XiaoWei / LXGW WenKai / Ma Shan Zheng
- 4 角浮层 + 底部 1-8 Dock (像 Mac Dock + Minecraft hotbar)
- BGM 音乐台 (M 键 · YouTube IFrame · 50+ 真曲)
- DALL-E 3 头像生成 (动森风)
- 中英双语 i18n
- 8 房间命名: 大堂/战图厅/仓库/工坊/邮政/监控塔/图书馆/素材库

---

## 6. 当前卡点 (诚实模式)

### 🔴 P0 · 必须先解决

#### 6.1 /internal/dashboard 大堂状态混乱

v25-v35 走过的弯路:
- v25-v28: 第三人称走动 + FPS · TZ "粗糙·不顺"
- v30-v31: MUJI 实木 + 8 栋楼开放世界 · 视觉 OK 但走动手感差
- v35.1-v35.3: ecctrl + rapier 真物理 · TZ "无法移动+一直坠落"
- v35.5: 紧急回退手写 controller · TZ "还是太粗糙"

**根本原因**: 真 3D 物理 (ecctrl + rapier + GLTF + Mixamo) 是需要专业 3D 工程师调几周的活 · Claude Code 这种 AI 调试盲改做不好。

**已批准方案** (`~/.claude/plans/twinkling-sprouting-elephant.md`):
- 砍 ecctrl + rapier (彻底卸 npm)
- 改 OrbitControls 顶视 City Skylines 风
- 加 RPG 面板 T/I/C/G (2D 数据驱动 UI)
- 加 NPC walker 装饰 (简单 lerp · 无物理)

**v36 plan 当前状态** (4 panel 已写未 push):
- ✅ `panel-context.tsx` 已建 (T/I/C/K/G/J 快捷键)
- ✅ `quest-panel.tsx` `inventory-panel.tsx` `character-panel.tsx` `guild-panel.tsx` 全部已建
- ✅ `hall-scene-3d.tsx` 改了 +247/-135 (未 commit)
- ✅ `internal-shell.tsx` 加 5 行 PanelProvider (未 commit)
- ❌ ecctrl/rapier 还在 package.json (待卸)
- ❌ 全部未 commit + 未 push

#### 6.2 Vercel 自动部署偶发失败

push 后 webhook 有时不触发 · 历史 v33 v34 v35 都需要手动 `vercel --prod --yes` + `vercel alias set ... catchzvibe.studio`

### 🟡 P1 · 用户反复抱怨

| 问题 | 出现次数 | 状态 |
|---|---|---|
| "操作手感粗糙·不跟手" | 5+ | 永远没让 TZ 满意 |
| "建筑太粗糙" | 3 | 后续要 GLTF 资产 |
| "移动太慢" | 3 | 速度从 5.5 → 11 → 22 → Shift 70 m/s · 仍说"效率低" |
| "做不好就承认" | 1 | TZ 4-27 直接问"是不是超出你能力" · 我承认了 |

### 🟠 P2 · 半成品

| 模块 | 状态 |
|---|---|
| `/booking` | 表单存在 · 不连后端 |
| `monitor` | 全 mock |
| `recipe` | 读本地 JSON · 不接 DB |
| `learn/wiki` | 表存在 · 内容稀疏 |
| `publish` | 接通但功能简单 |

### 🟢 真生效 · 不要动

- 战图厅 `/internal/intel` (TZ 日常用)
- 素材库 `/internal/library` (clips 表 + Bunny)
- BGM 音乐台 (M 键 · YouTube · 50+ 曲)
- DALL-E 头像生成 API
- 中英双语 i18n
- /launch 发布会 keynote

### 🟣 工作区脏 · 一堆未 commit

```
M  src/components/dashboard/hall-scene-3d.tsx     (v36 panel 改动)
M  src/components/internal-shell.tsx              (v36 PanelProvider 接入)
?? src/app/api/xiapan/                            (新方向 · 金融预测)
?? src/app/internal/xiapan/
?? src/app/xiapan/
?? src/app/xiapan-preview/
?? src/components/panels/                         (v36 4 panel 全部)
?? src/components/xiapan/
?? src/lib/quests/                                (v36 接单系统)
?? src/lib/xiapan/
?? scripts/xiapan-*.mjs (8 个)
?? supabase/migrations/00008_xiapan_init.sql
?? public/du4leaving/                             (PWA · 看起来另一个产品)
?? PROJECT_STATUS.md                              (4-27 写的现状报告)
?? vercel.json
```

---

## 7. ground-truth 数据 (今晚刚落地)

`~/catchzvibe/docs/ground-truth/` (本次 session 新建):

| 文件 | 内容 |
|---|---|
| `公司身份.md` | HG 全资 Glimboo · CatchZVibe Studio 两层身份 · 品牌矩阵 |
| `业务客户.md` | 7 账号 · 三阶段切换 · KOZED 窗口期 · 达人精细化策略 |
| `glimboo转型路线图.md` | 5-7 月时间线 · 米凯迪 $182 万危机 · 13 项测试问题 |
| `glimboo品牌dna.md` | 完整 v1.1 (旺卡+小马宝莉 · 三系列 · 魔法紫) |
| `glimboo协作人.md` | 11 人协作圈 + 内容出镜人 (Freddy/Aurora/brother-in-law) |
| `团队Glimboo分工.md` | TZ + Frida + Hank 全员上 · TZ 统筹 |
| `kozed脚本库.md` 🆕 | 35 条全表 · 15 字段 schema · A/B + 付费推标记 |

**待补 (TODO)**:
- [ ] `personas/freddy.md` (cowork 提供 01_Freddy_Persona_Manual.md)
- [ ] `personas/aurora.md` (cowork 提供 04_Aurora_Persona_Addon.md)
- [ ] 5 条防御 A/B Hook 完整版 (cowork 提供 09_AB_Hooks_Defense.md)
- [ ] 35 条 caption + hashtag 完整版 (cowork 提供)
- [ ] is-this-scam DM 截图 (TZ 提供 · 阻塞 #22)
- [ ] KOZED 折扣机制具体数字 (TZ 提供 · 阻塞全部 CTA)
- [ ] MunchyBear / Crisup 详情 (TZ 补)
- [ ] Frida / Hank 在 Glimboo 项目周时间分配 (TZ 补)
- [ ] 工作室对 Glimboo 服务费/分成模式 (TZ 补)

---

## 8. 下一步路线 (3 阶段 · 来自 plan 文件)

### Phase A · ground-truth 数据 (✅ 90% 完成)
等 cowork 补 personas + A/B + captions

### Phase B · 全域影响矩阵 (待启动)

| 数据块 | 对外 | 对内 | Supabase | 关键组件 | 真实数据怎么用 |
|---|---|---|---|---|---|
| ① 公司身份 | /about | /internal/dashboard | brand_settings(新?) | layout.tsx | 待 TZ 补 |
| ② 业务·客户 | /wholesale /services | /internal/tools/publish /intel | brands(新) wholesale_orders | wholesale/page | Glimboo 客户档案 · 5-7月时间线 · 米凯迪危机标 |
| ③ 团队 | /[slug] | /internal/dashboard | profiles | character-panel · [slug]/page | 加 Glimboo 协作人档案 (11 人) |
| ④ 素材·产品 | /portfolio | /internal/library /tools/recipe /learn | clips(加 brand) recipe_runs wiki_pages | library/grid · recipe/[id] · tag-editor | clips 加 brand 字段 (4 值) · 35 条进 recipe_runs · campaign=may-2026-cleanout · Glimboo DNA 进 wiki |

**关键洞察**:
- `clips` 表必须加 `brand` 字段 (旧 schema 没考虑多品牌切换)
- `/internal/library` 6 字段打标 UI 要新增 brand 下拉 (KOZED/Glimboo/CandyMaster/PulseOn)
- `/internal/tools/recipe` 应按品牌+campaign 分组
- `/wholesale` 应有"客户档案 + 项目时间线"视图
- 素材库可加"内容方向"标签 (按 KOZED 4 项动作)

### Phase C · v36 plan 收尾 (Phase B 完成后回归)

1. `cd ~/catchzvibe && npm uninstall ecctrl @react-three/rapier`
2. `npx tsc --noEmit` 跑通 hall-scene-3d.tsx 的 +247/-135 改动
3. 浏览器本地验证 (preview_start → preview_click 按 T/I/C/G)
4. `git commit -m "v36.0 · 砍真物理 · 顶视 OrbitControls + RPG 4 panel"` + push
5. Vercel 自动部署 (如未触发 → 手动)
6. 线上访问 `https://catchzvibe.studio/internal/dashboard` 二次验证

### 后续 (HANDOFF.md 4-22 写的 6-10 周计划)

- Week 3-4: `/library` 真功能 (6 字段打标 + filter + AI 自动标签 Qwen3-VL)
- Week 5-6: `/tools/recipe` 接 Supabase (从 clips 筛 → 拖 slot → 导 EDL)
- Week 7-8: `/learn` 自建 wiki (TipTap + Meilisearch)
- Week 8-9: `/intel` 文明 6 dashboard (Apify 数据 · 世界地图 · 技术树)
- Week 9: `/[slug]` 自动化 (从 profiles 表自动生成子站)
- Week 10: 打磨上线 catchzvibe.studio

---

## 9. 用户偏好 (TZ 协作风格)

### 9.1 沟通

- ≤3 行决定一次
- ADHD/INFP · 一次一个决定 · 提供上下文
- 全可视化沟通 · 表格/卡片/ASCII 图/视觉层级 · **禁止大段文字**
- 选择题 ABC · 不要开放问题
- 中文文件命名 (GenZ 风)

### 9.2 工作哲学

- **当前阶段 (2026-04-21 起)**: **系统优先** > 发内容 (覆盖之前的"发内容>工具"规则)
- 苏格拉底+奥卡姆思维 · 问 1-2 个就动手
- "最短路径 · 不要过度建设工具"
- AI 月度预算 $150-200 (Claude Max $100 + hive agents $50-100) · 不默认用 Sonnet
- 双写策略: Notion 给 TZ 看 + Obsidian 给 AI 团队读

### 9.3 砍过的方向 (不要复活)

- ❌ 等级系统 BRONZE/SILVER/GOLD
- ❌ 真 3D FPS / 第一人称走动
- ❌ Synthwave Tron 黑底霓虹 (大堂用 · 砍)
- ❌ 极乐迪斯科风油画 (做不出 · TZ 也认了)
- ❌ ecctrl + rapier (4-22 到 4-27 失败)

### 9.4 已锁决策不要推翻

| 决策 | 状态 |
|---|---|
| MUJI 日系实木暖色 | 锁 |
| 三层手写字体 | 锁 |
| 中英双语 i18n | 锁 |
| BGM YouTube IFrame · 50+ 真曲 | 锁 |
| 4 角浮层 + 底部 1-8 Dock | 锁 |
| DALL-E 3 头像生成 | 锁 |
| 8 房间命名 | 锁 |
| 战图厅核心功能 (飞机/海洋/晨昏/事件光柱/LiveFeed) | 锁 |
| 公会 MMO + 妖精尾巴接单模式 | 锁 |
| 砍 ecctrl + rapier · 改 OrbitControls 顶视 | 锁 |
| 主持人 Zee (DALL-E AI 化身) 用在 /launch | 锁 |

---

## 10. 给 cowork 的请求

请基于本文档 (从 §1 到 §9 全部)，做这两件事：

### 10.1 战略评估
- 这套架构 (catchzvibe.studio = 对外品牌 + 对内工作台一体) 在当前 Glimboo 转型背景下 **是否仍然成立**?
- "**系统优先 > 发内容**" 这个规则在 Glimboo 6/15 上线倒计时下 **要不要重新校准**?
- v36 (3D 大堂 → 顶视 RPG) 这条路 **值不值得继续投入**? 还是应该冻结大堂 · 把资源全压到 /library /tools/recipe 这些真业务功能上?
- HG 7 账号 + 三阶段切换 + 35 条 KOZED + 即将到来的 Glimboo 主品牌内容 — 独立站现有结构 **能否承接**? 缺什么?

### 10.2 下一步 6-8 周迭代计划
请输出一份按周拆分的 plan，回答:
- 哪些功能必须 ship (按 Glimboo 6/15 上线倒推)
- 哪些功能可以延后 (or 直接砍)
- Supabase schema 改动清单 (clips 表加 brand 字段是必做 · 还有哪些?)
- 每周一个 deliverable (TZ ADHD · 需要短反馈循环)
- 风险清单 (cowork 视角看到的 · 跟 §6 已知卡点不同的)

输出格式偏好:
- Markdown 表格 + 卡片
- 每周一行 · deliverable + 验收标准 + 阻塞依赖
- ≤2000 字 · TZ 要扫读

---

## 附录 · 关键文件路径

```
代码仓库:
  ~/catchzvibe/

ground-truth 数据 (今晚新建):
  ~/catchzvibe/docs/ground-truth/00_HANDOFF_TO_COWORK.md  ← 本文件
  ~/catchzvibe/docs/ground-truth/公司身份.md
  ~/catchzvibe/docs/ground-truth/业务客户.md
  ~/catchzvibe/docs/ground-truth/glimboo转型路线图.md
  ~/catchzvibe/docs/ground-truth/glimboo品牌dna.md
  ~/catchzvibe/docs/ground-truth/glimboo协作人.md
  ~/catchzvibe/docs/ground-truth/团队Glimboo分工.md
  ~/catchzvibe/docs/ground-truth/kozed脚本库.md

历史文档:
  ~/catchzvibe/PROJECT_STATUS.md           4-27 凌晨写的诚实模式报告 (604 行)
  ~/catchzvibe/HANDOFF.md                  4-22 写的接续指南
  ~/catchzvibe/docs/产品全景图_v1.md       13 章产品全景
  ~/catchzvibe/docs/design_manifesto_v20.md  设计宣言
  ~/catchzvibe/docs/guild_mmo_worldview_v1.md  公会 MMO 世界观

v36 plan:
  ~/.claude/plans/twinkling-sprouting-elephant.md  已批准未完成

本次 session plan:
  ~/.claude/plans/czv-proud-hoare.md       Phase A 数据接入 plan

cowork 那边的 KOZED 脚本源:
  ~/Library/Application Support/Claude/local-agent-mode-sessions/
    fab0b431-bcef-45fa-b791-0f556879e3c0/
    d85e5047-b264-45af-a30a-d05e0aa554c0/
    local_3b3696c1-c93a-49af-8bef-b3ebc02012cd/outputs/KOZED_May2026/
    ├── 00_README.md
    ├── 01_Freddy_Persona_Manual.md
    ├── 02_Content_Matrix_v1.md
    ├── 03_Shoot_List_v1.md
    ├── 04_Aurora_Persona_Addon.md
    ├── 05_Scripts_Batch1_W1W2.md   (#01-11)
    ├── 06_Scripts_Batch2_W3.md     (#12-19)
    ├── 07_Scripts_Batch3_W4.md     (#20-27)
    ├── 08_Scripts_Batch4_W5.md     (#28-35)
    └── 09_AB_Hooks_Defense.md      (5 防御 A/B + 投流)

历史记忆 (Claude memory):
  /Users/happyglobal_tk_team/.claude/projects/-Users-happyglobal-tk-team/memory/
    project_catchzvibe_独立站架构.md
    project_hg_client_detail.md
    project_team_structure.md
    project_catchz_studio_工作台.md
    feedback_系统优先.md
    feedback_工具归属规则.md
    user_aesthetic_profile.md
    user_tz_cognitive_profile.md
```
