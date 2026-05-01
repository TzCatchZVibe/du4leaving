# 14 · Polymarket 加密原生 · meme + crypto-native

> Tier 3 · 实施成本 2 周 · 预期 wr 52-58% · 月 ROI 1-3%

## §1 元逻辑

```
本质 · Polymarket 独有市场 (e.g. "Trump 一周内 tweet X 次")
       Kalshi 没有 · 难跨平台套利
       crypto-native · 跟 crypto Twitter 文化深度耦合
跟鲸鱼 + meme sentiment 为主
```

## §2 数学骨架

```
对 meme / crypto-native 类 ·
  P = 0.5 × whale_consensus + 0.3 × twitter_sentiment + 0.2 × base_rate

twitter_sentiment · Hermes 405B 解析关键词 + 量化
base_rate · 同类历史事件
```

## §3 数据源

| 数据 | 源 | 成本 |
|---|---|---|
| Polymarket 全市场 | gamma-api | 免费 |
| Polymarket 鲸鱼 | dune 公开 dashboard | 免费 |
| Twitter (X) sentiment | twitter API (有限免费) 或 Reddit | 免费 |

## §4 信号

```
4.1 鲸鱼跟单
4.2 Twitter / Reddit sentiment
4.3 历史频率 (e.g. tweet 速度)
```

## §5 实施 (2 周)

```
W1 · Polymarket 鲸鱼 wr 计算 (复用 §02)
W2 · Twitter / Reddit RSS + LLM
```

## §6 期望 EV

```
触发率 · 5-15 单/周
per trade $3 · wr 55% · EV ≈ +$0.30
扣 Polymarket 抽水 (≈2%) = +$0.24

月 EV ≈ +$10 · 2.5%/月

优势 · 信号正交于 Kalshi 主流品类 · 进百川提供独立性
```
