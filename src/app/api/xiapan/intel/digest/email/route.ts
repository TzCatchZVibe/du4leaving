// /api/xiapan/intel/digest/email
//
// V0.63 · 把每日简报发邮件 (Resend 免费 100/天)
//
// 触发 ·
//   GET 手动 (UI 按钮)
//   GET ?cron=1 (Vercel Cron 8:05 AM ET · 在 digest 跑完 5min 后)
//
// env ·
//   RESEND_API_KEY  (free tier · resend.com)
//   DIGEST_EMAIL_TO (default tomouzheng@gmail.com)
//   CRON_SECRET     (可选 · cron 验证)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";
const URL_PREFIX = baseURL.startsWith("http") ? baseURL : `https://${baseURL}`;

interface DigestData {
  ok: boolean;
  date: string;
  digest_md: string;
  cached: boolean;
  provider: string;
}

function mdToHtml(md: string): string {
  // 极简 markdown → HTML · 不依赖库
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const ln of lines) {
    if (ln.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1 style="font-family:Georgia,serif;font-size:22px;color:#111;margin:20px 0 8px;">${ln.slice(2)}</h1>`);
    } else if (ln.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2 style="font-size:14px;color:#b47820;margin:14px 0 4px;">${ln.slice(3)}</h2>`);
    } else if (ln.startsWith("- ") || ln.startsWith("* ") || ln.startsWith("· ")) {
      if (!inList) { out.push("<ul style='font-family:monospace;font-size:13px;color:#111;line-height:1.5;padding-left:20px;'>"); inList = true; }
      out.push(`<li>${ln.replace(/^[-*·]\s+/, "")}</li>`);
    } else if (ln.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p style="font-family:monospace;font-size:13px;color:#2a2a2a;line-height:1.6;margin:6px 0;">${ln}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

async function fetchDigest(): Promise<DigestData | null> {
  try {
    const r = await fetch(`${URL_PREFIX}/api/xiapan/intel/digest`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as DigestData;
  } catch {
    return null;
  }
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY not set · 装免费版 resend.com 拿 key" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "DU4LEAVING <onboarding@resend.dev>",
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!r.ok) {
      return { ok: false, error: `Resend ${r.status} ${await r.text()}` };
    }
    const d = await r.json() as { id?: string };
    return { ok: true, id: d.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("cron") === "1";

  if (isCron) {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.headers.get("authorization") ?? "";
      if (got !== `Bearer ${expected}`) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }
  }

  const digest = await fetchDigest();
  if (!digest || !digest.digest_md) {
    return NextResponse.json({ ok: false, error: "no digest available · run /digest first" }, { status: 200 });
  }

  const to = url.searchParams.get("to") ?? process.env.DIGEST_EMAIL_TO ?? "tomouzheng@gmail.com";
  const subject = `du4 早间简报 · ${digest.date}`;

  const html = `
    <div style="max-width:640px;margin:0 auto;background:#f1ebdc;padding:32px;font-family:'Helvetica Neue',sans-serif;">
      <div style="font-size:11px;color:#6a6052;font-family:monospace;margin-bottom:8px;">
        DU4LEAVING · 早间简报 · ${digest.date} · via ${digest.provider}
      </div>
      ${mdToHtml(digest.digest_md)}
      <hr style="border:none;border-top:1px solid #11111120;margin:24px 0;">
      <p style="font-size:11px;color:#6a6052;font-family:monospace;line-height:1.5;">
        · 数据 · Polymarket Gamma + Kalshi 公开 + CryptoPanic + Wallstreet CN + YN Signals<br/>
        · 完整版 · <a href="${URL_PREFIX}/xiapan" style="color:#c1272d;">/xiapan</a><br/>
        · 公开热力图 · <a href="${URL_PREFIX}/heatmap" style="color:#c1272d;">/heatmap</a><br/>
        · 不构成投资建议 · 押注有亏损风险 · 量力而行
      </p>
    </div>
  `;

  const text =
    `du4 早间简报 · ${digest.date}\n\n` +
    digest.digest_md +
    `\n\n---\n· 完整版 · ${URL_PREFIX}/xiapan\n· 热力图 · ${URL_PREFIX}/heatmap`;

  const sent = await sendViaResend({ to, subject, html, text });

  return NextResponse.json({
    ok: sent.ok,
    sent_to: to,
    date: digest.date,
    digest_provider: digest.provider,
    resend_id: sent.id,
    error: sent.error,
  });
}
