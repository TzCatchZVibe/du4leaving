---
source: cowork v2.0 (18_Visual_Signature_v1.md · 2026-04-29 14:50)
日期: 2026-04-29
session_id: czv-proud-hoare
版本: v1
适用: Frida (拍摄) + Hank (剪辑) 工作圣经
视觉方向: A24 + Apple Ad + Aesop 三者交集
核心母题: Cozy / Double-Layer / Quiet Vibe
---

# KOZED 影像签名手册 v1

## 一、影像签名的 4 大支柱

### 支柱 1：静止 + 慢推（Stillness & Slow Push）

| 镜头类型 | 占比 | 用途 |
|---|---|---|
| 完全静止 | 60% | 主叙事、产品镜、独立小包特写 |
| 缓慢推进（慢于人感 1/3）| 25% | 转折点、Aha 时刻、开场 Hook |
| 跟拍 | 10% | 走入便利店、外景过渡 |
| 慢动作变速 | 5% | 撕膜+咬合的 240fps 镜头 |

**禁用**：快速横摇、跳剪、抖动、TikTok 原生过渡特效

### 支柱 2：构图哲学（Composition Philosophy）

| 规则 | 落地 |
|---|---|
| **三分上偏** | 人脸放上 1/3 黄金交叉点 |
| **中央对称** | 产品镜全部居中（Wes Anderson 式）|
| **大量留白** | 30%+ 画面是"空气"·给字幕和呼吸感 |
| **浅景深** | f/2.8-f/4 · 背景虚化 |
| **稳水平线** | 任何镜头水平线必须保持 · 不要倾斜（除非有意）|

### 支柱 3：色彩签名（Color Signature）

#### Choice 主号 — 暖系 Cozy

```
主色：Cozy Cream      #F5EDE0
副色：Honest Brown    #8B6F4E
重点：KOZED Pink      #FF7B9C  (字幕关键词高亮)
辅助：Honey Gold      #E5A04C  (黄昏光感)
```

**LUT 调色**：
- 整体 +5 暖色温
- 黄色饱和度 +10
- 阴影 +5 棕褐
- 添加 5-8% 胶片颗粒感（Filmic Pro / FilmConvert）

#### Snacks 副号 — 也走暖（不再做冷系）

> **重大调整**：之前提议 Snacks 走冷系 · 但 Tom Q9 强调 vibe + cozy · 整月统一暖系更稳。

```
主色：Soft Beige      #E8D9C5  (比 Choice 浅)
副色：Espresso Dark   #3D2E1F  (低光区域)
重点：KOZED Pink      #FF7B9C
```

**LUT 区别**：Snacks 比 Choice **更暗一档**（更夜晚感、更私密）

### 支柱 4：字幕签名（Typography Signature）

| 项 | 规则 |
|---|---|
| **字体** | PP Neue Machina（首选）/ Söhne / Inter（备选）|
| **位置** | 屏幕中下偏上 1/3（避开 TikTok 底部 UI）|
| **大小** | 单行最多 6 个英文词（中文 8 字）|
| **颜色** | 主色 #FFFFFF + 1px 黑色描边（任何背景清晰）|
| **关键词处理** | 1-2 个词放大 1.3 倍 + 染 #FF7B9C 粉色 |
| **入场** | 简单淡入 · 0.2s · **禁止弹跳/旋转** |
| **停留时间** | 每条字幕至少 1.5 秒可读 |
| **全屏字幕卡** | 黑底白字 · 居中 · 停留 2 秒 · 每条至多 1 张 |

**示例**：
```
"Outside layer first."
[切镜]
"Then the bite UNDERNEATH."  ← UNDERNEATH 放大 + 粉色
```

## 二、双人对话戏（Aurora 出现的 #06 #16 #25）字幕签名

| 规则 | 说明 |
|---|---|
| **左右对位** | Freddy 字幕**左对齐** · Aurora 字幕**右对齐** |
| **颜色微差** | Freddy 字幕白底 · Aurora 字幕**米白底+粉色描边** |
| **同时说话** | 极少出现 · 如出现用上下分屏字幕 |
| **静默处理** | Aurora 那 5 秒安静要给**字幕 "..."** 三秒（呼吸感）|

## 三、声音签名（Sound Signature）

### 3.1 BGM 选曲守则

| 账号 | 风格 | 推荐艺术家 | BPM 范围 |
|---|---|---|---|
| Choice | Lo-fi Hip Hop / Soft Bossa | Bonobo, Tom Misch, FKJ | 70-95 |
| Snacks | Slower Lo-fi / Ambient | Nujabes, Emancipator, FKJ slow | 60-80 |
| ASMR | **几乎无 BGM** | 仅环境音 | — |
| 防御视频 | **几乎无 BGM** | 让 Freddy 的话有诚实感 | — |

**禁用**：TikTok trending sound、流行歌曲、电子舞曲、抖音热歌

### 3.2 品牌签名音效

每条结尾"Trust HappyGlobal..."口播后留 0.3 秒 · **加 1 个独家撕膜采样音**。

> Frida 在 5/8 B-roll 拍摄时**专门录一段最完美的"啵"声 4-5 个版本** · 给 Hank 做品牌签名音效库。

### 3.3 ASMR 处理铁律

- 撕膜声原始录制 → **不要后期增强**（保持真实感）
- 添加**轻微低通滤波**（去掉 8kHz 以上的尖锐感）
- **轻微混响 0.1-0.2s**（剧场感）
- 保留环境噪声 -25dB 底噪（不是绝对静音）

### 3.4 静默节拍

每条至少 1 段 1-2 秒"什么都没说" · **这是 Cozy 的灵魂**。Hank 不要填满。

## 四、镜头节奏模板（30s/40s/50s 三种时长）

### 30 秒模板（典型主口播 / 反差金句）

```
0-3s    Hook 静止特写             → H 爆点
3-8s    人物中景 + 第一句台词       → R 共鸣
8-15s   慢推 + 字幕卡 + 一个 K 点    → K 知识
15-22s  慢动作双层质感             → 双层呼应
22-27s  反差金句 / 转折             → H + R
27-30s  CTA + 签名口播 + 包装定格   → CTA + 品牌音
```

切镜数：6-8 次 / 30s = 0.2-0.27 cut/s

### 40 秒模板（情境戏 / 节庆）

```
0-3s    远景静止建立场景            → R 场景
3-7s    缓慢推近 + 第一句台词       → R + Hook
7-12s   动作 + K 知识点             → K
12-15s  全屏字幕卡（KOZED=cozy）   → 品牌锚定
15-22s  双层质感慢动作             → 双层呼应
22-28s  中景靠回 + 闭眼 1 秒        → Cozy 灵魂瞬间
28-34s  远景静止 + CTA             → R + CTA
34-40s  包装定格 + 签名口播          → 品牌音
```

切镜数：8-10 次 / 40s = 0.2-0.25 cut/s

### 50 秒模板（Aurora 双人戏 / first-timer 反应）

```
0-3s    人物入画 + 关系交代          → R
3-9s    第一颗试吃 + 反应            → H + R
9-19s   K 信息（Aurora 专业视角）    → K
19-26s  关键 5 秒安静（first-timer 戏）→ R 顶峰
26-34s  反应金句                     → H 爆点
34-42s  双层质感 + 包装               → 双层 + K
42-47s  CTA                          → CTA
47-50s  签名口播 + 品牌音              → 品牌锚定
```

切镜数：10-14 次 / 50s = 0.2-0.28 cut/s

## 五、Hank 剪辑必守的 8 条铁律

1. **第一帧必须是"美到能截屏"的画面** — 决定划过来的人停不停下
2. **每个切点都要服务情感** — 不为节奏而切 · 为情感曲线而切（Walter Murch 法则）
3. **保留 Freddy 的微停顿** — 不要把"嗯..."剪掉 · 这是 cozy 的人格
4. **撕膜"啵"声**必须在切镜瞬间或前后 0.1 秒内 — 视听同步
5. **字幕入场不要弹跳** — 简单淡入 · 1 帧 5%
6. **结尾包装定格至少 0.5 秒** — 让品牌锚定有时间
7. **不要堆字幕** — 一屏最多 1 行 · 全屏字幕卡每条至多 1 张
8. **每条至少 1 段 1-2 秒静默** — Hank 你最容易违反这条 · 请克制

## 六、视觉签名"过审"自检（Frida 拍后 + Hank 剪后各过一遍）

每条视频拍完/剪完后用这 10 题打勾：

- [ ] 1. 第一帧能截屏当封面吗？
- [ ] 2. 60% 镜头完全静止吗？
- [ ] 3. 至少 1 次缓慢推进吗？
- [ ] 4. 黄金时段或暖光控制好了吗？
- [ ] 5. 双层质感有清晰展示吗？
- [ ] 6. 撕膜"啵"声听得清吗？
- [ ] 7. 字幕在中下偏上 1/3 位置吗？
- [ ] 8. 关键词放大 + 粉色高亮做了吗？
- [ ] 9. 至少 1 段 1-2 秒静默吗？
- [ ] 10. 结尾签名口播 + 包装定格 + 品牌音齐了吗？

**10 题至少 8 题"是" = 达标** · 低于 8 = 重剪。

## 七、5 月 35 条视觉签名总览（schema 接口）

```yaml
visual_signature:
  reference_aesthetic: ["a24", "apple_ad", "aesop"]
  motion_profile:
    static_shots: 60%
    slow_push: 25%
    handheld_follow: 10%
    slow_motion: 5%
  color_grading:
    choice: "warm_cozy_cream"
    snacks: "warm_dim_beige"
    lut_grain: 5-8%
    color_temp: 3500-5500K
  typography:
    font: "PP Neue Machina"
    position: "lower_third_upper"
    keyword_treatment: "1.3x_pink_FF7B9C"
    full_screen_card: "max_1_per_video"
  audio:
    bgm_artists: ["Bonobo", "Tom Misch", "FKJ", "Nujabes", "Emancipator"]
    bpm_range: 60-95
    no_trending_sounds: true
    brand_signature_sfx: "peel_pop_0.3s"
    silence_required: "1-2s_per_video"
  pacing:
    cut_rate: "0.2-0.28_cut_per_second"
    slowmo_required: true
    eye_close_moment: "1s_per_video"
```
