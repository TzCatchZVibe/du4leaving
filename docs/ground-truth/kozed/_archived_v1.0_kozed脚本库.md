---
source: cowork Claude (TZ 在 cowork 里写的 KOZED May 2026 完整脚本库)
日期: 2026-04-29
session_id: czv-proud-hoare
原文件路径: ~/Library/Application Support/Claude/local-agent-mode-sessions/fab0b431-bcef-45fa-b791-0f556879e3c0/d85e5047-b264-45af-a30a-d05e0aa554c0/local_3b3696c1-c93a-49af-8bef-b3ebc02012cd/outputs/KOZED_May2026/
campaign: may-2026-cleanout
brand: KOZED
total: 35 (Choice 22 + Snacks 13)
---

# KOZED 脚本库 · 2026 年 5 月（35 条）

## 关键对齐（cowork 同步）

- **总数 35**（不是最初说的 32）· Choice **22** + Snacks **13**
- **2026-04-29 最新指令**：全部由 **Freddy 出镜**重新拍
- "内容方向"字段映射 → "主导向 / 附属类型"双标签：
  - 二次剪辑 → **7 条** ASMR / B-roll 剪辑（出自拍摄 S3）
  - 翻拍 → **10 条** 室内主口播（出自 S1，参考过去 Freddy 脚本结构）
  - 再创作 → **14 条** 新创意（Aurora 系列 + 防御 + 节庆）
  - **35 条全部出单导向**
- **Aurora 是新角色**（TZ 4/29 锁定 · 搞怪胖胖亚裔同事/达人 BD）· 出现在 #06 #16 #25
- **平台**：35 条全部 TikTok 主（Choice 号 / Snacks 号）· 同条可二剪发 IG Reels
- **5 条防御视频**有 A/B Hook：#04 #12 #17 #22 #30 → 完整 A/B 在 `09_AB_Hooks_Defense.md`

## 推荐 schema 字段（已应用到下表）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 1-35 |
| `account` | enum | Choice / Snacks |
| `release_date` | date (ISO 8601) | |
| `release_window_et` | string | ET 时段 |
| `sku_primary` | string | 主推单品 |
| `intent` | enum | defense / offense |
| `intent_subtype` | enum | 二次剪辑 / 翻拍 / 再创作 |
| `hook_type` | enum | A 反差 / B 价值感 / C ASMR / D 反应 / E 情境 |
| `hook_line` | string | 英文台词 |
| `selling_points` | string[] | |
| `shot_requirements` | string | |
| `duration_seconds` | int | |
| `featured_persona` | enum | Freddy / Freddy+Aurora / Freddy+Friend / 仅手部 |
| `ab_variant` | bool | true 仅 #04 #12 #17 #22 #30 |
| `paid_promotion_recommended` | bool | true 仅 #16 #25 #28 #30 #34 #35 |

## 35 条完整列表

| # | 账号 | 日期 | 时段 ET | SKU | 主/附 | Hook 类型 | Hook 台词 | 核心卖点 | 镜头需求 | 时长 |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | Choice | 5/1 Fri | 19:00-21:00 | 7-Flavor Mix | 翻拍/出单 | A 反差金句 | "I'm 38 years old. And I just figured out how to eat candy." | 三段式体验(剥-嚼-双纹理)+独立小包+Aurora 软背书 | S1 室内布景 A 正面中景 + S3 剥皮特写 A1+独立小包 C1 | 30s |
| 02 | Snacks | 5/2 Sat | 20:00-22:00 | Mango | 二次剪辑/出单 | C ASMR | (无台词,字幕"Volume up.") | 双色芒果剥皮+撕膜声+视觉冲击 | S3 ASMR-1 专用机位 240fps+收音麦干净 | 22s |
| 03 | Choice | 5/3 Sun | 18:00-20:00 | 7-Flavor Mix | 再创作/出单 | E 情境(车里) | "I'm hiding in my car. Eating candy. I'm not even sorry." | 便携不化(手套箱)+Halal+独立包装 | S2 外出场景 D 车里独食下午 4-5 点柔光 | 35s |
| 04 | Choice | 5/4 Mon | 12:00-14:00 | 7-Flavor Mix | 再创作/防御 | B 价值感袒露 | "Someone said you don't get many. Let me show you EVERY piece." | 反驳"份量少"差评+独立包装真实展示+逐颗摆开数 | S1 布景 A + S3 C1 俯拍 7 口味独立小包+真实评论截图道具 | 45s |
| 05 | Snacks | 5/5 Tue | 19:00-21:00 | Strawberry | 翻拍/出单 | A 反差 | "My wife told me to stop buying these. I did not listen." | 真草莓味(非红色素)+Cinco de Mayo 隐性蹭+反差金句 | S1 布景 B 沙发近距+套 3 灰针织 | 25s |
| 06 | Choice | 5/6 Wed | 13:00-15:00 | 7-Flavor Mix | 再创作/出单 | D 同事盲测 | "This is Aurora. She works on creator partnerships. Tries more candy in a week than I do in a year." | **Aurora 首登**+专家盲测+猜对 6/7 真实反应 | S1 室内办公场景双机位+Aurora 米白针织+眼罩道具 | 50s |
| 07 | Snacks | 5/7 Thu | 20:00-22:00 | Lychee | 二次剪辑/出单 | C ASMR+一句口播 | (字幕"Lychee. Listen.") + Freddy 旁白"smells like summer's coming" | 荔枝独特花果香+夏日氛围+ASMR | S3 ASMR-2 慢动作剥皮+侧光 | 22s |
| 08 | Choice | 5/8 Fri | 12:00-14:00 | 7-Flavor Mix | 再创作/出单 | E 情境(办公桌) | "What's in my desk drawer at work — and why my coworkers keep stealing." | 办公室零食+不化不粘键盘+Aurora 偷拿背书 | S1 布景 C 办公桌+抽屉内多袋摆放+Aurora 偷拿 3 秒补镜(在 #06 当天补) | 35s |
| 09 | Choice | 5/9 Sat | 14:00-16:00 | 7-Flavor Mix | 再创作/防御 | B 价值感(克数对比) | "I'm tired of this. Let me settle it." | 反驳"小份量"+iPhone/可乐罐尺寸对比+诚实陈述 | S1 布景 A + S3 C5 尺寸对比镜头+iPhone+可乐易拉罐道具 | 40s |
| 10 | Snacks | 5/10 Sun | 11:00-13:00 | Mango | 翻拍/出单 | A 反差 | "I'm not a candy guy. But this mango one made me Google 'how mangoes are made'." | Mother's Day 自我犒赏(完全规避喂妈/喂孩)+双色拟真+22 秒疗愈 | S1 布景 B 沙发+套 2 米色亨利衫 | 30s |
| 11 | Choice | 5/10 Sun | 19:00-21:00 | 7-Flavor Mix | 再创作/出单 | D Freddy 自盲测 | "I made fun of Aurora for getting one wrong. Now it's my turn." | 与 #06 形成迷你连续剧+Freddy 输给 Aurora 反差+真实猜测 | S1 布景 A + S3 剥好的 7 颗道具+眼罩 | 30s |
| 12 | Choice | 5/11 Mon | 13:00-15:00 | 7-Flavor Mix(逐口味) | 再创作/防御 | B 防御(塑料感) | "Someone said these taste like plastic. Respectfully — let me prove you wrong." | 反驳 @therealray26 "taste like plastic"+逐口味试+真果味+不可证伪 | S1 布景 A + 7 口味各 1 颗剥好排开特写 | 45s |
| 13 | Snacks | 5/12 Tue | 20:00-22:00 | White Peach | 二次剪辑/出单 | C ASMR | (字幕"white peach. no music.") | 双层撕膜节奏感+疗愈+静默美学 | S3 ASMR-3 双层撕膜:外袋+独立包+俯拍 | 25s |
| 14 | Choice | 5/13 Wed | 17:00-19:00 | 7-Flavor Mix | 再创作/出单 | E 情境(便利店) | "Okay. I'm here for batteries. I'm not buying candy. ...okay I'm buying candy." | 冲动购买叙事+便利店货架可见+不化便携 | S2 场景 C 便利店内景 or 店外手持+套 4 黑 T+衬衫罩+提前问店家 | 40s |
| 15 | Snacks | 5/14 Thu | 20:00-22:00 | Grape | 翻拍/出单 | A 反差 | "Real talk. I think this purple one is dangerous." | 真葡萄味(非药水味)+上瘾警告反向种草 | S1 布景 B 沙发+套 4 黑 T | 30s |
| 16 | Choice | 5/15 Fri | 12:00-14:00 | 7-Flavor Mix | 再创作/出单 | D 同事推荐链路 | "Have you tried these yet?" Aurora 反向推荐 | **Aurora 第二登场**+行业内行背书+男女搭档化学反应+白桃推荐 | S1 办公桌+咖啡角+Aurora 米色 T+围巾+双人同框 | 50s |
| 17 | Choice | 5/16 Sat | 14:00-16:00 | 7-Flavor Mix | 再创作/防御 | B Halal 认证 | "If Halal matters to you — listen up." | Halal 社群精准触达+鱼明胶+包装认证可视化(不说 no pork) | S1 布景 A + S3 C6 Halal logo 大特写+配料表特写 | 40s |
| 18 | Snacks | 5/17 Sun | 21:00-23:00 | Strawberry | 二次剪辑/出单 | C ASMR 诗意 | 字幕"8 hours of work." → "10 seconds of this." | 工作日疗愈+短而美+情绪价值 | S3 ASMR-4 草莓款+8h vs 10s 诗意结构 | 25s |
| 19 | Choice | 5/17 Sun | 19:00-21:00 | Mango | 翻拍/出单 | A 反差 | "My therapist said I should find a hobby. I peel these now." | 治愈/疗愈类比+22 秒无屏幕+夸张反讽 | S1 布景 A+套 3 灰针织 | 30s |
| 20 | Choice | 5/18 Mon | 18:00-20:00 | 14-Flavor 大装 | 再创作/出单 | E 情境(厨房) | "If you're hosting Memorial Day weekend — listen up." | Memorial Day 前一周预热+派对零食+不化适合户外+大装价值感 | S1 布景 D 厨房中岛+大理石+玻璃碗+套 3 | 40s |
| 21 | Snacks | 5/19 Tue | 20:00-22:00 | 单口味 3-pack | 再创作/出单 | D 闭眼挑战 | "I bet I can rank these by smell alone. Don't tell Aurora." | 香味强度+挑战格式高完播+人设趣味 | S1 布景 B 沙发+套 4 黑 T+7 颗剥好的糖排列 | 35s |
| 22 | Choice | 5/20 Wed | 13:00-15:00 | 7-Flavor Mix | 再创作/防御 | B 拆箱实证 | "Someone DM'd me this last week. Fair question. Let me show you." | 反驳"is this scam"+真实 DM 截图+完整开箱+US-based 品牌信任 | S1 布景 A + S3 C4 整袋滚出+真实"is this scam"截图道具(待 TZ 提供) | 45s |
| 23 | Choice | 5/21 Thu | 20:00-22:00 | Mango | 二次剪辑/出单 | C ASMR | 字幕"the best 22 seconds of your day." | Choice 号试水 ASMR+双色芒果+疗愈广告化 | S3 ASMR-1 复用+新加慢镜+黑底字幕 | 25s |
| 24 | Snacks | 5/22 Fri | 17:00-19:00 | 7-Flavor Mix | 再创作/出单 | A 反差(车后箱) | "Friday. I'm hiding behind my truck eating candy." | Friday 情绪+反差 Goofy(Hawaii 衬衫+严肃语气)+不化适合户外 | S2 场景 E 户外车后箱+套 6 Hawaii 衬衫+太阳眼镜 | 30s |
| 25 | Choice | 5/23 Sat | 19:00-21:00 | Grapefruit(让 Aurora 试新口味) | 再创作/出单 | D 一镜到底反应 | "I sent her one. She didn't say anything for 30 seconds. Watch." | **Aurora 第三登场**+一镜到底+5 秒安静=信任天花板+真情流露 | ⚠️ S1 布景 A 办公桌+一镜到底+Aurora 浅灰针织+耳环+不切镜头中段 | 50s |
| 26 | Snacks | 5/24 Sun | 11:00-13:00 | Lychee | 翻拍/出单 | E 情境(Sunday Reset) | "Sunday reset. One window. One snack. That's it." | 极简疗愈+独食仪式感+Sunday 情绪 | S1 布景 B 窗边沙发+柔光+套 5 居家圆领 | 30s |
| 27 | Choice | 5/24 Sun | 19:00-21:00 | 7-Flavor Mix | 再创作/出单 | A 反差(元梗) | "I tried to write a script for this video. Couldn't. The candy spoke for itself." | 懒人脚本反讽+B-roll 自证+真诚反差 | S1 布景 A+套 4 黑 T+空白纸+笔道具 | 35s |
| 28 | Choice | 5/25 Mon | 11:00-13:00 | 14-Flavor 大装 | 再创作/出单 | E 情境(Memorial Day 户外) | "Memorial Day weekend. Cookouts. Family. Sun. Boring chips. Don't be the boring chip guy." | Memorial Day 正日+户外野餐+不化+派对零食差异化(直接复刻参考图) | S2 场景 A 公园野餐桌(参考 TZ 给的图同款构图)+套 1 深蓝 Polo+玻璃碗+饮料水果盘+暖调 BGM | 40s |
| 29 | Snacks | 5/26 Tue | 20:00-22:00 | White Peach | 二次剪辑/出单 | C ASMR | 字幕"this is what relaxed sounds like." | 工作日傍晚情绪+疗愈+双层撕膜 | S3 ASMR-3 复用+新加 Freddy 旁白"...exhale." | 25s |
| 30 | Choice | 5/27 Wed | 13:00-15:00 | 7-Flavor Mix(7 口味全测) | 再创作/防御 | B Tier List | "Someone asked which flavor's worth it. Real ranking. No BS." | 7 口味 S/A/B/C/D 排名+无 D 级诚实陈述+TikTok 食品赛道高完播格式 | S1 布景 A+背景挂 Tier List 字板 S/A/B/C/D+套 1 | 45s |
| 31 | Choice | 5/28 Thu | 19:00-21:00 | 7-Flavor Mix | 再创作/出单 | D 朋友 first-timer | "This is my brother-in-law. He's Italian. He doesn't trust candy. Watch." | 第二位朋友(非 Aurora)反应戏+硬核怀疑论者翻车+(备:单人讲述+Broll 版本) | S1 布景 A 客厅+套 3 灰针织+(若朋友档期不定则改单人版用 Broll 补) | 50s |
| 32 | Snacks | 5/29 Fri | 21:00-23:00 | Strawberry | 翻拍/出单 | A 反差 | "Friday night plans? Just me. And these. And the couch." | 私密独食+38 岁我配得上反差+真草莓味 | S1 布景 B 沙发弱光+套 5 居家圆领 | 30s |
| 33 | Choice | 5/30 Sat | 20:00-22:00 | Grape | 二次剪辑/出单 | C ASMR 极简 | 字幕"stop scrolling." | Choice 号第二条 ASMR 尝试+黑底极简+紫色视觉冲击 | S3 ASMR-5 葡萄款+黑底+一束侧光 | 25s |
| 34 | Snacks | 5/31 Sun | 18:00-20:00 | 7-Flavor Mix | 再创作/出单 | E 情境(月底回顾) | "End of May review. Things that survived this month: not my workout schedule. Not my budget." | 月底总结+不化耐放+生活方式锚定+June 过渡 | S1 布景 A+套 2 米色亨利衫+5 月日历道具 | 35s |
| 35 | Choice | 5/31 Sun | 20:00-22:00 | 7-Flavor Mix | 再创作/出单 | A 反差+收官冲刺 | "Okay so. I made twenty-two videos about this candy. My family thinks I have a problem." | 月度收官+22 条复盘+last call CTA 峰值+建议 $80-150 付费推流 | S1 布景 A + S3 B-roll 综合 quick cuts+套 4 黑 T+一摞 KOZED 包装+笔记本电脑道具 | 45s |

## 关键依赖（接进 ground-truth 时标 dependency）

| 依赖 | 阻塞条目 | 状态 |
|---|---|---|
| **Aurora 角色**（personas/aurora.md · 依据 04_Aurora_Persona_Addon.md）| #06 #16 #25 | 🔴 待建 personas 目录 |
| **Freddy 人设**（personas/freddy.md · 依据 01_Freddy_Persona_Manual.md）| 全部 35 条 | 🔴 待建 personas 目录 |
| 真实"is this scam" DM 截图 | #22 拍摄 | 🔴 TZ 提供 |
| 当前 KOZED 折扣机制（百分比/bundle）| 全部 CTA | 🔴 TZ 提供具体数字 |
| 同伴档期（#31 brother-in-law）| #31 | 🟡 备用单人版本已在 08_Scripts_Batch4_W5.md 写好 |

## A/B Hook 防御视频清单

5 条防御视频：**#04 · #12 · #17 · #22 · #30**
- 完整 A/B 在 `09_AB_Hooks_Defense.md`
- schema 加 `ab_variant` 布尔字段

## 付费推流推荐清单（cowork 建议）

**6 条**：#16 · #25 · #28 · #30 · #34 · #35
- schema 加 `paid_promotion_recommended` 布尔字段
- 建议预算：$80-150（#35 收官冲刺）

## 完整逐字稿源文件路径

```
~/Library/Application Support/Claude/local-agent-mode-sessions/
  fab0b431-bcef-45fa-b791-0f556879e3c0/
  d85e5047-b264-45af-a30a-d05e0aa554c0/
  local_3b3696c1-c93a-49af-8bef-b3ebc02012cd/outputs/KOZED_May2026/
├── 00_README.md
├── 01_Freddy_Persona_Manual.md
├── 02_Content_Matrix_v1.md
├── 03_Shoot_List_v1.md
├── 04_Aurora_Persona_Addon.md
├── 05_Scripts_Batch1_W1W2.md   (#01-11 全文)
├── 06_Scripts_Batch2_W3.md     (#12-19 全文)
├── 07_Scripts_Batch3_W4.md     (#20-27 全文)
├── 08_Scripts_Batch4_W5.md     (#28-35 全文)
└── 09_AB_Hooks_Defense.md      (5 条防御 A/B + 投流建议)
```

每条逐字稿都包含：完整镜头分镜 + 时间轴 + 收音 + 中文备注 + 英文 Caption + Hashtag + CTA。

## Phase B 提醒（cowork 给的）

- **/library schema 加 `brand` 字段** · 建议至少 **4 个值**：
  - **Glimboo** · **KOZED** · **PulseOn** · **HappyGlobal**（公司号本身）
- 这 35 条全部 `brand=KOZED`
- **/tools/recipe 按品牌分组**时，KOZED 这套是 **5 月 clearance-window 的特例集**
  - 建议单独标 `campaign=may-2026-cleanout` 方便 6 月之后归档

## TODO（接下来做）

- [ ] 建 `~/catchzvibe/docs/ground-truth/personas/` 目录
- [ ] 从 cowork 抽 `freddy.md` + `aurora.md` 进 personas/
- [ ] TZ 提供：真实 "is this scam" DM 截图 + 当前 KOZED 折扣机制
- [ ] 把 35 条作为 seed 数据准备进 Supabase（待 schema 改完）
