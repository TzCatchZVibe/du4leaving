# 07 · 球员 Props · NBA / NFL 个人数据

> Tier 2 · 实施成本 3 周 · 预期 wr 53-58% · 月 ROI 2-4% · 大量场次

## §1 元逻辑

```
本质 · "LeBron 今天得分 ≥ 28.5" · 二元 over/under
       球员表现 = 对位强度 + 使用率 + 近期状态 + 节奏
不是预测 · 是
  · 用 prior season + 近 10 场加权
  · 对位调整 (vs 该队均值) 
  · 主客场 factor
```

## §2 数学骨架

```
P(Player_score ≥ X) = N((μ - X) / σ)

μ = 0.4 × season_avg + 0.6 × last_10_games_avg + 主客场调整 + 对位调整

σ_player ≈ 球员历史得分标准差 (从 last 30 games)
        平均值 (NBA 主力) σ ≈ 6-8 分
```

```
对位调整 ·
  defender_DRTG = 该位置防守评分
  league_avg_DRTG = 110
  μ_adj = μ × (1 - 0.05 × (defender_DRTG - 110) / 10)
```

## §3 数据源

| 数据 | 源 | 成本 |
|---|---|---|
| NBA 球员 box scores | nba.com/stats API (公开) | 免费 |
| NFL stats | ESPN API | 免费 |
| 球员位置 / DRTG | basketball-reference.com 抓 | 免费 |
| 上场时间 / minutes | rotowire (公开) | 免费 |
| Kalshi player props | KXNBAPLAYER* | 免费 |

## §4 信号子源

```
4.1 球员状态 (μ-X)/σ 计算
4.2 对位强度调整
4.3 minutes alert (休息 / 限制)
4.4 反公众 · 球星 over 普遍 over-bet · 反向押 under
```

## §5 入「百川」融合

```
信号               准确率   权重
状态对比           54%      中 (0.5)
对位调整           53%      低 (0.3)
休息 minutes 警    62%      高 (1.0) · 但触发稀
反公众 over        53%      低 (0.3)
```

## §6 实施 (3 周)

```
W1 · 数据 pipeline · NBA stats / box scores 拉
W2 · 球员评分 + 对位逻辑
W3 · paper 跑 + 校准
```

## §7 期望 EV

```
NBA 单赛季 · 每场约 5-10 个 player prop 市场 · 全季 ~80 场
月触发约 100 单
per trade $3 · wr 54% · EV ≈ +$0.12
- 抽水 0.10 = +$0.02 per trade
月 EV ≈ $2 · 太低 · 单赛道不值得

但 · 信息成本低 · 是练手好赛道
```

## §8 失败模式

```
1. 球员临时缺阵 (game-time decision)
   防 · cron 检最后 30min · 缺阵 → 立即平仓

2. 对位数据失真 (新阵容)
   防 · season-long 数据 + 30 天 rolling 加权
```
