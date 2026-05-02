// /api/xiapan/baichuan/live-status
// V0.72 W3 · 真钱 client 状态 · 默认 OFF · 看 4 项 gate

import { NextResponse } from "next/server";
import { liveStatus, fetchBalance, RISK_LIMITS } from "@/lib/xiapan/百川/kalshi-live";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = liveStatus();
  let balance: number | null = null;
  let balance_error: string | null = null;
  if (status.enabled && status.has_key_id && status.has_private_key) {
    const r = await fetchBalance();
    if (r.ok) balance = r.balance ?? null;
    else balance_error = r.error ?? "unknown";
  }
  return NextResponse.json({
    ok: true,
    status,
    balance,
    balance_error,
    risk_limits: RISK_LIMITS,
    next_steps: status.enabled
      ? "✓ 真钱已启用 · 谨慎"
      : [
          "1. paper 满 30 单 + wr ≥ 53% + CLV > 0",
          "2. Kalshi 网站 · Settings · API · 创 RSA key pair",
          "3. .env.local 加 ·",
          "     LIVE_TRADING=true",
          "     KALSHI_API_KEY_ID=xxx",
          "     KALSHI_PRIVATE_KEY_PATH=/path/to/private.pem",
          "4. 重启 next-dev · /api/xiapan/baichuan/live-status 检全绿",
        ].join("\n"),
  });
}
