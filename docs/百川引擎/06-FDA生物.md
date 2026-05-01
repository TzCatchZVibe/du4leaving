# 06 · FDA / 生物 · 药品批准 / AdCom 投票

> Tier 1 · 实施成本 2 周 · 预期 wr 60-70% · 月 ROI 3-6% · 单事件

## §1 元逻辑

```
本质 · "X 药 在 Y 日期前是否 FDA 批准" · 二元
       FDA 批准是确定性强的 · AdCom (Advisory Committee) 投票公开 · prior 易拿
       Phase 3 试验数据 readout 是 alpha 来源
不是医学判断 · 是
  · AdCom 投票 → FDA 跟随率 ~85% · 直接套
  · Phase 3 数据 → 简单频率统计 (e.g. p-value < 0.001 historically 80%+ 通过)
  · 历史基率 (按疾病类型 / 适应证)
```

## §2 数学骨架

### 2.1 AdCom → FDA 后续跟随

```
FDA 通常 (历史 1990-2024 · ~85%) 跟随 AdCom 投票
  AdCom 投赞成 → FDA 后续批准 P ≈ 87%
  AdCom 投反对 → FDA 拒批 P ≈ 90%
  分裂投票 (5-4 等) → 不确定 · ~55%

数据源 · FDA 公开会议日历 · 投票纪录 · 通常 30-90 天后决议
```

### 2.2 Phase 3 readout → 批准率

```
Phase 3 主要终点达成 · primary endpoint hit ·
  Type I error < 0.001 · 历史 FDA approval ~85%
  Type I error < 0.01  · ~75%
  Type I error < 0.05  · ~55%
  
未达成 · ≈ 5-15% (有 secondary 救场可能)

数据源 · ClinicalTrials.gov + 公司 PR (盘后) + biotech-news 抓
```

### 2.3 历史基率 (按疾病)

```
Oncology · 历史 PDUFA 批准率 ~90%
Neurology · ~75% (阿尔兹海默低)
Antibiotic · ~95%
Vaccine · ~92%
Gene therapy · ~70% (新型不确定)
```

## §3 数据源

| 数据 | 源 | 成本 |
|---|---|---|
| FDA 会议日历 | fda.gov/advisory-committees/upcoming | 免费 |
| AdCom 投票纪录 | fda.gov 文档 | 免费 |
| ClinicalTrials.gov | API | 免费 |
| Phase 3 results | 公司 PR · 8-K filing | 免费 (SEC) |
| Biotech-news | endpoints.com / fiercebiotech | 免费 (RSS) |
| Drug pipeline | drugs.com / company IR | 免费 |
| Kalshi FDA | KXFDAAPPROVE | 免费 |

## §4 信号子源

### 4.1 AdCom 投票后追逐

```
对每个 Kalshi FDA 市场 ·
  · 找对应 AdCom (FDA 日历)
  · 若已开 · 拿投票结果
  · P_FDA = 投票分布映射 (赞成=87% / 反对=10% / 平局=55%)
  
edge = P_FDA - kalshi_yes_ask/100
触发阈 · 5pp · 历史触发后 wr ≈ 70%
```

### 4.2 Phase 3 readout 即时

```
公司 PR / 8-K filing 公开后 ·
  · LLM 解析 · primary endpoint hit / miss / partial
  · 若 hit + p < 0.001 → +30pp shift toward yes
  · 若 hit + p < 0.05 → +15pp
  · 若 miss → -25pp

窗口 · 公布后 1-3 天 · Kalshi 反应慢
```

### 4.3 历史基率 fallback

```
若无 AdCom + Phase 3 信号 · 用基率
P_base = base_rate(disease_type)
edge = P_base - kalshi_yes_ask/100
触发阈 · 8pp (基率 noisy)

a_baserate ≈ 53%
```

## §5 入「百川」融合

```
信号                    准确率   权重
AdCom 投票后            70%      高 (1.0)
Phase 3 readout         65%      高 (1.0)
历史基率                 53%      低 (0.3)
```

## §6 实施成本 (2 周)

```
W1
  ☐ FDA AdCom 日历同步 (0.5d)
  ☐ ClinicalTrials.gov API client (1d)
  ☐ Endpoints / FierceBiotech RSS feed (0.5d)
  ☐ 8-K filing 监听 (1d) · 共用 §05 的 SEC EDGAR
  ☐ Kalshi FDA ticker 解析 (0.5d)
  
W2
  ☐ LLM 解析 Phase 3 PR (Hermes 405B 调) (1d)
  ☐ 历史基率表 (一次性 · 整理 PDUFA 数据) (1d)
  ☐ 信号融合 (0.5d)
  ☐ paper 跑 1 月 + 评估 (1.5d)
```

## §7 期望 EV

```
FDA 月均决议 ~30 个 NDA / BLA · Kalshi 覆盖 5-15 个/月
每个 1-3 个相关市场

月触发 · 20-40 单
per trade $4 · wr 65%
  EV per trade = +$1
  - 抽水 = +$0.80
月 EV (30 单) = +$24 · 6%/月

加上 AdCom 后窗口 (~3 天) · 价格调整慢 · 套利机会
年 EV ≈ +$300 (75% on $400)
```

## §8 失败模式

```
死法 1 · CRL (complete response letter) 突发
   FDA 不批 · 突然要求补数据 · Phase 3 hit 也可能拒
   防 · AdCom 后 P 取 ≤ 90% (留 10% buffer)

死法 2 · Phase 3 readout 解析错
   PR 说"trended positive" 实际是 miss
   防 · 任何 PR 必须 LLM 解析 + 关键词验证 (p-value 数字必须明确)
       不明确的 · 跳过

死法 3 · 数据延迟 · 你 PR 出来 30 分钟才知道
   防 · 多源监听 (公司 IR + Twitter + Reddit r/biotech_smart_money)
        最快路径 5 分钟到达
```
