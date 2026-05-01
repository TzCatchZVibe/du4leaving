---
title: Claude 工作铁律 (合规红线 + 元研究先行)
日期: 2026-04-29
session_id: czv-proud-hoare
适用范围: 任何 Claude (catchzvibe / cowork / Claude.ai) 处理 KOZED / Glimboo / HG 内容时
---

# Claude 工作铁律

## 🔴 第一铁律：合规红线 (compliance_redlines)

任何脚本 / caption / 标签 / 视频内容 **如违反任意一条 redline · 阻止发布**。

### KOZED 6 条红线（2026-04-29 包装实读后锁定）

| ID | 红线 | 原因 |
|---|---|---|
| `no_mention_gelatin_source` | 视频中**绝对不提**明胶来源（Bovine / 牛源）| Tom Q1 指示 A · 避免文化/宗教争议 |
| `no_mention_made_in_china_unless_passive` | 不主动说 "Made in China" · 拍摄不刻意遮挡 | 避免品牌降级感 |
| `no_mention_shelf_life` | **绝对禁止视频提及** 6 个月保质期 | 避免引发清仓质疑 |
| `no_natural_or_clean_claims` | 禁说 "natural" / "clean" / "all natural" | 配料含 Red 40 + 钛白粉 + 矿物油 + 巴西棕榈蜡 · 法律风险 |
| `no_kid_narrative` | 5 月 35 条**零儿童叙事**（即使 4 月儿童投诉已恢复）| 品牌升级策略 + 风险隔离 |
| `no_clearance_or_closeout` | 不说"清仓 / 处理 / closeout / clearance" · 用"limited window"含蓄表达 | 保护品牌价值 |

### Schema 强制字段

```yaml
compliance_redlines:           # 必需字段 · 写脚本时主动声明遵守哪些
  - no_mention_gelatin_source
  - no_mention_made_in_china_unless_passive
  - no_mention_shelf_life
  - no_natural_or_clean_claims
  - no_kid_narrative
  - no_clearance_or_closeout
```

任何脚本生成器 / 审稿 / 发布工作流 → 自动 grep 这 6 条违规词 → 触发即拦截。

## 🟡 第二铁律：元研究先行（Meta-Research First）

写脚本前 / 改 schema 前 / 开新功能前 · **必须先读相关 ground-truth 源文件**。

### KOZED 必读顺序

1. `_CHANGELOG.md` (本次更新日志)
2. `kozed/north-star.md` (Tom 5 月真实意图)
3. `kozed/knowledge-pool-v1.0.md` (52 条事实底座)
4. `kozed/visual-signature.md` (Frida / Hank 工作圣经)
5. `kozed/脚本库.md` (35 条主表)

### Glimboo 必读

1. `公司身份.md` (HG 全资 Glimboo 关系)
2. `业务客户.md` (三阶段切换)
3. `glimboo品牌dna.md` (旺卡+小马宝莉 DNA)
4. `glimboo转型路线图.md` (5-7 月时间线 + 米凯迪危机)

## 🟢 第三铁律：Tom 沟通规则

- **≤3 行决定一次** · ADHD/INFP · 一次一个决定
- **全可视化** · 表格 / 卡片 / ASCII / 视觉层级 · **禁止大段文字**
- **选择题 ABC** · 不要开放问题
- **中文文件命名 GenZ 风**

## 🟢 第四铁律：HKRR 80+ 工程化

任何 KOZED 脚本必须四维全 ≥80：

```yaml
hkrr_score:
  happiness: ≥80   # 神经科学 4 通路 (Dopamine/Endorphin/Oxytocin/Serotonin)
  knowledge: ≥80   # Kahneman L3+ 信息差
  resonance: ≥80   # 镜像神经元 time + location + action 三元组
  rhythm: ≥80      # Walter Murch (emotion > story > rhythm > eye-trace > 2D > 3D)
five_senses_triggered: ≥3 senses (视/听/触/味/嗅)
```

低于任意一维 80 → 重写。

## 🟢 第五铁律：Cozy 密度 ≥70

KOZED 35 条平均 cozy_density 必须 ≥70 · 个别条目 ≥60 可接受 · 但需用其他维度补足。

50% 视频要在前 15 秒出现 "cozy" 字幕或台词。

## 🟢 第六铁律：双层质感呼应

每条至少 1 种方式呼应 "It's not just the peel — the bite underneath."：

| 落地方式 | schema 值 |
|---|---|
| 慢动作展示外膜→内里 | `visual_slowmo` |
| 直接说 "first the peel, then the bite" | `voiceover_line` |
| 字幕 "both layers" 关键词放大 | `subtitle_keyword` |
| 撕膜声 + 咀嚼声分层 | `audio_layered` |
| 俯拍展示糖果两层结构 | `composition_topdown` |
| 剥外层 (0-2s) → 咬内层 (2-4s) 双拍点 | `rhythm_double_beat` |

## 🟢 第七铁律：视觉签名守则（Frida + Hank）

- 镜头静止 60%+ · 慢推 25% · 跟拍 10% · 慢动作 5%
- 黄金时段优先 · 暖色调 · 5500K-3500K
- 字幕中下偏上 1/3 · PP Neue Machina · 关键词 1.3x + KOZED 粉色 (#FF7B9C)
- BGM 仅 Bonobo / Tom Misch / FKJ / Nujabes / Emancipator · BPM 60-95
- 禁用 trending sound · 禁用快速横摇 · 禁用跳剪
- 每条至少 1 段 1-2 秒静默
- 每条至少 1 个 Freddy 闭眼 1 秒"享受"瞬间（cozy 灵魂）

## 🟢 第八铁律：工作室 IP 边界

所有自研工具 100% 归 **CatchZVibe Studio** · HG 是客户 (授权使用) · 合作可终止 · 工具 TZ 带走。

写代码 / 文档 / 内容时永远挂 **"CatchZ Studio 出品"** · 不挂 HG logo（除非客户素材本身就是 HG 品牌内容）。
