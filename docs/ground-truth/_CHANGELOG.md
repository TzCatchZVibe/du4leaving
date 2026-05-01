---
title: ground-truth 变更日志
日期起: 2026-04-29
session_id: czv-proud-hoare
---

# ground-truth · 变更日志

## v2.0 · 2026-04-29 (cowork 推送 · 最终交付包)

### 6 处颠覆性变更（按重要程度）

#### 🔴 #1 战略转向：从"35 条带货"→"建立 KOZED 影像 DNA"
Tom Q9 三大目标重新定义 5 月真实意图：
1. 跑通工作流（不冲量）
2. 建立公司 vibe / 格调 / 艺术感 / 专业品牌印象
3. 重塑 plastic-taste 差评

→ **GMV 不再是首要 KPI** · schema 加 `kpi_priority: workflow_first | vibe_first | gmv_first`

#### 🔴 #2 双层质感 = 5 月统一灵魂
> **"It's not just the flavor. It's the texture. Not just the peel — the bite underneath."**

→ schema 加 `brand_pillar: [double_layer_texture, cozy_lifestyle, vibe_aesthetic]`
→ 每条必须标 `double_layer_method`（visual_slowmo / voiceover_line / subtitle_keyword / audio_layered / composition_topdown / rhythm_double_beat）

#### 🔴 #3 KOZED = "Cozy" 命名灵魂
Tom Q6 候选 3 确认：
> *"It's KOZED — like 'cozy' but lazier. That's the whole vibe."*

→ schema 加 `cozy_density: 0-100`（35 条平均 ≥70）

#### 🔴 #4 包装实读 6 处颠覆（合规红线）

| 字段 | 旧值 | 新值（包装实读）| 处理 |
|---|---|---|---|
| 明胶来源 | Fish gelatin | **Bovine Gelatin** | **视频中绝对不提**（Tom Q1 指示 A）|
| 制造地 | 美/韩/印尼 | **Made in China** | 不主动说，不刻意遮挡 |
| 配料 | 自然 | **含 Red 40 + 钛白粉 + 矿物油 + 巴西棕榈蜡** | 禁说 "natural / clean" |
| 保质期 | 未知 | **6 个月** | **绝对禁止视频提及** |
| Halal 机构 | IFANCA 假设 | 中国 Halal 体系 | 只说 "Halal certified"，不展开机构 |
| 进口商 | Texas | **California Rowland Heights** | 不主动展开 |

→ schema 加 **`compliance_redlines` (强制字段 · 任何脚本违反任意一条 → 阻止发布)**

#### 🟡 #5 HKRR 工程化（比 Tim 标准更深）
- **H** 神经科学 4 通路 (Dopamine / Endorphin / Oxytocin / Serotonin)
- **K** Kahneman 信息差等级 L1-L5（最低 L3 才能拿 80）
- **R 共鸣** 镜像神经元具体性铁律（time + location + action 三元组）
- **R 节奏** Walter Murch 6 条剪辑铁律 (emotion > story > rhythm > eye-trace > 2D > 3D)
- 五感矩阵（视/听/触/味/嗅 · 至少 3 感）

→ schema 加 hkrr_score 4 维 · 每维 ≥80 · `information_tier` `mirror_neuron_specificity` `five_senses_triggered` `neuroscience_channels` `murch_priority`

#### 🟢 #6 拍摄日历最终锁定
| 日期 | 拍摄 | 出镜 |
|---|---|---|
| **5/1 周五** | S2 外景（4 条 #03 #14 #24 #28）| Freddy **单人**（Aurora 不来）|
| **5/5 周二** | S1 室内 Day1（Aurora 全部 3 条 + Freddy 主口播）| Freddy + **Aurora** |
| **5/8 周五** | S1 室内 Day2 + S3 B-roll & ASMR | Freddy 单人 |

→ schema 加 `shoot_session: "5-1" | "5-5" | "5-8"` + `freddy_solo: bool`

### 结构变更

```
ground-truth/
├── _CHANGELOG.md  🆕                    本文件
├── claude-rules.md  🆕                  Claude 工作铁律 (合规红线 + 元研究先行)
├── 公司身份.md
├── 业务客户.md
├── glimboo转型路线图.md
├── glimboo品牌dna.md
├── glimboo协作人.md
├── 团队Glimboo分工.md
├── kozed/  🆕 (子目录化)
│   ├── north-star.md  🆕                Tom 5 月战略 + 双层宣言 + Cozy 命名
│   ├── visual-signature.md  🆕          Frida/Hank 工作圣经 (A24+Apple+Aesop)
│   ├── knowledge-pool-v1.0.md  🆕       52 条产品知识 (L3+ 占 80%)
│   ├── 脚本库.md  🔄 (替代旧 kozed脚本库.md · v2.0 schema)
│   ├── ab-hooks.md  ⏳ (占位 · 待 cowork 推 09)
│   └── shoot-schedule.md  🆕            5/1 + 5/5 + 5/8 三日详情
├── personas/  🆕
│   ├── _README.md  🆕 (占位)
│   ├── freddy.md  ⏳ (待 cowork 推 01_Freddy_Persona_Manual.md)
│   └── aurora.md  ⏳ (待 cowork 推 04_Aurora_Persona_Addon.md)
├── captions/  🆕
│   ├── _README.md  🆕
│   └── (35 个待 cowork 5/2+ 推完整版后填)
└── shoot-cards/  🆕
    ├── 5-1_outdoor_4scripts.md  🆕      4 条 FINAL v2.0 + 中英双版
    ├── 5-1_freddy_lines.md  🆕          Freddy 提词卡 (英文 · 拿着拍)
    ├── 5-1_frida_shotlist.md  🆕        Frida 镜头清单 (中文 · 装备/顺序/雷区)
    └── (5-5 + 5-8 待出 · cowork 5/2+ 推)
```

### 35 条状态

- **4 条 ✅ FINAL v2.0**：#03 #14 #24 #28（5/1 外景 · 已通过双层质感+Cozy北极星+HKRR 80+ 全部条件）
- **31 条 ⏳ rewrite_pending**：5/2+ cowork 用 v1.0 知识池 + Cozy 命名 + 双层北极星重写

### 待 cowork 后续推送

- [ ] 31 条剩余脚本 v2.0 重写版（5/2+）
- [ ] 5/5 拍摄镜头清单 + Aurora 提词卡
- [ ] 5/8 拍摄镜头清单 + ASMR 专项
- [ ] 35 条 captions 完整版
- [ ] HKRR 自检清单 35 份
- [ ] freddy.md persona
- [ ] aurora.md persona
- [ ] 5 条防御 A/B Hook 完整版（09_AB_Hooks_Defense.md）

### 待 TZ 紧急（5/1 拍摄前）

- [ ] Aurora 5/4 实测问卷分发
- [ ] 装备清点（见 shoot-cards/5-1_frida_shotlist.md）
- [ ] 场地预定（公园 + 便利店）
- [ ] 是否阴雨备 5/2 备份日

---

## v3.1 · 2026-04-29 16:00 (Aurora 拒拍 · 三条戏重构)

### 触发
TZ 邀请 Aurora 出镜 → Aurora 03:57 PM 回 "我感觉我有点害羞，拍视频还是不了"

### 影响
- 3 条 Aurora 戏 (#06 #16 #25) → 重构为 Freddy 单人独角戏
- 2 条 Aurora 引用 (#01 #08 #11 caption + 旁白) → 替换为 Freddy 自我溯源叙事
- 5 条间接 Aurora 提及 (#21 #30 #35 caption) → 改为 Freddy 自嘲/记忆叙事

### 重构后 v2.1 三条戏

| # | v2.0 (Aurora) | v2.1 (Freddy 独角) | HKRR R 共鸣 | 拍摄复杂度 |
|---|---|---|---|---|
| #06 | Aurora 蒙眼盲测 | Freddy self-blind 7 口味嘴尝挑战 | 90 → 80 | 50% ↓ |
| #16 | Aurora 反向推荐 white peach | Freddy self-correction "我推错了 · 真正该买 white peach" | 92 → 82 | 50% ↓ |
| #25 | Aurora first-timer grapefruit | Freddy first-timer grapefruit 一镜到底 | 95 → 88 | 30% ↓ |

### 整月 HKRR 影响

- R 共鸣均分: 88.5 → 87.5 (-1.0)
- 35 条仍 100% 达 ≥80 标准 · 无任何条目跌破红线
- R 共鸣峰值 95 不再独占 → 由 #18 #24 #26 #03 4 条共享 (ASMR + Sunday + Friday + 车里)

### 投流权重转移

- 信任锚点权重从 #16 #25 → 转移到 #18 (ASMR 诗意 · 不依赖搭档化学反应)
- #25 投流从 $80-120 → $50-80
- #18 投流从 $30-50 → $50-80
- 总预算 $350-580 不变

### 文件变更清单

```
✅ 重写 (3)
- scripts-v2/06.md  (v2.0 → v2.1 Freddy self-blind)
- scripts-v2/16.md  (v2.0 → v2.1 Freddy self-correction)
- scripts-v2/25.md  (v2.0 → v2.1 Freddy first-timer)

✅ 编辑清理 Aurora 引用 (5)
- scripts-v2/01.md      ("Aurora made me try" → "wife slid one")
- scripts-v2/_w2-batch.md  (#08 #11 移除 Aurora 偷拿 + 输给 Aurora 叙事)
- scripts-v2/_w4-batch.md  (#21 "Don't tell Aurora" → "Round 3")
- scripts-v2/_w5-batch.md  (#30 #35 移除 Aurora 提及)

✅ 数据/索引联动更新 (5)
- kozed/脚本库.md         (#06 #16 #25 状态从 rewrite_pending → final_v2.1 · 移除 Aurora 标签)
- shoot-cards/5-5_indoor_fullday.md  (出镜从"Freddy + Aurora"→"Freddy 全独角" · 时间表+服装+提词卡分发全更新)
- hkrr/scores-35.md       (#06 #16 #25 评分更新 · 投流推荐重排)
- captions/all-35.md      (#06 #11 #16 #21 #25 caption 全部重写)
- glimboo协作人.md        (出镜人区 Aurora 标 archived)
- personas/freddy.md      (Aurora 章节改 v2.1 替代叙事)

✅ 归档 (1)
- personas/aurora.md → personas/_archived_aurora.md (加拒拍说明 + 重启条件)
- personas/_README.md  (Aurora 状态从 待 cowork 推 → ❌ 拒拍归档)
```

### 待 Aurora 改主意时如何回滚

如未来 Aurora 改主意愿意拍：
1. 把 `personas/_archived_aurora.md` 改回 `aurora.md`
2. 把 `scripts-v2/{06,16,25}.md` 回滚到 v2.0 版本（需保留 git 历史 · 当前未 commit）
3. `kozed/脚本库.md` 把 #06 #16 #25 的拍摄日描述改回 Aurora 双人戏
4. 投流权重从 #18 → #25 转回

---

## v3.0 · 2026-04-29 (catchzvibe Claude 接 cowork 全部产出)

cowork 宕机 · catchzvibe Claude 接全部 cowork 待办（D 全量包）。一次 session 交付：

### 阶段 1 · 基础包 (6 文件)
- `personas/freddy.md` v2 (Cozy uncle + 双层台词模板 + 闭眼签名)
- `personas/aurora.md` v1 (5/1 不出镜注释)
- `questionnaires/aurora-5-4-tasting.md`
- `questionnaires/qa-product.md`
- `questionnaires/_archived_tom-q1-q10.md`
- `kozed/ab-hooks.md` 完整版（替换占位 + #22 DM 截图方案）

### 阶段 2 · 5/5 拍摄包 (9 文件 / 22 条脚本)
- `shoot-cards/5-5_indoor_fullday.md` (8-10h 全天统筹)
- `scripts-v2/06.md` Aurora 盲测
- `scripts-v2/16.md` Aurora 反向推荐
- `scripts-v2/25.md` Aurora first-timer 一镜到底
- `scripts-v2/_w2-batch.md` (#04 #05 #08 #09 #10 #11)
- `scripts-v2/_w3-batch.md` (#12 #15 #17 #19) — ⚠️ #17 移除"Fish gelatin"合规修正
- `scripts-v2/_w4-batch.md` (#20 #21 #26 #27)
- `scripts-v2/_w4-batch-22.md` (#22 待 DM 截图)
- `scripts-v2/_w5-batch.md` (#30 #31 #32 #34 #35)

### 阶段 3 · 5/8 拍摄包 (3 文件 / 8 条 + 1 修正)
- `shoot-cards/5-8_indoor_asmr.md` (含品牌签名音效库录制)
- `scripts-v2/01.md` (5 月开门红主口播)
- `scripts-v2/_asmr-batch.md` (7 条 ASMR #02 #07 #13 #18 #23 #29 #33)
- 修正 `kozed/shoot-schedule.md` 5/8 main_lines 移除 #22 (改在 5-5 拍)

### 阶段 4 · captions + HKRR (3 文件)
- `captions/all-35.md` (35 条 TikTok + IG 二剪 + Hashtag pool)
- `hkrr/checklist-template.md` (Frida 拍后 + Hank 剪后 7 关自检)
- `hkrr/scores-35.md` (35 条 HKRR 评分总表 + 维度峰值排行 + 投流推荐)

### 总计交付
- **21 个新文件 + 1 个修正**
- **35 条脚本全部 v2.0** (4 已 FINAL · 30 final · 1 pending_dm_screenshot)
- **HKRR 4 维 100% 达标** (≥80 全部满足)
- **合规红线 100% 遵守** (6 条全部应用)

### v1 → v3.0 关键修正
- v1 #17 "Fish gelatin. No pork, no beef." → **完全移除** (合规红线 no_mention_gelatin_source)
- v1 多处缺 cozy 锚定 → 全部补齐
- v1 缺双层质感呼应 → 全部加台词/视觉/字幕呼应
- v1 缺 Freddy 闭眼 1s 签名 → 全部加

### 待 cowork 复活后追加
- 35 条 caption 中英对照（如做中文市场）
- 每条 IG 二剪首图 specs
- HKRR 4 维总分 <320 的条目优化 (目前最低 #04 #09 #17 #22 = 322 · 全在边缘)

---

## v2.0 · 2026-04-29 下午 (cowork 推送 · 最终交付包)

- 建 ground-truth/ 目录
- 写 6 份骨架 md：公司身份 / 业务客户 / glimboo转型路线图 / glimboo品牌dna / glimboo协作人 / 团队Glimboo分工
- 写 kozed脚本库.md 35 条（cowork v1.0 推送 · 已被本次 v2.0 替代）
- 写 00_HANDOFF_TO_COWORK.md 全量打包
