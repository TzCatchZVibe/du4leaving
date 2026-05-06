// /api/xiapan/telegram/webhook
// V0.71 · Telegram bot 入口 · 你发文字给 bot → 走 Hermes sage → 回你
//
// 设置 ·
//   1. .env.local · TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID + TELEGRAM_WEBHOOK_SECRET
//   2. 暴露给 Telegram (Tailscale 不行 · TG 要从公网访问) ·
//      a) ngrok http 3001 · 拿 https URL
//      b) 或部署到 Vercel/Cloudflare · 用其域名
//   3. 注册 webhook ·
//      curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/xiapan/telegram/webhook&secret_token=<SECRET>"
//   4. 测 · TG 发消息 给 bot · 应自动收到回复

import { NextResponse } from "next/server";
import { sendTelegramMessage, tgEnabled } from "@/lib/xiapan/telegram";
import { callLaoxia } from "@/lib/laoxia/agent";
import { setVoiceMode, clearMemory } from "@/lib/laoxia/memory";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface TgUpdate {
  message?: {
    message_id?: number;
    from?: { id?: number; username?: string; first_name?: string };
    chat?: { id?: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id?: number; username?: string };
    message?: { message_id?: number; chat?: { id?: number } };
    data?: string;
  };
}

// W4 终极 · 老虾 agent 接管 fallback · Theo 押注顾问已退役

// V0.73 W1 Day 4 · 跨环境 base URL · Vercel 用 host header · 本地 fallback :3001
function getBaseUrl(req: Request): string {
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3001";
}

export async function POST(req: Request) {
  const BASE = getBaseUrl(req);
  // 验 secret · TG setWebhook 时配的 secret_token 会塞 header
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (got !== expected) {
      return NextResponse.json({ ok: false, error: "bad secret" }, { status: 401 });
    }
  }

  let update: TgUpdate;
  try { update = (await req.json()) as TgUpdate; }
  catch { return NextResponse.json({ ok: true, skipped: "bad json" }); }

  // V0.73 W1 Day 4 · D 模式 · callback_query 处理 · inline 按钮回调
  const cbq = update.callback_query;
  if (cbq && cbq.data) {
    const allowedChatId = process.env.TELEGRAM_CHAT_ID;
    const cbChatId = cbq.message?.chat?.id;
    if (allowedChatId && cbChatId && String(cbChatId) !== allowedChatId) {
      return NextResponse.json({ ok: true, skipped: "unauthorized callback" });
    }
    const m = cbq.data.match(/^(confirm|reject)_([\w]+)$/);
    if (!m) {
      return NextResponse.json({ ok: true, skipped: "bad callback_data" });
    }
    const action = m[1];
    const id = m[2];
    try {
      const r = await fetch(`${BASE}/api/xiapan/baichuan/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      }).then((r) => r.json());
      const reply = r.ok
        ? (action === "confirm"
            ? `✓ 已确认 · 下次 cron 真下单 · id ${id}`
            : `✗ 已拒绝 · id ${id}`)
        : `✗ ${r.error || "处理失败"}`;
      if (cbChatId) await sendTelegramMessage(reply, { chatId: String(cbChatId), parseMode: undefined });
      // 关 callback (telegram 要求 answer)
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cbq.id, text: action === "confirm" ? "已确认" : "已拒绝" }),
        });
      }
    } catch (e) {
      console.error("callback handler 失败 ·", (e as Error).message);
    }
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (!msg || !msg.text || !msg.chat?.id) {
    return NextResponse.json({ ok: true, skipped: "no message" });
  }

  // 鉴权 · 只回 TELEGRAM_CHAT_ID
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (allowedChatId && String(msg.chat.id) !== allowedChatId) {
    return NextResponse.json({ ok: true, skipped: "unauthorized chat" });
  }

  const text = msg.text.trim();
  const chatId = String(msg.chat.id);

  // V0.72 W3 Day 11 · Telegram 降级到 SMS · 游戏在 macOS app
  if (text.startsWith("/start") || text === "/help" || text === "/帮") {
    await sendTelegramMessage(
      "我是老虾 · TZ 的私人理财搭子\n" +
      "你想啥就发啥 · 不用记命令\n" +
      "─────────────────────────────────\n\n" +
      "比如试试 ·\n" +
      "  · 「看下罐子」「钱够不够」「本周怎么样」\n" +
      "  · 「我刚 doordash $30」「我想买个 $200 麦」\n" +
      "  · 「目标进度」「下面要付什么」\n\n" +
      "命令 (隐形 · 我内部用)·\n" +
      "  /狠 · 切狠虾模式 (默认温柔)\n" +
      "  /忘 · 清记忆重来\n" +
      "  /等等 · /确认 · /取消 · 24h lockdown\n" +
      "  /导出 · CSV\n\n" +
      "自动 push ·\n" +
      "  早 9am · 一句开局\n" +
      "  晚 9pm · 一句晚问\n" +
      "  大单 ≥ $20 · 24h 冷静期提醒\n" +
      "  支出异常 / 罐子触发 / 周日 9pm 周报\n\n" +
      "工作 / HG / 内容 → 走 Lark CZV-OS · 不在这",
      { chatId, parseMode: undefined }
    );
    return NextResponse.json({ ok: true });
  }

  // 老虾人格切换 · /狠 /savage · /温柔 /warm · /忘 /forget
  if (text === "/狠" || text === "/savage" || text === "/狠虾") {
    await setVoiceMode(chatId, "savage");
    await sendTelegramMessage("✓ 切狠虾模式 · 别后悔\n切回 · /温柔", { chatId, parseMode: undefined });
    return NextResponse.json({ ok: true });
  }
  if (text === "/温柔" || text === "/warm" || text === "/温柔虾") {
    await setVoiceMode(chatId, "warm");
    await sendTelegramMessage("✓ 切回温柔虾", { chatId, parseMode: undefined });
    return NextResponse.json({ ok: true });
  }
  if (text === "/忘" || text === "/忘记" || text === "/forget" || text === "/clear") {
    await clearMemory(chatId);
    await sendTelegramMessage("✓ 老虾记忆清空 · 重新认识你", { chatId, parseMode: undefined });
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 8 · /钱 · 一屏全
  if (text === "/钱" || text === "/money") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/money").then(r => r.json());
      if (!r.initialized) {
        await sendTelegramMessage(`◧ ${r.message}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const p = r.pools;
      const t = r.today;
      const live = r.live;
      const sign = (v: number) => v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
      const lines = [
        `${live.enabled ? "🔴 真钱" : "📋 paper"}  ${p.circuit === "running" ? "✓" : "△ " + p.circuit}`,
        ``,
        `P0 $${p.P0.toFixed(0)} (红线 $${p.red_line.toFixed(0)})`,
        `S 池 $${p.S.toFixed(2)} · C 池 $${p.C.toFixed(2)}`,
        `总 $${p.total.toFixed(2)} · ${p.total_vs_P0_pct >= 0 ? "+" : ""}${p.total_vs_P0_pct.toFixed(1)}%`,
        ``,
        `今日 · 下 ${t.placed} · 平 ${t.closed} · 持 ${t.open} · ${sign(t.pnl)}`,
      ];
      if (r.recent_5 && r.recent_5.length > 0) {
        lines.push(``, `最近 5 笔 ·`);
        for (const l of r.recent_5) {
          const tickerShort = l.ticker.length > 28 ? l.ticker.slice(0, 28) + ".." : l.ticker;
          const pnlStr = l.pnl !== null && l.pnl !== undefined ? sign(l.pnl) : "持";
          lines.push(`  ${l.status} ${l.ts} ${l.bucket==="convex"?"C":"S"} ${l.side==="yes"?"+":"-"}${tickerShort} $${l.stake.toFixed(2)} ${pnlStr}`);
        }
      }
      if (r.lifetime.cashout > 0 || r.lifetime.reinvest > 0) {
        lines.push(``, `历史 cashout $${r.lifetime.cashout.toFixed(2)} · reinvest $${r.lifetime.reinvest.toFixed(2)}`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /目标更新 <slug> <金额> · 设目标当前累积值 (绿卡 / EP 等)
  if (text.startsWith("/目标更新") || text.startsWith("/goal_set") || text.startsWith("/goal ")) {
    const arg = text.replace(/^\/(目标更新|goal_set|goal)\s*/, "").trim();
    const m = arg.match(/^(\S+)\s+(\d+(?:\.\d+)?)$/);
    if (!m) {
      await sendTelegramMessage(
        "用法 · /目标更新 <slug> <金额>\n例 · /目标更新 ep-record 500\n例 · /目标更新 greencard 1200\n看所有目标 slug · /目标",
        { chatId, parseMode: undefined }
      );
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch(`${BASE}/api/wealth/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: m[1], current_usd: parseFloat(m[2]) }),
      }).then(r => r.json());
      if (!r.ok || !r.goal) {
        await sendTelegramMessage(`✗ ${r.error || "找不到 goal · 检查 slug"}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const g = r.goal;
      const pct = ((Number(g.current_usd) / Number(g.target_usd)) * 100).toFixed(0);
      await sendTelegramMessage(
        `✓ ${g.emoji} ${g.name} · $${parseFloat(m[2]).toFixed(0)} / $${Number(g.target_usd).toFixed(0)} · ${pct}%`,
        { chatId, parseMode: undefined }
      );
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /复盘 · 周报 (A · 改 weekly · 不再月报) · 默认本周 · 数字 = 周 offset
  if (text.startsWith("/复盘") || text.startsWith("/wrapped") || text.startsWith("/周报")) {
    const arg = text.replace(/^\/(复盘|wrapped|周报|月报)\s*/, "").trim();
    let offset = 0;
    if (arg) {
      const n = parseInt(arg);
      if (!isNaN(n)) offset = n;
    }
    try {
      const r = await fetch(`${BASE}/api/wealth/weekly?offset=${offset}`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `📊 周报 · ${r.week_label}`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        r.narrative,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `💼 收入 $${r.income.real_total.toFixed(0)}`,
        `   HG $${r.income.hg.toFixed(0)} · CZV $${r.income.czv.toFixed(0)}`,
        ``,
        `💸 支出 $${r.spending.total_out.toFixed(0)} · 日均 $${r.spending.daily_avg.toFixed(0)}`,
        `   vs 上周 · ${r.spending.delta_vs_prior_week_pct >= 0 ? "+" : ""}${r.spending.delta_vs_prior_week_pct}%`,
      ];
      for (const c of r.spending.top_3_categories || []) {
        lines.push(`   ${c.emoji} ${c.cat} $${c.total.toFixed(0)}`);
      }
      lines.push(``, `🔮 14 天 cashflow`);
      lines.push(`   bill 预测 · $${r.cashflow.bills_next_14d}`);
      lines.push(`   现金 · $${r.cashflow.cash_now}`);
      lines.push(`   ${r.cashflow.gap >= 0 ? "✓ 安全 · 余 $" + r.cashflow.gap : "⚠ 缺 $" + Math.abs(r.cashflow.gap)}`);
      lines.push(``, `🎯 目标速度`);
      for (const g of r.goals_velocity || []) {
        const status = g.on_track ? "✓ 在轨" : `⚠ +$${g.extra_needed_per_month}/月`;
        lines.push(`   ${g.emoji} ${g.name} ${g.pct}% · ${status}`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /复盘 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /工资 /HG /income · 本月工资 + 奖金 + CZV 营收
  if (text.startsWith("/工资") || text.startsWith("/HG") || text.startsWith("/hg") || text.startsWith("/income") || text.startsWith("/月薪")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/income`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const tm = r.this_month;
      const lm = r.last_month;
      const sign = (v: number) => v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
      const statusEmoji = {
        below_base: "🚨",
        base_only: "⚠️",
        with_bonus: "✓",
        above_normal: "⭐",
      }[tm.hg_status as string] || "·";
      const lines = [
        `💼 收入 · 本月 ${tm.month_start.slice(0, 7)}`,
        ``,
        `── HG (主收入 · base $${tm.hg_target}) ──`,
        `${statusEmoji} HG · $${tm.hg_total.toFixed(2)} · ${tm.hg_count} 笔 · ${tm.hg_vs_base_pct}% of base`,
        `奖金区间 · $${tm.hg_bonus_low}-${tm.hg_bonus_high}`,
        ``,
        `── CZV 工作室独立营收 ──`,
        `🏪 CZV · $${tm.czv_total.toFixed(2)} · ${tm.czv_count} 笔`,
        ``,
        `── 其他 / 利息 ──`,
        `📥 其他 · $${tm.other_total.toFixed(2)}`,
        `↔ 转账 (内部 · 不算) · $${tm.transfer_total.toFixed(2)}`,
        ``,
        `═══════════════`,
        `本月真收入 · $${tm.total_real_income.toFixed(2)}`,
        `vs 上月 · ${sign(tm.total_real_income - lm.total_real_income)}`,
        ``,
        `── 本月所有进账 ──`,
      ];
      for (const t of tm.by_tx.slice(0, 8)) {
        const e = t.source === "hg" ? "💼" : t.source === "czv" ? "🏪" : t.source === "transfer" ? "↔" : t.source === "interest" ? "📈" : "•";
        lines.push(`${e} ${t.date} · $${t.amount.toFixed(2)} · ${t.desc.slice(0, 35)}`);
      }
      lines.push(``);
      lines.push(`📌 状态 · ${tm.hg_status === "below_base" ? "🚨 HG 工资低于 base · 联系老板" : tm.hg_status === "base_only" ? "⚠️ 没奖金 · 看上月趋势" : tm.hg_status === "with_bonus" ? "✓ 正常 base + 奖金" : "⭐ 高于平均 · 加薪了?"}`);
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /工资 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /账单 /burn · 本月烧钱速度 + 分类
  if (text.startsWith("/账单") || text.startsWith("/burn") || text.startsWith("/花了")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/burn`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}\n\n如果是 SimpleFIN · 检查 .env 是否设了 token`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const sign = (v: number) => v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
      const lines = [
        `💸 本月烧钱速度`,
        ``,
        `── 总览 ──`,
        `收 ${sign(r.total_in)}`,
        `花 -$${r.total_out.toFixed(2)}`,
        `净 ${sign(r.net)}`,
        ``,
        `── burn rate ──`,
        `日均 $${r.daily_avg_burn.toFixed(2)}/天`,
        `已过 ${r.days_passed}/${r.days_in_month} 天`,
        `按这速度 · 月 burn $${r.projected_month_burn.toFixed(2)}`,
        ``,
        `── 哪花了 (top 8) ──`,
      ];
      for (const c of r.by_category.slice(0, 8)) {
        lines.push(`${c.emoji} ${c.cat.padEnd(15)} ${c.count} 次 · $${c.total_usd.toFixed(0)}`);
      }
      lines.push(``);
      lines.push(`── 最大 5 单支出 ──`);
      for (const e of r.top_5_expenses) {
        lines.push(`${e.emoji} ${e.date} · $${e.amount.toFixed(0)} · ${e.desc.slice(0, 30)}`);
      }
      lines.push(``);
      lines.push(`📊 ${r.txs_count} 笔交易 · 来自 SimpleFIN 真银行`);
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /账单 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /异常 /anomaly · D · 类目异常 (本周 +50% vs 4 周均)
  if (text.startsWith("/异常") || text.startsWith("/anomaly") || text.startsWith("/spike")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/anomaly`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `📊 类目异常 · ${r.window_start} ~ ${r.window_end}`,
        `本周 $${r.this_week_total.toFixed(0)} vs 4 周均 $${r.prior_4w_weekly_avg.toFixed(0)}`,
        ``,
      ];
      if (r.anomalies.length === 0) {
        lines.push(`✓ 没异常 · 类目消费稳定`);
      } else {
        for (const a of r.anomalies) {
          const pct = a.delta_pct === 999 ? "新出现" : `+${a.delta_pct}%`;
          lines.push(`${a.emoji} ${a.cat} · $${a.this_week_total.toFixed(0)} (${pct} · 多 $${a.delta_usd.toFixed(0)})`);
        }
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /异常 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /罐 /jar · ① Guilty Pleasure · 看罐子状态
  if (text === "/罐" || text === "/jar" || text === "/jars") {
    try {
      const r = await fetch(`${BASE}/api/wealth/jar`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `🎤 Guilty Pleasure 罐`,
        `每次内疚消费 · 等额计入对应目标`,
        ``,
      ];
      if (!r.jars?.length) {
        lines.push("(还没罐 · 跑 00013 SQL 默认建好 ep-jar / greencard-jar)");
      } else {
        for (const j of r.jars) {
          lines.push(`${j.emoji} ${j.name}`);
          lines.push(`   $${j.balance_usd.toFixed(0)}${j.target_goal_slug ? ` → ${j.target_goal_slug}` : ""}`);
          lines.push(``);
        }
      }
      lines.push(`手动扫一遍 · /罐扫`);
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /罐 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /罐扫 · 触发 guilty check (按需)
  if (text === "/罐扫" || text === "/jarcheck" || text === "/罐扫描") {
    try {
      const r = await fetch(`${BASE}/api/wealth/jar/check?days=14`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [`✓ 扫完 · 14 天回溯`, `扫描 ${r.scanned} 笔 · 新触发 ${r.new_events} 笔`, ``];
      if (r.events.length === 0) {
        lines.push(`(没匹配规则的花费 · 这是好事)`);
      } else {
        for (const e of r.events.slice(0, 8)) {
          lines.push(`+ $${e.jar_credit} → ${e.jar_slug}`);
          lines.push(`   ${e.tx_date} · ${e.tx_desc.slice(0, 30)}`);
        }
      }
      lines.push(``, `罐子现状 ·`);
      for (const j of r.jars_after) {
        lines.push(`${j.emoji} $${j.balance_usd.toFixed(0)} · ${j.name}`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /罐扫 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /钱龄 /aom · ③ Age of Money · 签证缓冲指标
  if (text === "/钱龄" || text === "/aom" || text === "/age" || text === "/缓冲") {
    try {
      const r = await fetch(`${BASE}/api/wealth/age-of-money`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const statusEmoji = { thick: "🛡", ok: "✓", thin: "⚠", danger: "🚨" }[r.status as string] || "·";
      const statusZh = { thick: "厚 · 安全", ok: "尚可", thin: "薄了 · 注意", danger: "危险 · 立刻调整" }[r.status as string] || "";
      const lines = [
        `🛡 钱龄 · ${r.age_days} 天`,
        ``,
        `${statusEmoji} ${statusZh}`,
        ``,
        `现金 · $${r.cash_now.toFixed(0)}`,
        `日均 · $${r.daily_burn.toFixed(0)}`,
        ``,
        `钱龄 = 现金 / 日均花 · 越大缓冲越厚`,
        `< 30 天 = 签证 / EB-1A 准备金告急`,
      ];
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /钱龄 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /大坑 /lumpy · ② YNAB True Expenses · 大坑摊月
  if (text === "/大坑" || text === "/lumpy" || text === "/真支出") {
    try {
      const r = await fetch(`${BASE}/api/wealth/lumpy`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `⚠️ 大坑 · 提前摊月 · 不被吓到`,
        ``,
        `每月需留 · $${r.monthly_total_needed.toFixed(0)}`,
        `总剩 · $${r.total_remaining.toFixed(0)}`,
        ``,
      ];
      for (const i of r.items) {
        const bar = "▰".repeat(Math.floor(i.pct_paid / 10)) + "▱".repeat(10 - Math.floor(i.pct_paid / 10));
        lines.push(`${i.emoji} ${i.name}`);
        lines.push(`   ${bar} ${i.pct_paid}%`);
        lines.push(`   $${i.paid_usd}/$${i.total_usd} · 剩 $${i.remaining_usd}`);
        if (i.due_date) {
          lines.push(`   ${i.due_date} · 月需 $${i.monthly_save_needed.toFixed(0)}`);
        }
        lines.push(``);
      }
      lines.push(`已付更新 · /大坑付 <slug> <金额>`);
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /大坑 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /大坑付 <slug> <金额>
  if (text.startsWith("/大坑付") || text.startsWith("/lumpy_paid")) {
    const arg = text.replace(/^\/(大坑付|lumpy_paid)\s*/, "").trim();
    const m = arg.match(/^(\S+)\s+(\d+(?:\.\d+)?)$/);
    if (!m) {
      await sendTelegramMessage("用法 · /大坑付 <slug> <已付金额>\n例 · /大坑付 ep-gear-physical 500", { chatId, parseMode: undefined });
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch(`${BASE}/api/wealth/lumpy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: m[1], paid_usd: parseFloat(m[2]) }),
      }).then(r => r.json());
      if (!r.ok || !r.lumpy) {
        await sendTelegramMessage(`✗ ${r.error || "找不到"}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      await sendTelegramMessage(`✓ ${r.lumpy.name} · 已付 $${r.lumpy.paid_usd}/$${r.lumpy.total_usd}`, { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /翻译 <金额> · ⑥ provocation · $30 = N HG 小时 + EP 推 N 天
  if (text.startsWith("/翻译") || text.startsWith("/tr ") || text.startsWith("/translate")) {
    const arg = text.replace(/^\/(翻译|tr|translate)\s*\$?/, "").trim();
    const amount = parseFloat(arg);
    if (!amount || amount <= 0) {
      await sendTelegramMessage("用法 · /翻译 <金额>\n例 · /翻译 30\n例 · /翻译 584", { chatId, parseMode: undefined });
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch(`${BASE}/api/wealth/translate?amount=${amount}`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `💵 $${amount} 不只是 $${amount}`,
        ``,
      ];
      for (const t of r.translations) {
        lines.push(`${t.emoji} ${t.name} · ${t.description}`);
      }
      lines.push(``, `下次花前 · 想想这个`);
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /翻译 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /钱要 /cashflow · B · 14 天 bill vs cash 现金流预测
  if (text.startsWith("/钱要") || text.startsWith("/cashflow") || text.startsWith("/现金流")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/cashflow?horizon=14`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `🔮 14 天现金流`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `bill 预测 · $${r.bills_total.toFixed(0)}`,
        `现金 (checking + savings) · $${r.cash_now.toFixed(0)}`,
        ``,
        r.gap >= 0
          ? `✓ 安全 · 余 $${r.gap.toFixed(0)}`
          : `⚠ 缺口 · -$${Math.abs(r.gap).toFixed(0)}`,
        ``,
      ];
      if (r.bills.length === 0) {
        lines.push(`(60 天内没检测到 recurring · 数据不够 · 等几周再来)`);
      } else {
        lines.push(`────── 待付清单 ──────`);
        for (const b of r.bills) {
          lines.push(`${b.date} · ${b.emoji} $${b.amount.toFixed(0)} · ${b.desc}`);
        }
      }
      lines.push(``, `检测出 ${r.total_recurring_detected} 个周期账单`);
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /钱要 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /等等 <金额> <描述> · 阶段 1 #4 · 冲动 lockdown · 24h 冷静
  if (text.startsWith("/等等") || text.startsWith("/wait ") || text.startsWith("/等 ")) {
    const arg = text.replace(/^\/(等等|wait|等)\s*/, "").trim();
    const m = arg.match(/^\$?(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) {
      await sendTelegramMessage(
        "用法 · /等等 <金额> <描述>\n例 · /等等 80 PDD 想买的衣服\n例 · /等等 50 ATP 想押的 BUDVIR\n\n大单 ≥ $20 · 24h 后系统问 · 多数时候你不要了 · 省钱",
        { chatId, parseMode: undefined }
      );
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch(`${BASE}/api/wealth/lockdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_usd: parseFloat(m[1]), description: m[2] }),
      }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const p = r.pending;
      const hours = p.cooldown_hours;
      const lines = [
        `⏸ 已记 · ${hours}h 冷静`,
        ``,
        `${p.description}`,
        `$${Number(p.amount_usd).toFixed(2)} · ${p.category}`,
        `id · ${p.short_id}`,
        ``,
        `${hours}h 后 · 我会 push 你 · 还要再确认`,
        `想立刻确认 · /确认 ${p.short_id}`,
        `不想要了 · /取消 ${p.short_id}`,
        ``,
        `💡 80% 概率你 24h 后不想要了`,
      ];
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /确认 <short_id> · 决定要 (approved · 你去 spend)
  if (text.startsWith("/确认") || text.startsWith("/approve")) {
    const sid = text.replace(/^\/(确认|approve)\s*/, "").trim();
    if (!sid) {
      await sendTelegramMessage("用法 · /确认 <id>\n看 pending · /待办", { chatId, parseMode: undefined });
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch(`${BASE}/api/wealth/lockdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ short_id: sid, decision: "approved" }),
      }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      await sendTelegramMessage(
        `✓ 确认 · 去花吧 · $${Number(r.item.amount_usd).toFixed(2)} · ${r.item.description}\n记 · 这单是你 ${r.item.cooldown_hours}h 后还想要的 · 不冲动`,
        { chatId, parseMode: undefined }
      );
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /取消 <short_id> · 不要了 · 省钱
  if (text.startsWith("/取消") || text.startsWith("/cancel")) {
    const sid = text.replace(/^\/(取消|cancel)\s*/, "").trim();
    if (!sid) {
      await sendTelegramMessage("用法 · /取消 <id>", { chatId, parseMode: undefined });
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch(`${BASE}/api/wealth/lockdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ short_id: sid, decision: "cancelled" }),
      }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      // 看本月 cancel 总数
      const stats = await fetch(`${BASE}/api/wealth/lockdown?action=stats`).then(r => r.json());
      const tm = stats.this_month || {};
      await sendTelegramMessage(
        `🎉 取消 · 省 $${Number(r.item.amount_usd).toFixed(2)}\n本月已 cancel ${tm.cancelled_count || 1} 单 · 共省 $${tm.saved_usd || 0}\n小钱不积 · 大目标不来`,
        { chatId, parseMode: undefined }
      );
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /待办 · 列 pending 单
  if (text.startsWith("/待办") || text.startsWith("/pending") || text.startsWith("/queue")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/lockdown?action=pending`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      if (!r.pending || r.pending.length === 0) {
        await sendTelegramMessage("📭 没 pending\n想花钱 · /等等 50 描述", { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = ["⏸ 待决定 (24h 冷静中)", ""];
      for (const p of r.pending) {
        const hoursLeft = ((new Date(p.expires_at).getTime() - Date.now()) / 3600000).toFixed(1);
        lines.push(`${p.short_id} · $${Number(p.amount_usd).toFixed(2)} · ${p.description.slice(0,40)}`);
        lines.push(`   ${p.category} · 还剩 ${hoursLeft}h`);
        lines.push(`   /确认 ${p.short_id}  /取消 ${p.short_id}`);
        lines.push("");
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /省 · 看本月 lockdown 省了多少
  if (text.startsWith("/省") || text.startsWith("/saved")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/lockdown?action=stats`).then(r => r.json());
      const tm = r.this_month || {};
      const lm = r.last_month || {};
      const lines = [
        `💰 lockdown 战绩`,
        ``,
        `── 本月 ──`,
        `cancel ${tm.cancelled_count || 0} 单 · 省 $${tm.saved_usd || 0}`,
        `approve ${tm.approved_count || 0} 单 · 花 $${tm.spent_usd || 0}`,
        `pending ${tm.pending_count || 0} 单 · 待决`,
        `cancel 率 · ${tm.save_rate_pct || 0}%`,
        ``,
        `── 上月 ──`,
        `cancel ${lm.cancelled_count || 0} 单 · 省 $${lm.saved_usd || 0}`,
        `approve ${lm.approved_count || 0} 单 · 花 $${lm.spent_usd || 0}`,
      ];
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /同步 /sync · 手动触发 · 但本地 launchd 已经 5min 自动 (Vercel 端无 RSA · 信息提醒)
  if (text.startsWith("/同步") || text === "/sync") {
    const lines = [
      "🔄 自动同步状态 ·",
      "",
      "本地 launchd · 5min 自动跑 ·",
      "  ✓ Kalshi (你已有 RSA · 自动)",
      "  ○ Coinbase (要 API key · 见下)",
      "  ○ SimpleFIN 银行 (要 access token · 见下)",
      "",
      "📌 接 Coinbase ·",
      "  1 · coinbase.com · Settings · API Keys · Create",
      "  2 · 权限只勾 · wallet:accounts:read",
      "  3 · 复制 API Key + Secret",
      "  4 · 给我 · 我加 .env.local 立刻自动",
      "",
      "📌 接 SimpleFIN (银行) ·",
      "  1 · 注册 simplefin.org/auth/setup ($15/年)",
      "  2 · 链你的银行 (Chase / BoA / etc · OAuth read-only)",
      "  3 · 拿 access token (base64 string)",
      "  4 · 给我 · 我加 .env.local",
      "",
      "📌 现金 + HG 应收 · 没法自动 · /入 cash 200 偶尔",
    ];
    await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    return NextResponse.json({ ok: true });
  }

  // V0.74 W1 · 财富模块命令 · 净值 / 目标 / 入账 / 导出
  if (text.startsWith("/净值") || text.startsWith("/networth") || text.startsWith("/balance")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/networth?snapshot=1`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const sign = (v: number | undefined) => v == null ? "—" : v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
      const lines = [
        `💰 净值 · $${r.total_usd.toFixed(2)}`,
        ``,
        `── 按品类 ──`,
      ];
      const catEmoji: Record<string, string> = { bank: "🏦", crypto: "₿", prediction: "🎯", cash: "💵", goal: "🎯", broker: "📈", other: "📦" };
      for (const [cat, amt] of Object.entries(r.by_category as Record<string, number>)) {
        const e = catEmoji[cat] || "•";
        lines.push(`  ${e} ${cat.padEnd(10)} · $${(amt as number).toFixed(2)}`);
      }
      lines.push(``);
      lines.push(`── 趋势 ──`);
      lines.push(`  vs 7 天前 · ${sign(r.delta_7d)}`);
      lines.push(`  vs 30 天前 · ${sign(r.delta_30d)}`);
      lines.push(``);
      lines.push(`── 账户 (${r.account_count} 个) ──`);
      for (const a of r.by_account.slice(0, 8)) {
        lines.push(`  ${a.name.slice(0, 18).padEnd(18)} · $${a.balance.toFixed(2)}`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /净值 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /目标 · 阶段 1 #2 离目标多远 + C 速度警报
  if (text.startsWith("/目标") || text.startsWith("/goals")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/goals`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const rate = r.recent_monthly_save_rate;
      const lines = [
        `🎯 目标 · 离梦想多远`,
        `近 30 天月化净攒 · ${rate >= 0 ? "+" : ""}$${rate.toFixed(0)}`,
        ``,
      ];
      for (const g of r.goals) {
        const bar = "▰".repeat(Math.floor(g.pct / 10)) + "▱".repeat(10 - Math.floor(g.pct / 10));
        lines.push(`${g.emoji} ${g.name}`);
        lines.push(`  ${bar} ${g.pct.toFixed(0)}%`);
        lines.push(`  $${Number(g.current_usd).toFixed(0)} / $${Number(g.target_usd).toFixed(0)}  ·  差 $${g.remaining_usd.toFixed(0)}`);
        if (g.months_to_deadline != null) {
          lines.push(`  剩 ${g.months_to_deadline} 月 · 月需 $${g.monthly_need_usd?.toFixed(0)}`);
          if (g.on_track) {
            lines.push(`  ✓ 在轨${g.projected_months_at_current_rate ? ` · 按当前速度 ${g.projected_months_at_current_rate} 月达成` : ""}`);
          } else {
            if (g.projected_months_at_current_rate) {
              lines.push(`  ⚠ 慢了 · 当前速度 ${g.projected_months_at_current_rate} 月 (晚 ${g.projected_months_at_current_rate - g.months_to_deadline} 月)`);
            } else {
              lines.push(`  ⚠ 当前没攒钱 · 永远到不了`);
            }
            lines.push(`  需 +$${g.extra_needed_per_month}/月`);
          }
        }
        lines.push(``);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /目标 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /入 <slug> <amount> · 手动登记余额
  if (text.startsWith("/入 ") || text.startsWith("/入账") || text.startsWith("/setbalance") || text.startsWith("/add ")) {
    const arg = text.replace(/^\/(入账?|setbalance|add)\s*/, "").trim();
    const m = arg.match(/^(\S+)\s+(\d+(?:\.\d+)?)\s*(.*)?$/);
    if (!m) {
      await sendTelegramMessage(
        "用法 · /入 <账户slug> <金额> [备注]\n例 · /入 bank-checking 5000\n例 · /入 coinbase 1234.56 比特币只算今天\n看所有账户 · /账户",
        { chatId, parseMode: undefined }
      );
      return NextResponse.json({ ok: true });
    }
    const [, slug, amt, notes] = m;
    try {
      const r = await fetch(`${BASE}/api/wealth/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, balance: parseFloat(amt), notes }),
      }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      await sendTelegramMessage(`✓ 记 · ${r.account.name} · $${parseFloat(amt).toFixed(2)}`, { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /账户 · 列所有
  if (text.startsWith("/账户") || text.startsWith("/accounts")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/balance`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = ["📋 账户清单 · /入 <slug> <金额> 入账", ``];
      for (const a of r.accounts) {
        const status = a.active ? "" : " (停用)";
        lines.push(`${a.slug}  ·  ${a.name}${status}`);
        lines.push(`  category=${a.category} source=${a.source}`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /导出 · CSV 导出 · #22 去中心化承诺
  if (text.startsWith("/导出") || text.startsWith("/export")) {
    try {
      const r = await fetch(`${BASE}/api/wealth/export`);
      const csv = await r.text();
      const lines = csv.split("\n");
      const summary = `📦 导出 ${lines.length - 1} 行 CSV\n\n直接看 · ${BASE}/api/wealth/export\n\n首 5 行 ·\n${lines.slice(0, 5).join("\n").slice(0, 800)}`;
      await sendTelegramMessage(summary, { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /导出 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.73 W1 Day 5 · /统计 · paper 战绩 · WR + ROI
  if (text.startsWith("/统计") || text.startsWith("/stats")) {
    const arg = text.replace(/^\/(统计|stats)\s*/, "").trim();
    const days = arg ? parseInt(arg) || 7 : 7;
    try {
      const r = await fetch(`${BASE}/api/xiapan/baichuan/paper-stats?days=${days}`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const sign = (v: number) => v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
      const lines = [
        `📊 paper 战绩 · 近 ${r.days} 天`,
        ``,
        `── 总计 ──`,
        `${r.total} 单 · WR ${r.wr_pct}% · ROI ${r.roi_pct}%`,
        `押 $${r.total_stake_usd} · ${sign(r.total_pnl_usd)}`,
        ``,
        `── 你手动 (manual) ──`,
        `${r.manual.total} 单 · WR ${r.manual.wr_pct}% · ROI ${r.manual.roi_pct}%`,
        `押 $${r.manual.total_stake_usd} · ${sign(r.manual.total_pnl_usd)}`,
        ``,
        `── 系统自动 (cron) ──`,
        `${r.cron.total} 单 · WR ${r.cron.wr_pct}% · ROI ${r.cron.roi_pct}%`,
        `押 $${r.cron.total_stake_usd} · ${sign(r.cron.total_pnl_usd)}`,
        ``,
      ];
      if (r.recent_5 && r.recent_5.length > 0) {
        lines.push(`最近 5 单 ·`);
        for (const x of r.recent_5) {
          const status = x.status === "finalized"
            ? (x.pnl > 0 ? "★" : x.pnl < 0 ? "✕" : "·")
            : "○";
          const src = x.source === "manual" ? "手" : "自";
          lines.push(`${status} [${src}] ${x.ticker.slice(0, 30)} · ${x.side} · ${x.pnl != null ? sign(x.pnl) : "持"}`);
        }
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /统计 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.73 W1 Day 3 · /品类 · C 模式 · 看 / 改 user vs auto 品类
  if (text.startsWith("/品类") || text.startsWith("/categories")) {
    const arg = text.replace(/^\/(品类|categories)\s*/, "").trim();
    try {
      // 看 ·
      if (!arg) {
        const r = await fetch(`${BASE}/api/xiapan/baichuan/preferences`).then(r => r.json());
        const lines = [
          `📂 品类偏好`,
          ``,
          `🎮 你自己玩 (AI 不碰) ·`,
          `  ${r.user_categories.join(" · ")}`,
          ``,
          `🤖 AI 自动跑 ·`,
          `  ${r.auto_categories.join(" · ")}`,
          ``,
          `更新于 · ${r.updated_at?.slice(0, 19) || "never"}`,
          ``,
          `改 · /品类 user tennis,nba`,
          `改 · /品类 auto btc,eth,fda`,
        ];
        await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      // 改 ·
      const m = arg.match(/^(user|auto)\s+(.+)$/);
      if (!m) {
        await sendTelegramMessage("用法 · /品类 user tennis,nba 或 /品类 auto btc,eth", { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const which = m[1] === "user" ? "user_categories" : "auto_categories";
      const items = m[2].split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
      const r = await fetch(`${BASE}/api/xiapan/baichuan/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [which]: items }),
      }).then(r => r.json());
      await sendTelegramMessage(`✓ ${which} = ${items.join(" · ")}`, { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.73 W1 Day 2 · /推荐 · B 模式 · 每日 5 +EV 推荐
  if (text.startsWith("/推荐") || text.startsWith("/picks")) {
    try {
      const r = await fetch(
        `${BASE}/api/xiapan/baichuan/picks?limit=5&min_ev=5`,
        { signal: AbortSignal.timeout(60_000) }
      ).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error || "未知错误"}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `📊 今日 Top ${r.winners.length} +EV 推荐 (≥ ${r.min_ev}% EV)`,
        `扫 ${r.scanned} · 估值 ${r.estimated} · 命中 ${r.winners_count}`,
        ``,
      ];
      if (r.winners.length === 0) {
        lines.push("当前没明显 +EV · 等下次扫");
      } else {
        for (const w of r.winners) {
          lines.push(`${w.ticker}`);
          lines.push(`  ${w.title}`);
          lines.push(`  ${(w.last_price*100).toFixed(0)}¢ → 估 ${(w.fair_prob*100).toFixed(0)}% · +EV ${w.ev_pct.toFixed(1)}%`);
          lines.push(`  ${w.reason}`);
          lines.push(``);
        }
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ /推荐 失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 8 · /信号 · top 5 候选
  if (text === "/信号" || text === "/signals") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/signals", { signal: AbortSignal.timeout(180_000) }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `信号 · 候选 ${r.summary.total} · 双源 ${r.summary.multi_signal} · 已下 ${r.summary.acted}`,
        ``,
      ];
      if (r.top.length === 0) {
        lines.push("当前没强信号 · 等下次 cron");
      } else {
        for (const s of r.top) {
          const icon = s.acted ? "★" : (s.fusion?.n_active ?? s.n_active) >= 2 ? "·" : "○";
          const sign = s.edge_pp >= 0 ? "+" : "";
          lines.push(`${icon} ${s.ticker}\n   ${sign}${s.edge_pp.toFixed(1)}pp · n=${s.n_active} · 押${s.side==="yes"?"会":"不会"} (${s.bucket})`);
        }
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 8 · /事 · 有啥要动手
  if (text === "/事" || text === "/todo") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/todo").then(r => r.json());
      if (r.empty_message) {
        await sendTelegramMessage(`✓ ${r.empty_message}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [`事 · ${r.summary.total} 件 (${r.summary.high} 急)`, ``];
      for (const t of r.todos) {
        const icon = t.priority === "high" ? "🔴" : t.priority === "med" ? "🟡" : "🟢";
        lines.push(`${icon} ${t.text}\n   ${t.why}`);
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/状态" || text === "/status") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/mac-mini-status").then(r => r.json());
      const body =
        `Mac mini · ${r.hostname}\n` +
        `· uptime ${Math.round(r.uptime_minutes / 60)}h\n` +
        `· CPU ${Math.round(r.cpu_pct)}% · RAM ${r.ram_used_gb}/${r.ram_total_gb} GB\n` +
        `· Hermes ${r.hermes_loaded ? "✓" : "✗"} (${r.last_inference_ms ?? "?"}ms)\n` +
        `· Next.js ${r.agent_logs?.next_dev_running ? "✓" : "✗"} · Cron ${r.agent_logs?.cron_running ? "✓" : "✗"}`;
      await sendTelegramMessage(body, { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ 拉状态失败 · ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/paper") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/paper-trade?days=7").then(r => r.json());
      const s = r.summary;
      const body =
        `◧ 模拟挂单 · 7 天\n` +
        `· 总 ${s.total} · 持仓 ${s.open} · 平 ${s.closed}\n` +
        `· 赢 ${s.wins} / 输 ${s.losses} · 胜率 ${Math.round(s.win_rate * 100)}%\n` +
        `· PnL ${s.total_pnl >= 0 ? "+" : ""}$${s.total_pnl}\n\n` +
        `进 [B] 真单 · 还差 ${Math.max(0, 100 - s.total)} 笔`;
      await sendTelegramMessage(body, { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/digest") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/intel/digest").then(r => r.json());
      await sendTelegramMessage(r.digest_md ?? "无简报", { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 · /pools · 百川两池状态
  if (text === "/pools") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/pools").then(r => r.json());
      if (!r.initialized) {
        await sendTelegramMessage(
          "△ 百川两池未初始化\n\n命令 ·\n  /pools_init 400  (注入本金 $400 起步)",
          { chatId, parseMode: undefined }
        );
        return NextResponse.json({ ok: true });
      }
      const s = r.state;
      const total = s.S.balance + s.C.balance;
      const lines = [
        `◆ 百川两池`,
        ``,
        `本金 P0   · $${s.P0.toFixed(2)} (红线)`,
        `S 池稳赚 · $${s.S.balance.toFixed(2)}  (peak $${s.S.peak.toFixed(2)})`,
        `C 池凸性 · $${s.C.balance.toFixed(2)}  (open ${s.C.open_trades} 单)`,
        `─────────`,
        `总计      · $${total.toFixed(2)}  (vs P0 ${((total / s.P0 - 1) * 100).toFixed(1)}%)`,
        ``,
        `历史 cashout:  $${s.lifetime.total_cashout.toFixed(2)}`,
        `历史 reinvest: $${s.lifetime.total_reinvest.toFixed(2)}`,
        `状态: ${s.circuit_state}` + (s.circuit_reason ? ` (${s.circuit_reason})` : ""),
      ];
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 8 · /pools_reset <amount> · 强制重置 (真钱切换用)
  if (text.startsWith("/pools_reset")) {
    const parts = text.split(/\s+/);
    const amount = parseFloat(parts[1] || "0");
    if (!amount || amount <= 0) {
      await sendTelegramMessage(
        "用法 · /pools_reset 50\n\n⚠ 重置 · 清 lessons + 重起 P0\n仅在切换 paper → 真钱 时用\n确认后发 · /pools_reset 50",
        { chatId, parseMode: undefined }
      );
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ P0: amount, reset: true }),
      }).then(r => r.json());
      if (r.ok) {
        await sendTelegramMessage(
          `✓ 重置完成\nP0 · $${r.state.P0.toFixed(2)}\nS 池 · $${r.state.S.balance.toFixed(2)} (90%)\nC 池 · $${r.state.C.balance.toFixed(2)} (10%)\n\n⚠ 旧 paper 历史已抛弃 (lessons.jsonl 保留供回看)`,
          { chatId, parseMode: undefined }
        );
      } else {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
      }
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 · /pools_init <amount> · 初始化
  if (text.startsWith("/pools_init")) {
    const parts = text.split(/\s+/);
    const amount = parseFloat(parts[1] || "0");
    if (!amount || amount <= 0) {
      await sendTelegramMessage(
        "用法 · /pools_init 400\n\n注入本金 $400 起步 · 90% 进 S · 10% 进 C\n仅首次有效 · 初始化后不能改",
        { chatId, parseMode: undefined }
      );
      return NextResponse.json({ ok: true });
    }
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ P0: amount }),
      }).then(r => r.json());
      if (r.ok) {
        await sendTelegramMessage(
          `◆ 百川初始化完成\n` +
          `P0 · $${r.state.P0.toFixed(2)}\n` +
          `S 池 · $${r.state.S.balance.toFixed(2)} (90%)\n` +
          `C 池 · $${r.state.C.balance.toFixed(2)} (10%)\n` +
          `\n等 W1 BS 信号源跑起 · S 池开始下单`,
          { chatId, parseMode: undefined }
        );
      } else {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
      }
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 7 · /tutorial · 推手机使用教程 (8 页 · 图文)
  if (text === "/tutorial" || text.startsWith("/tutorial")) {
    const parts = text.split(/\s+/);
    const page = parts[1];
    try {
      const url = page
        ? `http://localhost:3001/api/xiapan/baichuan/tutorial?chat_id=${chatId}&page=${page}`
        : `http://localhost:3001/api/xiapan/baichuan/tutorial?chat_id=${chatId}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
      } else if (page) {
        // 单页 · 已发送 · 不再 ack
      } else {
        await sendTelegramMessage(`✓ 教程已推送 (${r.sent} 页)`, { chatId, parseMode: undefined });
      }
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 10 · /今日 · 9:30 setup 卡 · BG3 风格
  if (text === "/今日" || text === "/today") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/today", { signal: AbortSignal.timeout(60_000) }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `📅 ${r.date} · 今日`,
        ``,
        `${r.advantage_emoji}  ${r.tactic_advice}`,
        ``,
        `${r.heatmap}`,
        `${r.heatmap_legend}`,
        ``,
        `主力策略 ·`,
      ];
      for (const t of r.top3_strategies) {
        lines.push(`  ${t.emoji} ${t.name} · ${t.pct.toFixed(0)}% · $${t.usd.toFixed(0)}`);
      }
      lines.push(``, `同伴 ·`);
      for (const c of r.companions) {
        const moodIcon = c.approval >= 30 ? "😊" : c.approval >= -20 ? "😐" : "😠";
        lines.push(`  ${c.emoji} ${c.name} ${moodIcon}(${c.approval >= 0 ? "+" : ""}${c.approval}) "${c.quote}"`);
        if (c.blind_spot) lines.push(`    ⚠ ${c.blind_spot}`);
      }
      lines.push(``, `今日 · 下 ${r.today_progress.placed} · 平 ${r.today_progress.closed}`);
      lines.push(`分散 · ${r.diversification.allocated}/${r.diversification.total_eligible} 策略活跃`);
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 10 · /同伴 · BG3 approval 详细看
  if (text === "/同伴" || text === "/companions") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/companions").then(r => r.json());
      const lines = [
        `👥 同伴 · 综合 ${r.consensus >= 0 ? "+" : ""}${r.consensus.toFixed(0)}`,
        ``,
      ];
      for (const c of r.companions) {
        const bar = "▰".repeat(Math.max(0, Math.round((c.approval + 100) / 20))) + "▱".repeat(Math.max(0, 10 - Math.round((c.approval + 100) / 20)));
        lines.push(`${c.emoji} ${c.name} (${c.archetype})`);
        lines.push(`   ${bar} ${c.approval >= 0 ? "+" : ""}${c.approval} · ${c.current_mood}`);
        lines.push(`   "${c.last_quote}"`);
        if (c.blind_spot) lines.push(`   ⚠ 盲点 · ${c.blind_spot}`);
        lines.push(``);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 10 · /策略 · 看 15 策略实时分配
  if (text === "/策略" || text === "/strategies") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/strategies", { signal: AbortSignal.timeout(60_000) }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `📋 ${r.strategies.length} 策略 · $${r.bankroll.toFixed(0)} 自动分配`,
        ``,
        `当前活跃 ${r.diversification.total_eligible} / 已分配 ${r.diversification.allocated}`,
        ``,
      ];
      const allocated = r.strategies.filter((s: { suggested_pct: number }) => s.suggested_pct > 0);
      const idle = r.strategies.filter((s: { suggested_pct: number }) => s.suggested_pct === 0);

      lines.push("分到钱的 ·");
      for (const s of allocated.slice(0, 10)) {
        const pct = s.suggested_pct.toFixed(0);
        const usd = s.suggested_usd.toFixed(0);
        lines.push(`${s.strategy.emoji} ${s.strategy.name}\n   ${pct}% · $${usd} · ${s.current_signals}信号 · ${s.reason}`);
      }
      if (idle.length > 0) {
        lines.push(``, `等待中 (无信号或不符合) ·`);
        for (const s of idle.slice(0, 5)) {
          lines.push(`${s.strategy.emoji} ${s.strategy.name} · ${s.reason}`);
        }
      }
      if (r.warnings && r.warnings.length > 0) {
        lines.push(``, `⚠ 警告 ·`);
        for (const w of r.warnings) lines.push(`  · ${w}`);
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 Day 9 · /训 · 自进化模型训练触发
  if (text === "/训" || text === "/train") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/train", { signal: AbortSignal.timeout(120_000) }).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const s = r.summary;
      const lines = [
        `🧠 ML 训练 · ${s.duration_ms}ms`,
        ``,
        `板块 ${s.total_boards} · 训 ${s.trained} · 跳 ${s.skipped} · 拒 ${s.rejected}`,
        ``,
      ];
      for (const result of r.results) {
        const icon = result.status === "trained" ? "✓" : result.status === "skipped" ? "·" : "✗";
        const detail = result.status === "trained"
          ? `n=${result.n_samples} · brier=${result.val_brier?.toFixed(3)} · auc=${result.val_auc?.toFixed(2)} · 改进+${result.improvement?.toFixed(3)}`
          : `n=${result.n_samples} · ${result.reason}`;
        lines.push(`${icon} ${result.board}: ${detail}`);
      }
      lines.push(``, "数据 ≥ 100/板块 才训 · 改进 ≥ 0.01 brier 才存");
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 · /backtest · 网格搜参 · 找最优阈值
  if (text === "/backtest" || text.startsWith("/backtest")) {
    const parts = text.split(/\s+/);
    const days = parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : "30";
    try {
      const r = await fetch(`http://localhost:3001/api/xiapan/baichuan/backtest?days=${days}`).then(r => r.json());
      if (r.message) {
        await sendTelegramMessage(`◧ ${r.message}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `▼ 回测 · ${days} 天 · ${r.sample_size} 已平`,
        ``,
        `当前阈值 · ROI ${r.baseline.roi_pct >= 0 ? "+" : ""}${r.baseline.roi_pct.toFixed(1)}%`,
        `  edge_S=${r.baseline.param.min_edge_pp_stable}pp · edge_C=${r.baseline.param.min_edge_pp_convex}pp · n_active=${r.baseline.param.min_n_active_stable}`,
        ``,
        `最优阈值 · ROI ${r.best.roi_pct >= 0 ? "+" : ""}${r.best.roi_pct.toFixed(1)}%`,
        `  edge_S=${r.best.param.min_edge_pp_stable}pp · edge_C=${r.best.param.min_edge_pp_convex}pp · n_active=${r.best.param.min_n_active_stable}`,
        `  ${r.best.n_trades} 单 · wr ${(r.best.win_rate * 100).toFixed(0)}%`,
        ``,
        `改进 · ${r.improvement_pp >= 0 ? "+" : ""}${r.improvement_pp.toFixed(1)}pp`,
        ``,
        r.recommendation,
      ];
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 · /review · 综合表现 (CLV + Brier + PnL + 各 source 归因)
  if (text === "/review" || text.startsWith("/review")) {
    const parts = text.split(/\s+/);
    const days = parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : "30";
    try {
      const r = await fetch(`http://localhost:3001/api/xiapan/baichuan/review?days=${days}`).then(r => r.json());
      const s = r.summary;
      const c = r.clv;
      const sign = s.total_pnl >= 0 ? "+" : "";
      const lines = [
        `▼ 综合表现 · ${days} 天`,
        ``,
        `lessons · ${s.total_lessons} 总 · ${s.closed} 平 · ${s.open} 持`,
        `wr ${(s.win_rate * 100).toFixed(0)}% · PnL ${sign}$${s.total_pnl}`,
        ``,
        `S 桶 · ${s.stable.n} 单 · ${s.stable.pnl >= 0 ? "+" : ""}$${s.stable.pnl}`,
        `C 桶 · ${s.convex.n} 单 · ${s.convex.pnl >= 0 ? "+" : ""}$${s.convex.pnl}`,
        ``,
        `CLV · ${c.avg_clv_pp >= 0 ? "+" : ""}${c.avg_clv_pp.toFixed(1)}pp · ${c.verdict}`,
      ];
      if (r.pools) {
        const dd = (r.pools.S_drawdown_from_peak_pct * 100).toFixed(1);
        lines.push(``, `S 池 · $${r.pools.S.toFixed(2)} (peak $${r.pools.S_peak.toFixed(2)} · drawdown ${dd}%)`);
        lines.push(`C 池 · $${r.pools.C.toFixed(2)}`);
      }
      lines.push(``, `top 5 sources ·`);
      for (const sa of (r.sources as Array<{ source: string; closed: number; participated: number; win_rate: number; total_pnl: number; avg_clv_pp: number; verdict: string; }>).slice(0, 5)) {
        const v = sa.verdict === "alpha+" ? "✓" : sa.verdict === "alpha-" ? "✗" : "·";
        lines.push(`  ${v} ${sa.source}\n    ${sa.closed}/${sa.participated} · wr ${(sa.win_rate * 100).toFixed(0)}% · ${sa.total_pnl >= 0 ? "+" : ""}$${sa.total_pnl} · CLV ${sa.avg_clv_pp >= 0 ? "+" : ""}${sa.avg_clv_pp}pp`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W2 · /clv · 收盘线价值跟踪
  if (text === "/clv") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/clv").then(r => r.json());
      const s = r.summary;
      if (s.n === 0) {
        await sendTelegramMessage("◧ 还没已平仓单 · CLV 待累积", { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const verdictIcon =
        s.verdict === "alpha+" ? "✓" :
        s.verdict === "alpha-" ? "✗" : "·";
      const lines = [
        `${verdictIcon} CLV 跟踪 · ${s.verdict}`,
        ``,
        `共 ${s.n} 单 · 平均 ${s.avg_clv_pp >= 0 ? "+" : ""}${s.avg_clv_pp.toFixed(1)}pp`,
        `+ 占比 ${(s.positive_pct * 100).toFixed(0)}%`,
        `近 30 单 · ${s.recent_30.avg_clv >= 0 ? "+" : ""}${s.recent_30.avg_clv.toFixed(1)}pp`,
        ``,
        `按桶 ·`,
      ];
      for (const [k, v] of Object.entries(s.by_bucket as Record<string, { n: number; avg_clv: number }>)) {
        lines.push(`  ${k}: ${v.n} 单 · ${v.avg_clv >= 0 ? "+" : ""}${v.avg_clv.toFixed(1)}pp`);
      }
      lines.push(``, `按信号 ·`);
      for (const [k, v] of Object.entries(s.by_source as Record<string, { n: number; avg_clv: number }>).slice(0, 6)) {
        lines.push(`  ${k}: ${v.n} 单 · ${v.avg_clv >= 0 ? "+" : ""}${v.avg_clv.toFixed(1)}pp`);
      }
      lines.push(``, s.verdict === "alpha+" ? "策略真有 alpha · CLV > 0" :
                     s.verdict === "alpha-" ? "⚠ 长期下方向错 · 复盘" :
                     "样本不够或中性");
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 · /live · Kalshi 真钱 client 状态
  if (text === "/live") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/live-status").then(r => r.json());
      const s = r.status;
      const lines = [
        `${s.enabled ? "✓" : "✗"} Kalshi 真钱 · ${s.enabled ? "已启用" : "OFF"}`,
        ``,
        `LIVE_TRADING env · ${s.enabled ? "true" : "false (默认)"}`,
        `KALSHI_API_KEY_ID · ${s.has_key_id ? "✓" : "✗"}`,
        `RSA private key · ${s.has_private_key ? "✓" : "✗"}`,
        ``,
        `原因 · ${s.reason}`,
      ];
      if (r.balance !== null) {
        lines.push(``, `余额 · $${r.balance.toFixed(2)}`);
      }
      lines.push(``, `单笔上限 · $${r.risk_limits.MAX_SINGLE_STAKE_USD}`);
      lines.push(`日新单上限 · ${r.risk_limits.MAX_DAILY_NEW_ORDERS}`);
      lines.push(`日新钱上限 · $${r.risk_limits.MAX_DAILY_DOLLAR_NEW}`);
      if (!s.enabled) {
        lines.push(``, `开启步骤 ·`, r.next_steps);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 · /health · 百川全链路健康
  if (text === "/health") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/health").then(r => r.json());
      const overallIcon = r.overall === "ok" ? "✓" : r.overall === "warn" ? "△" : "✗";
      const lines = [
        `${overallIcon} 百川健康 · ${r.overall.toUpperCase()}`,
        `${r.summary.ok}✓ ${r.summary.warn}△ ${r.summary.fail}✗`,
        ``,
      ];
      for (const c of r.checks) {
        const icon = c.status === "ok" ? "✓" : c.status === "warn" ? "△" : "✗";
        lines.push(`${icon} ${c.name}\n   ${c.detail.slice(0, 120)}`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 · /brier · 当前信号权重 + 最新 Brier
  if (text === "/brier") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/brier").then(r => r.json());
      if (r.message) {
        await sendTelegramMessage(`◧ ${r.message}\n· 总 lessons ${r.lessons_total ?? 0}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const w = r.weights_new ?? r.weights_old ?? {};
      const b = r.brier_by_source ?? {};
      const lines = [
        `◆ Brier 校准 · ${r.closed_lessons} 单已平`,
        ``,
        `信号权重 (1.0 = 中 · ↑ 越准 · ↓ 越差) ·`,
      ];
      const entries = Object.entries(w).sort((a, b) => (b[1] as number) - (a[1] as number));
      for (const [src, weight] of entries) {
        const bd = b[src];
        const brierStr = bd ? `B=${bd.brier.toFixed(2)} n=${bd.n}` : "尚无样本";
        lines.push(`  ${(weight as number).toFixed(2)}  ${src}  (${brierStr})`);
      }
      if (r.changes && r.changes.length > 0) {
        lines.push(``, `本次调整 · ${r.changes.length} 个信号`);
      }
      await sendTelegramMessage(lines.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 · /settle · 拉 Kalshi 已结算 · update lessons
  if (text === "/settle") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/baichuan/settle").then(r => r.json());
      if (r.message) {
        await sendTelegramMessage(`◧ ${r.message}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const s = r.summary;
      const sign = s.total_pnl >= 0 ? "+" : "";
      await sendTelegramMessage(
        `▼ Settle\n` +
        `· 检 ${s.total_checked} 单 · 结算 ${s.settled} · 仍开 ${s.still_open}\n` +
        `· 赢 ${s.wins} / 输 ${s.losses}\n` +
        `· PnL ${sign}$${s.total_pnl.toFixed(2)}`,
        { chatId, parseMode: undefined }
      );
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 · /fed · 经济跨平台 (FOMC/CPI/Jobs/GDP)
  if (text === "/fed" || text === "/economic") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/fed-edges").then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ 经济 · Kalshi vs Polymarket`,
        ``,
        `Kalshi ${r.summary.total_kalshi} · Poly ${r.summary.poly_total} · 配对 ${r.summary.matched} · 信号 ${r.summary.signals}`,
        ``,
      ];
      for (const e of r.edges.slice(0, 6)) {
        const sign = e.edge_pp >= 0 ? "+" : "";
        const cat = e.category.toUpperCase();
        lines.push(
          `${e.signal ? "★" : "·"} [${cat}] ${(e.title ?? e.ticker).slice(0, 50)}\n` +
          `   Kalshi ${(e.market_p * 100).toFixed(0)}% vs Poly ${e.poly_match ? (e.poly_match.yes_p * 100).toFixed(0) + "%" : "—"} · ${sign}${e.edge_pp.toFixed(1)}pp`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W3 · /nba · NBA Elo 信号 + 让你刷一次 538
  if (text === "/nba" || text.startsWith("/nba_refresh")) {
    try {
      const refresh = text.startsWith("/nba_refresh") ? "?refresh=1" : "";
      const r = await fetch(`http://localhost:3001/api/xiapan/nba-edges${refresh}`).then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ NBA Elo · ${r.summary.elo_source} · ${r.summary.total_teams} 队`,
        `Elo 更新 · ${r.summary.elo_ts.slice(0, 10)}`,
        ``,
        `${r.summary.signals} 信号 / ${r.summary.total_markets} 市场`,
        ``,
      ];
      for (const e of r.edges.slice(0, 5)) {
        const sign = e.edge_pp >= 0 ? "+" : "";
        lines.push(
          `${e.signal ? "★" : "·"} ${e.team_away}@${e.team_home} (押 ${e.yes_team})\n` +
          `   公允 ${(e.fair_p * 100).toFixed(0)}% vs 市场 ${(e.market_p * 100).toFixed(0)}%  ${sign}${e.edge_pp.toFixed(1)}pp · vol $${e.vol_24.toFixed(0)}`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 · /weather · NWS + Open-Meteo 双源天气信号 top 5
  if (text === "/weather") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/weather-edges").then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ 天气 · NWS + Open-Meteo 双源`,
        ``,
        `${r.summary.total_signals} 个信号 · 双源 confirm: ${r.summary.dual_confirm_tickers}`,
        `扫了 ${r.summary.cities_scanned} 城市`,
        ``,
      ];
      const top = r.edges.slice(0, 5);
      for (const e of top) {
        const nwsEdge = e.nws ? `${e.nws.edge_pp >= 0 ? "+" : ""}${e.nws.edge_pp.toFixed(1)}pp` : "-";
        const meteoEdge = e.meteo ? `${e.meteo.edge_pp >= 0 ? "+" : ""}${e.meteo.edge_pp.toFixed(1)}pp` : "-";
        const star = e.signals.length >= 2 ? "★★" : e.signals.length === 1 ? "★" : "·";
        lines.push(
          `${star} ${e.parsed.city} ${e.parsed.type} ≥${e.parsed.threshold} (${e.parsed.date})\n` +
          `   市场 ${(e.market_p * 100).toFixed(0)}% · NWS ${nwsEdge} · Meteo ${meteoEdge}`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W2 · /contrarian · 反公众信号 top
  if (text === "/contrarian" || text === "/反向") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/contrarian-edges").then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ 反公众信号 (Walters / Thaler 派)`,
        ``,
        `扫 ${r.summary.total_scanned} · 有 skew ${r.summary.with_skew} · 信号 ${r.summary.signals}`,
        ``,
      ];
      for (const s of r.signals.slice(0, 8)) {
        const dir = s.direction === 1 ? "押会" : "押不会";
        lines.push(
          `★ ${s.ticker.slice(0, 35)}\n   ${dir} (${(s.predicted_p * 100).toFixed(0)}%) · ${s.reason}`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W2 · /mention · Catboy/Trump 错价凸性信号
  if (text === "/mention") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/mention-edges").then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      if (r.signals.length === 0) {
        await sendTelegramMessage(
          `◯ Mention 当前无 ≥12pp 信号\n· 总 events ${r.summary.total_events} · 总 markets ${r.summary.total_markets}`,
          { chatId, parseMode: undefined }
        );
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ Mention 错价 · 凸性桶`,
        ``,
        `${r.signals.length} 信号 · 来自 ${r.summary.total_events} events`,
        ``,
      ];
      for (const s of r.signals.slice(0, 6)) {
        const dir = s.direction === 1 ? "押会" : "押不会";
        lines.push(
          `★ ${s.ticker.slice(0, 30)}\n   ${dir} · 公允 ${(s.predicted_p * 100).toFixed(0)}% · conf ${s.confidence.toFixed(2)}\n   ${s.reason.slice(0, 120)}`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W2 · /fda · AdCom + Phase 3 凸性信号
  if (text === "/fda") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/fda-edges").then(r => r.json());
      if (r.message) {
        await sendTelegramMessage(`◧ ${r.message}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ FDA AdCom · ${r.summary.total_meetings} meetings`,
        `${r.summary.with_kalshi} 配 Kalshi · ${r.summary.signals} 信号`,
        ``,
      ];
      for (const e of r.edges.slice(0, 8)) {
        const m = e.meeting;
        lines.push(
          `${e.signal ? "★" : "·"} ${m.drug} (${m.indication})\n` +
          `   ${m.date} · ${m.disease_category} · ${m.vote_status ?? "scheduled"}` +
          (e.fair_p !== undefined ? `\n   公允 ${(e.fair_p * 100).toFixed(0)}% vs 市场 ${(e.market_p * 100).toFixed(0)}% · edge ${e.edge_pp >= 0 ? "+" : ""}${e.edge_pp.toFixed(0)}pp` : "")
        );
      }
      lines.push(``, `添加 meeting · POST /api/xiapan/fda-edges body=meeting`);
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W2 · /sol · SOL 三路信号 top 5
  if (text === "/sol") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/sol-edges").then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ SOL BS + 跨期限 + 跨平台`,
        ``,
        `spot $${r.summary.spot.toFixed(0)} · σ_30d ${(r.summary.sigma_30d * 100).toFixed(0)}%`,
        `BS ${r.summary.bs_signals} · 跨期限 ${r.summary.cross_tenor_signals} · 跨平台 ${r.summary.cross_platform_signals}`,
        ``,
      ];
      const top5 = r.edges.slice(0, 5);
      for (const e of top5) {
        const sign = e.edge_pp >= 0 ? "+" : "";
        lines.push(
          `${e.signal ? "★" : "·"} ${e.series} ${e.side} $${e.strike}  T=${e.T_hours.toFixed(1)}h\n` +
          `   公允 ${(e.fair_p * 100).toFixed(0)}% vs 市场 ${(e.market_p * 100).toFixed(0)}%  ${sign}${e.edge_pp.toFixed(1)}pp`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 W2 · /eth · ETH 三路信号 top 5
  if (text === "/eth") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/eth-edges").then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ ETH BS + 跨期限 + 跨平台`,
        ``,
        `spot $${r.summary.spot.toFixed(0)} · σ_30d ${(r.summary.sigma_30d * 100).toFixed(0)}%`,
        `BS ${r.summary.bs_signals} · 跨期限 ${r.summary.cross_tenor_signals} · 跨平台 ${r.summary.cross_platform_signals}`,
        ``,
      ];
      const top5 = r.edges.slice(0, 5);
      for (const e of top5) {
        const sign = e.edge_pp >= 0 ? "+" : "";
        lines.push(
          `${e.signal ? "★" : "·"} ${e.series} ${e.side} $${e.strike}  T=${e.T_hours.toFixed(1)}h\n` +
          `   公允 ${(e.fair_p * 100).toFixed(0)}% vs 市场 ${(e.market_p * 100).toFixed(0)}%  ${sign}${e.edge_pp.toFixed(1)}pp`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // V0.72 · /btc · 当前 BS 公允价偏差 top 5
  if (text === "/btc") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/btc-edges").then(r => r.json());
      if (!r.ok) {
        await sendTelegramMessage(`✗ ${r.error}`, { chatId, parseMode: undefined });
        return NextResponse.json({ ok: true });
      }
      const lines = [
        `◆ BTC BS 公允价 vs Kalshi`,
        ``,
        `spot $${r.summary.spot.toFixed(0)} · σ_30d ${(r.summary.sigma_30d * 100).toFixed(0)}%`,
        `${r.summary.signal_count} 个信号 / ${r.summary.total_markets} 市场`,
        ``,
      ];
      const top5 = r.edges.slice(0, 5);
      for (const e of top5) {
        const sign = e.edge_pp >= 0 ? "+" : "";
        lines.push(
          `${e.signal ? "★" : "·"} ${e.series} ${e.side} $${e.strike}  T=${e.T_hours.toFixed(1)}h\n` +
          `   公允 ${(e.fair_p * 100).toFixed(0)}% vs 市场 ${(e.market_p * 100).toFixed(0)}%  edge ${sign}${e.edge_pp.toFixed(1)}pp  vol $${e.vol_24.toFixed(0)}`
        );
      }
      await sendTelegramMessage(lines.join("\n\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // /max /rio /iris · 看某 agent 最新一段 daily 输出
  const agentMap: Record<string, { slug: string; emoji: string; title: string }> = {
    "/max":  { slug: "laohu",   emoji: "▲", title: "Max · Head of Research" },
    "/rio":  { slug: "yazi",    emoji: "●", title: "Rio · Flow Watcher" },
    "/iris": { slug: "suanpan", emoji: "◆", title: "Iris · Head of Review" },
  };
  if (agentMap[text]) {
    const a = agentMap[text];
    try {
      const r = await fetch(`http://localhost:3001/api/xiapan/agents/daily?slug=${a.slug}&limit=1`).then(r => r.json());
      const latest = r.recent_outputs?.[0];
      if (!latest) {
        await sendTelegramMessage(`${a.emoji} ${a.title}\n\n还没跑过 · 等下次 cron`, { chatId, parseMode: undefined });
      } else {
        await sendTelegramMessage(
          `${a.emoji} ${a.title}\n${latest.ranAt}\n\n${latest.output_md.slice(0, 2500)}`,
          { chatId, parseMode: undefined }
        );
      }
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/team") {
    try {
      const slugs = ["laohu", "yazi", "suanpan"] as const;
      const labels: Record<typeof slugs[number], string> = {
        laohu:   "▲ Max · Research",
        yazi:    "● Rio · Flow",
        suanpan: "◆ Iris · Review",
      };
      const all = await Promise.all(
        slugs.map((s) =>
          fetch(`http://localhost:3001/api/xiapan/agents/daily?slug=${s}&limit=1`)
            .then(r => r.json())
            .catch(() => null)
        )
      );
      const parts: string[] = [];
      for (let i = 0; i < slugs.length; i++) {
        const slug = slugs[i];
        const r = all[i];
        const latest = r?.recent_outputs?.[0];
        parts.push(`【${labels[slug]}】 ${latest?.ranAt ?? "—"}`);
        parts.push(latest ? latest.output_md.slice(0, 600) : "(还没跑过)");
        parts.push("");
      }
      await sendTelegramMessage(parts.join("\n"), { chatId, parseMode: undefined });
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  if (text === "/tickers") {
    try {
      const r = await fetch("http://localhost:3001/api/xiapan/picks?min=45&limit=8").then(r => r.json());
      const picks = r.picks ?? [];
      if (picks.length === 0) {
        await sendTelegramMessage("◯ 当前没强 picks · 都不到 45 分", { chatId, parseMode: undefined });
      } else {
        const lines = picks.slice(0, 8).map((p: { score: number; ticker: string; title?: string; buy_side: string; buy_price_c: number; reasons?: string[] }) =>
          `${p.score >= 75 ? "★" : p.score >= 55 ? "·" : "○"} ${p.score}分  \`${p.ticker.slice(0, 28)}\`\n   押「${p.buy_side === "yes" ? "会" : "不会"}」${p.buy_price_c}¢` +
          (p.title ? ` · ${p.title.slice(0, 50)}` : "")
        );
        await sendTelegramMessage(
          `◉ Top picks · 当前\n\n${lines.join("\n\n")}`,
          { chatId, parseMode: undefined }
        );
      }
    } catch (e) {
      await sendTelegramMessage(`✗ ${(e as Error).message}`, { chatId, parseMode: undefined });
    }
    return NextResponse.json({ ok: true });
  }

  // 默认 · 走老虾 agent (LLM-first · DeepSeek V4 + tool calling + 记忆)
  await sendTelegramMessage("…", { chatId, parseMode: undefined, silent: true });
  try {
    const r = await callLaoxia(chatId, text, BASE);
    await sendTelegramMessage(r.text, { chatId, parseMode: undefined });
  } catch (e) {
    await sendTelegramMessage(`✗ 老虾出问题 · ${(e as Error).message}`, { chatId, parseMode: undefined });
  }
  return NextResponse.json({ ok: true });
}

// 健康检查 (浏览器手测)
export async function GET() {
  return NextResponse.json({
    ok: true,
    enabled: tgEnabled(),
    instruction: tgEnabled()
      ? "POST 这个 URL · 走 webhook"
      : "缺 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 在 .env.local",
  });
}
