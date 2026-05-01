---
source: cowork v2.0 (基于 09_AB_Hooks_Defense.md)
日期: 2026-04-29
session_id: czv-proud-hoare
版本: v1
状态: ✅ 完整版 (替换占位)
---

# 5 条防御视频 A/B Hook 包

## 用法

每条防御视频拍摄时 · **在 0-5 秒位置同时拍 A 版和 B 版两个开头** · 剪辑期出 2 个版本同时发或选播放更好的发。

## 防御视频清单

| # | 账号 | 日期 | SKU | 防御主题 | A/B 状态 |
|---|---|---|---|---|---|
| **#04** | Choice | 5/4 Mon | 7-Mix | 反驳"份量少" | ✅ A/B 就绪 |
| **#12** | Choice | 5/11 Mon | 7-Mix(逐口味) | 反驳 plastic-taste (@therealray26) | ✅ A/B 就绪 |
| **#17** | Choice | 5/16 Sat | 7-Mix | Halal 认证社群精准触达 | ✅ A/B 就绪 |
| **#22** | Choice | 5/20 Wed | 7-Mix | 反驳 "is this scam" + 真实 DM 截图 | ✅ A/B 就绪 (DM 截图方案：员工号 5/初评论后截图) |
| **#30** | Choice | 5/27 Wed | 7-Mix(7口味) | 7 口味 Tier List + 无 D 级诚实陈述 | ✅ A/B 就绪 |

## #04 — 价值感袒露（"you don't get many"）

**A 版（已写入主稿）**
> *"Someone said you don't get many. Okay. Let me show you EVERY piece."*
> 镜头：Freddy 举评论截图

**B 版**
> *"I'm gonna count every single piece in this bag. So you can stop asking."*
> 镜头：Freddy 直接撕开外袋 · 糖滚出来 · **不出现评论截图**

→ A 版偏"回应批评" · B 版偏"主动证明"。**B 版可能完播率更高**（不需要先理解评论）

## #12 — 价值感防御（"taste like plastic"）

**A 版（已写入主稿）**
> *"Someone in the comments said these taste like plastic. Respectfully — let me prove you wrong."*

**B 版**
> *"7 flavors. One bite each. Tell me which one tastes like plastic. Bet you can't."*
> 镜头：7 颗排开特写 · Freddy 不立刻入画

→ B 版**挑战观众**而不是回应差评。挑战式 Hook 在 TikTok 互动率更高。

## #17 — Halal 认证

**A 版（已写入主稿）**
> *"If Halal matters to you — listen up."*

**B 版**
> *"This is the part of the package most people miss."*
> 镜头：直接特写 Halal logo · 不出 Freddy 脸

→ A 版精准触达 Halal 社群 · B 版**好奇心 Hook 更广** · 触及非 Halal 受众但带出认证信号。两条都试。

## #22 — "Is this scam" 拆箱

**A 版（已写入主稿）**
> *"Someone DM'd me this last week."* (举评论截图)

**🆕 v2 DM 截图获取方案 (TZ 2026-04-29 确认)**：
- 当前没有真实 DM 截图
- TZ 计划 5/初用员工号在视频下评论 "is this a scam?" → 后期截图作为 #22 道具
- 5/20 拍摄前必须有截图 (5/初~5/15 任意时段操作)
- 备：截图后 Photoshop 可处理为"模糊 DM 弹窗"避免泄露员工号

**B 版**
> *"What you actually get when you order these online. No editing."*
> 镜头：直接快递盒 → 拆 → 摊

→ A 版基于真实 DM（前提：你有截图） · B 版**无需依赖 DM** · **更适合长期复用**。

⚠️ **如果 5/20 拍摄前 A 版截图未就绪 · 用 B 版顶上**（B 版独立完整 · 不需要任何外部素材）

## #30 — Tier List

**A 版（已写入主稿）**
> *"Someone asked which flavor's worth it. Let me rank them."*

**B 版**
> *"S tier flavor, A tier flavor, and the one I'd give my brother-in-law. Let's go."*
> 镜头：Freddy 已经站在 Tier List 板前 · 手里 3 颗糖准备贴

→ B 版**直接进入悬念**（"哪个是哪个"）· 完播率应该比 A 版高。

## A/B 测试操作建议

1. **同一条脚本 · A/B 各拍一次**（拍摄 1 时间内多花 3-5 分钟）
2. **同一周内** · A 版和 B 版**间隔 24 小时分别发布在 Choice 号**
3. 看前 24 小时数据：完播率 / GMV / CVR
4. 数据更好的版本下次可以**复制结构**到非防御视频

## Schema 字段（v2.0）

```yaml
ab_variant: true              # 仅 #04 #12 #17 #22 #30 为 true
intent: defense
intent_subtype: 再创作
hook_type: B 价值感
ab_hook_a:
  hook_line: string
  shot_notes: string
ab_hook_b:
  hook_line: string
  shot_notes: string
ab_hook_b_independent: bool   # B 版是否能独立成立 (不依赖 A 版素材)
```

## 投流建议（针对 7 条最重要的视频）

| # | 内容 | 建议预算 |
|---|---|---|
| #04 | 价值感袒露 | $30-50（防御覆盖怀疑客群）|
| #16 | Aurora 反向推荐 | $50-80（信任感最高）|
| #25 | Aurora first-timer | **$80-120**（一镜到底 · 转化天花板）|
| #28 | Memorial Day 户外 | $50-80（节庆窗口）|
| #30 | Tier List | $30-50（高完播）|
| #34 | 月底回顾 | $30-50 |
| #35 | 月度收官 | **$80-150**（CTA 峰值 · 最后一波冲量）|

合计建议 **$350-580** 投流预算（跨 5 周分摊）。如果实际预算紧张 · **优先保证 #25 + #35 两条**。

## 待 TZ 决定

- [ ] 投流总预算定在哪一档？$350 / $580 / 其他
- [ ] DM 截图操作时机（5/初 vs 5/中 vs 5/20 前任意）
