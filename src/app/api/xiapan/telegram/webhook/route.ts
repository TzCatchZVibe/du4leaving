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
import { chat } from "@/lib/xiapan/llm";
import { buildToolsDescription, parseToolCalls, executeTool } from "@/lib/xiapan/hermes-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface TgUpdate {
  message?: {
    message_id?: number;
    from?: { id?: number; username?: string; first_name?: string };
    chat?: { id?: number };
    text?: string;
  };
}

const SAGE_SYSTEM = `你是 Theo · Strategist · TZ 的押注顾问 (Telegram 接口版)

风格 · 沉稳 · 中文 · 不用专业术语 · 用了必括号解释
长度 · ≤ 200 字 (Telegram 屏幕小)

回答结构 (必须严格 markdown · 跨平台简洁) ·

## 决策
干 / 不干 / 等等 (一句话)

## 理由
2-3 条 · 引数据

## 仓位
具体百分比 + 美元 · 如 "押 3% = $30 / 50 张"

像 7 年老 trader 给学徒发语音 · 不催 · 不忽悠`;

async function callSage(question: string): Promise<{ text: string; provider: string }> {
  const toolsDesc = buildToolsDescription();
  const augmented = `${SAGE_SYSTEM}\n\n${toolsDesc}`;
  let currentPrompt = question;
  let last = { text: "", provider: "static" };

  // 多回合 · 最多 3 跳
  for (let hop = 0; hop < 3; hop++) {
    const r = await chat({
      system: augmented,
      user: currentPrompt,
      jsonOutput: false,
      temperature: 0.3,
    });
    last = { text: r.text, provider: r.provider };
    const { toolCalls, rawAnswer } = parseToolCalls(r.text);
    if (!toolCalls || toolCalls.length === 0 || hop === 2) {
      last.text = rawAnswer || r.text;
      break;
    }
    const results = await Promise.all(toolCalls.slice(0, 3).map(executeTool));
    currentPrompt = question + "\n\n【工具结果】\n" +
      results.map(rr => `· ${rr.name}: ${rr.error ? "ERR" : JSON.stringify(rr.result).slice(0, 600)}`).join("\n") +
      "\n\n基于工具数据 · 直接 markdown 答。";
  }
  return last;
}

export async function POST(req: Request) {
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
      "百川 · 紧急短信通道\n" +
      "─────────────────\n\n" +
      "Telegram 不是游戏 · 是 SMS\n" +
      "游戏面板在 Mac app · 打开 Du4Leaving 看\n\n" +
      "Telegram 唯一一个命令 ·\n" +
      "  /钱   出门时一眼瞥 (P0/S/C/今日)\n\n" +
      "我自动 push 你 (仅紧急 · 别的全静默) ·\n" +
      "  🚨 熔断触发 (账户异常)\n" +
      "  🚨 第一笔真单成功\n" +
      "  🚨 月底分钱报告\n" +
      "  🚨 系统挂掉\n\n" +
      "其他 25+ 旧命令 · 仍能用 · 但建议忘\n" +
      "回到 Mac · 打开 Du4Leaving · 那是游戏",
      { chatId, parseMode: undefined }
    );
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

  // 默认 · 走 Theo (Hermes sage)
  // 立刻回 "想一下…" 不让用户等
  await sendTelegramMessage("▲ Theo 想一下...", { chatId, parseMode: undefined, silent: true });

  try {
    const result = await callSage(text);
    await sendTelegramMessage(
      `${result.text}\n\n— 用 ${result.provider}`,
      { chatId, parseMode: undefined }
    );
  } catch (e) {
    await sendTelegramMessage(
      `✗ Theo 暂时不可用 · ${(e as Error).message}\n稍后再问`,
      { chatId, parseMode: undefined }
    );
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
