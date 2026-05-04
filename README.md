# du4leaving

TZ 个人 prediction market + sports betting + Kalshi 主仓。

**这不属于 CatchZVibe Studio LLC** — 是 TZ 私人项目。

---

## 🔄 PIVOT · 2026-05-03 · 个人理财平台

**新定位** · TZ 个人财务管理 + 净值跟踪 + 加密 DCA · 不做赌博 / 主动投注

**为什么 pivot** ·
- 30 天 Kalshi manual 战绩 · 142 单 · WR 21% · ROI -49.8% · 亏 $584
- 9 信号源中 5 个长期沉默 · auto cron alpha 概率低
- 主动投注 · 数据上不工作 · 心理上磨人
- Z-Wealth (个人财务) 设计早就有 · 单纯实用 · 没赌博风险

**新范围** ·
- ✓ 模块 5 · 净值跟踪 + SimpleFIN 银行 + 月度 Wrapped (W3-4)
- ✓ 模块 2 · Coinbase DCA (定投 · 不主动 swing) (W5-6)
- ✓ 模块 0 · 跨账户 dashboard /钱 (W7-8)
- ✓ 模块 6 · 税务汇总 · CSV 导出 (W10+)
- ✗ 模块 1 · Kalshi 主动投注 → archived (代码留)
- ✗ 模块 4 · 体育博彩 · 不做
- ✗ Telegram /推荐 /提议 等 co-pilot · 不做 (没赌就不用)

**已停操作** ·
- ✗ Vercel cron 全部清空 (vercel.json crons = [])
- ✗ 本地 launchd kalshi-sync 关 (不再同步 Kalshi)
- ✓ Telegram bot 保留 · 用作通知 (净值变化 / Wrapped 月报)
- ✓ Supabase paper_picks 保留 · 转为净值历史表

**复活条件** · 未来 Kalshi 模块若有客观证据有 +EV · 重新评估

---

## 隔离边界
- 主体: TZ 个人 (非 LLC)
- czv 工作室成员看不到此 repo
- DB: 独立 supabase project (待 TZ 切)
- Vercel: 独立 project (待 TZ link)

## 模块
- xiapan (虾盘) — Kalshi + Polymarket trading bot
- 4 agent (laohu/yazi/suanpan + sage)
- intel (whale tracking · digest)

## 来源
2026-05-01 从 catchzvibe 分仓 (commit 7c2ae3d 之前混在 czv 工作室仓里 · 现独立)
