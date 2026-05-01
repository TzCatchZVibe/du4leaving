---
source: cowork v2.0 · 2026-04-29
日期: 2026-04-29
session_id: czv-proud-hoare
版本: v1
---

# KOZED 5 月拍摄日历（最终锁定）

## 三日总览

| 日期 | 类型 | 拍摄 | 出镜 | 涉及视频 | 时长 |
|---|---|---|---|---|---|
| **5/1 周五** | 外景 (S2) | Frida | Freddy **单人**（Aurora 不来）| #03 #14 #24 #28 (4 条) | 6h |
| **5/5 周二** | 室内 Day1 (S1) | Frida | Freddy + **Aurora** | Aurora 3 条 + Freddy 主口播 19 条 | 8-10h (long day) |
| **5/8 周五** | 室内 Day2 + B-roll + ASMR (S1+S3) | Frida | Freddy 单人 | 主口播 2 条 + ASMR/B-roll 7 条 | 6-8h |

## shoot_5-1_friday (✅ ready_to_shoot)

```yaml
type: outdoor
shooter: Frida
on_camera: Freddy_solo
videos: [03, 14, 24, 28]
golden_hour_window: 16:00-18:30
weather_backup: 5/2 Saturday
duration_estimate: 6h
status: ready_to_shoot ✅
```

### 拍摄顺序（按光线 · 不按编号）
1. **10:00-12:00** · 公园野餐 #28（道具最多 · 服装最正式 · 上午光柔合）
2. **12:00-13:00** · 转场 + 午餐 + 换装米色亨利
3. **13:00-14:00** · 车里 #03（中午光偏硬 · 车内可控）
4. **14:00-15:00** · 转场到 #24 + 换 Hawaii 衬衫
5. **15:00-16:30** · 车后箱 #24
6. **16:30-17:30** · 转场便利店 + 换装黑 T
7. **17:30-18:30** · 便利店 #14（黄金时段最好）

### 紧急待办
- [ ] Aurora 5/4 实测问卷分发
- [ ] 装备清点（见 `shoot-cards/5-1_frida_shotlist.md`）
- [ ] 公园场地预定 + 便利店店家提前问允许拍

详见 `shoot-cards/5-1_outdoor_4scripts.md` + `5-1_freddy_lines.md` + `5-1_frida_shotlist.md`

## shoot_5-5_tuesday (⏳ pending_aurora_questionnaire)

```yaml
type: indoor
shooter: Frida
on_camera: Freddy + Aurora
videos:
  aurora_3: [06, 16, 25]
  freddy_solo: [04, 05, 08, 09, 10, 11, 12, 15, 17, 19, 20, 21, 26, 27, 30, 31, 32, 34, 35]
duration_estimate: 8-10h (long day)
status: pending_aurora_questionnaire
```

### 阻塞依赖
- Aurora 5/4 实测完成 → 才能填补 S-01, S-05, S-06, S-07 (感官层 4 项)
- cowork 推送 Aurora 提词卡（5/2+）
- cowork 推送 5/5 室内拍摄镜头清单（5/2+）

## shoot_5-8_friday (⏳ pending_full_kp)

```yaml
type: indoor + broll + asmr
shooter: Frida
on_camera: Freddy_solo
videos:
  main_lines: [01]                    # #22 改在 5-5 拍 · 见 _w4-batch-22.md
  asmr_broll: [02, 07, 13, 18, 23, 29, 33]
  aurora_remaining: []
total: 8
duration_estimate: 6-8h
status: pending_full_kp
```

⚠️ **修正**：原 v2.0 文档 main_lines 含 [01, 22] · 但脚本库 v2.0 主表标 #22 为 shoot_session="5-5"（因为 #22 是 Freddy 主口播 + 道具拆箱 · 不需要 ASMR 棚机位）· 已统一为 #22 在 5-5 拍。

### 阻塞依赖
- 知识池补完 (Eason QA + Jason 采购 + 进口商 FDA 注册号)
- cowork 推送 ASMR 专项 (5/2+)
- cowork 推送 5/8 镜头清单 (5/2+)

### 关键产出
- **品牌签名音效库**：Frida 录"啵"声 4-5 个最完美版本 → 给 Hank 做品牌音效库

## 阴雨备选

| 主场 | 备选 |
|---|---|
| 5/1 全部外景 | 顺延 5/2 周六（应急）/ 推 5/8 周五 |
| 公园 (#28) | 备选公园 / 后院 |
| 车里 (#03) | Freddy 自己的车 → 借同事车 |
| 车后箱 (#24) | 皮卡车 → 任何车后备箱 |
| 便利店 (#14) | 提前问好的店 → 备店 / 改车窗外拍替代 |
