// /api/xiapan/baichuan/tutorial
// V0.72 W3 Day 7 · /tutorial Telegram 命令推手机使用教程
// 多消息分页 · ASCII + emoji 图文并茂

import { NextResponse } from "next/server";
import { sendTelegramMessage, tgEnabled } from "@/lib/xiapan/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Page {
  title: string;
  body: string;
}

const PAGES: Page[] = [
  // 1
  {
    title: "📖 百川 v1.0 · 一图入门",
    body: `🌊 百川 = 14 信号源 → 双池仓位 → 真钱

┌──────────────────────────┐
│   🏦 本金 $400 (P0 红线)  │
└──────────────────────────┘
       ↓ 90/10 起步
   ┌───┴────┐
   ▼        ▼
┌─────┐  ┌─────┐
│  S  │  │  C  │
│稳赚 │  │凸性 │
│$360 │  │ $40 │
└──┬──┘  └──┬──┘
   │        │
   ▼        ▼
13 sources / 2 sources

⚙️ 全自动 · 你不参与日常
📊 Telegram 24 命令 · 看就行
💰 月底自动 hurdle + 阶梯 cashout`,
  },
  // 2
  {
    title: "🚀 第 1 步 · 初始化",
    body: `三命令搞定 ·

1️⃣ /pools_init 400
   注入本金 $400
   90% 进 S 池 ($360)
   10% 进 C 池 ($40)
   只做 1 次 · 不能反悔

2️⃣ /health
   看 7 项检查 · 全 ✓ 才安心
   ✓ pools 已 init
   ✓ btc-edges 通
   ✓ weather-edges 通
   ✓ fusion 数学对
   ...

3️⃣ /pools
   再确认一次 ·
   P0 $400 (红线)
   S $360 / C $40
   total $400 / circuit running

✅ 完成 · 系统自动开跑`,
  },
  // 3
  {
    title: "📡 14 信号源 · 命令速查",
    body: `加密 (S 池 · 自动套利)
  /btc 📈
  /eth 💎
  /sol 🚀

天气 (S 池 · 双源最准)
  /weather 🌤

体育 (S 池)
  /nba 🏀
  /nba_refresh 🔄  拉新 538 数据

经济 (S 池)
  /fed 🏛  FOMC/CPI/Jobs/GDP

通用 (S 池)
  /contrarian 🔄  反公众

凸性 (C 池 · 高 EV 长尾)
  /fda 💊  AdCom 投票
  /mention 🎤  名人发言

★ = 强信号 (有触发)
· = 中等
○ = 跳过`,
  },
  // 4
  {
    title: "📊 监控命令 · 看效果",
    body: `每天看 (5 min)
  /pools     看 P0/S/C 三层
  /review    综合表现 + 各 source 归因
  /health    系统全绿?

每周日看 (10 min · 周报已自动 push)
  /clv       策略真假金标准
             alpha+ = 真有 alpha
             alpha- = 方向错 · 复盘
  /brier     看权重已调
  /backtest  网格搜参 · 当前 vs 最优

每月 1 号看 (push 自动到)
  · 月度结算报表 (S 超 hurdle 转 C)
  · /review 月度归因
  · 决定 cashout 多少 (30/50/70 by 规模)

操作命令 (按需)
  /settle  手动拉一次结算
  /状态    Mac mini + cron 状态
  /digest  今日早间简报`,
  },
  // 5
  {
    title: "💰 真钱启用 · 7 项 checklist",
    body: `paper 满 30 单后 · 看这 7 项 ·

☑️ paper ≥ 30 已平仓
☑️ wr ≥ 53%
☑️ avg CLV ≥ 0.5pp
☑️ Brier 跑过 ≥ 1 周
☑️ /health 全绿连续 7 天
☑️ 没出现 -8% 单日 drawdown
☑️ S 池实际 vs P0 偏离 < 5%

7 全过 → 启用真钱 ·

1. Kalshi 网站 → Settings → API
   创 RSA key pair · 下载 .pem

2. 上传到 mini ·
   scp private.pem mini:~/.kalshi/

3. .env.local 加 ·
   LIVE_TRADING=true
   KALSHI_API_KEY_ID=<UUID>
   KALSHI_PRIVATE_KEY_PATH=~/.kalshi/private.pem

4. 重启 next-dev

5. /live 验证 · 应 ✓

6. 单笔 $5 起 · 日上限 $50 (硬写死)
   头 7 天 · 单笔不上调

任一 fail · paper 继续打磨`,
  },
  // 6
  {
    title: "🚨 紧急止损 · 三种",
    body: `🟡 系统自动 (你不用管)
   S -5% 月内 → C 桶暂停 1 月
   S -15% 月内 → 全停 7 天
   总仓 < P0 × 0.85 → 红线 · 全停

🟠 你手动暂停 (paper 仍跑 · 真钱关)
   ssh mini · 改 .env.local ·
   LIVE_TRADING=false

🔴 物理急停 (极端情况)
   ssh mini · sudo shutdown -h now

😎 大多数时间不需要急停
   架构有自适应熔断
   单笔上限 1.4% × bankroll
   日 exposure ≤ 6%
   信号 Brier > 0.40 自动退役`,
  },
  // 7
  {
    title: "🎯 月度 KPI · 自评表",
    body: `每月看 /review 30 ·

🟢 绿灯 (一切顺利)
   ✓ wr ≥ 53%
   ✓ CLV ≥ +0.5pp
   ✓ S 池月化 ≥ 4%
   ✓ drawdown ≤ 10%
   ✓ ≥ 5 sources verdict 是 alpha+/neutral
   → bankroll 月底翻一档

🟡 黄灯 (需要调)
   △ wr 50-53%
   △ CLV 0~+0.5pp
   △ S 池月化 0-4%
   → /backtest 看是否调阈值能改善

🔴 红灯 (停下复盘)
   ✗ wr < 50%
   ✗ CLV < 0
   ✗ S 池月化 < 0
   ✗ drawdown > 15%
   → 暂停 paper · MIN_SCORE=99 临时关
   → 退役 alpha- 信号
   → 联系我重新分析`,
  },
  // 8
  {
    title: "🔧 故障排查",
    body: `❓ /health 红 (任何 ✗)
1. 看哪一项 ✗
2. btc/weather 慢 → API 抖 · 等 5min
3. pools 红 → 文件损 · ssh mini 看 ~/.du4leaving/百川/pools.json
4. fusion 红 → 代码 bug · 联系我

❓ /pools S 跌得快
1. /clv 是不是 alpha-
2. /brier 看哪信号退役
3. /pools circuit_state ·
   "paused_C" 正常 (S -5% 触发)
   "paused_all" 严重 (-15%)
   "red_line" 紧急 (P0 × 0.85)

❓ paper 一直不平仓
1. /settle 手动拉
2. ticker 是否过期
3. 看 lessons.jsonl actual 是否 null

❓ Telegram 不回
1. cloudflared tunnel 还在?
   ssh mini 'pgrep -lf cloudflared'
2. webhook 还在?
   curl bot/getWebhookInfo
3. trycloudflare URL 变 → 重 setWebhook

📚 完整手册 · ~/du4leaving/docs/百川引擎/Quick-Start.md`,
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chat_id") ?? process.env.TELEGRAM_CHAT_ID ?? "";
  const which = url.searchParams.get("page");

  if (!tgEnabled() || !chatId) {
    return NextResponse.json({
      ok: false,
      error: "TG not enabled or no chat_id",
      pages: PAGES,
    });
  }

  // 单页模式 · /tutorial 1 等
  if (which) {
    const idx = parseInt(which, 10) - 1;
    if (idx < 0 || idx >= PAGES.length) {
      return NextResponse.json({ ok: false, error: "page out of range" });
    }
    const p = PAGES[idx];
    await sendTelegramMessage(`${p.title}\n${"─".repeat(20)}\n\n${p.body}`, {
      chatId,
      parseMode: undefined,
    });
    return NextResponse.json({ ok: true, sent: 1 });
  }

  // 全部 · 间隔 1.5 秒推
  let sent = 0;
  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    const header = `${p.title}\n${"─".repeat(22)}\n\n`;
    const footer = `\n\n📄 ${i + 1} / ${PAGES.length}`;
    await sendTelegramMessage(header + p.body + footer, {
      chatId,
      parseMode: undefined,
    });
    sent++;
    if (i < PAGES.length - 1) await new Promise((r) => setTimeout(r, 1500));
  }

  return NextResponse.json({ ok: true, sent, total: PAGES.length });
}
