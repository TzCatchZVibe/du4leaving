// telegram.ts · V0.71 · Telegram bot 入口 (替手机版 du4 app)
//
// Bot 创建 ·
//   TG 找 @BotFather → /newbot → 起名 → 拿 token
//   .env.local · TELEGRAM_BOT_TOKEN=xxx
//   TELEGRAM_CHAT_ID=你 chat ID (找 @userinfobot 拿)
//
// 入站 (你 @ 老虎) · /api/xiapan/telegram/webhook (Telegram 推过来)
// 出站 (push 你) · sendTelegramMessage(text)

const TG_API = "https://api.telegram.org";

export function tgEnabled(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

export interface TgSendOpts {
  /** 默认发到 TELEGRAM_CHAT_ID · 想发别人传 chatId */
  chatId?: string;
  /** markdown V2 (默认) / HTML / undefined */
  parseMode?: "MarkdownV2" | "HTML" | undefined;
  /** 静默 push (晚上不响) */
  silent?: boolean;
}

/// 发消息 · 自动转义 markdownV2 特殊字符
export async function sendTelegramMessage(text: string, opts: TgSendOpts = {}): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "TG 没配置 (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)" };
  }
  const parseMode = opts.parseMode ?? "MarkdownV2";
  const body = parseMode === "MarkdownV2" ? escapeMd(text) : text;
  try {
    const r = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body.slice(0, 4000),
        parse_mode: parseMode,
        disable_notification: opts.silent === true,
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `TG ${r.status} ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/// MarkdownV2 必须转义这些字符
function escapeMd(s: string): string {
  return s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/// 短消息 (无 markdown · 单纯 text · 适合 alert)
export async function sendTelegramAlert(title: string, body: string): Promise<{ ok: boolean; error?: string }> {
  return sendTelegramMessage(`${title}\n\n${body}`, { parseMode: undefined });
}

/// 简单 dedup · 同 key 5min 内不重发
const sendCache = new Map<string, number>();
export async function sendTelegramAlertDedupe(key: string, title: string, body: string): Promise<{ ok: boolean; deduped?: boolean }> {
  const last = sendCache.get(key);
  const now = Date.now();
  if (last && now - last < 300_000) {
    return { ok: true, deduped: true };
  }
  sendCache.set(key, now);
  // 清老 key
  if (sendCache.size > 500) {
    for (const [k, ts] of sendCache.entries()) {
      if (now - ts > 3600_000) sendCache.delete(k);
    }
  }
  return await sendTelegramAlert(title, body);
}
