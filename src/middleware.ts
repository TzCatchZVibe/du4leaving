// V0.72 · API gate middleware
//
// 装了 cloudflared tunnel 后 · /api/xiapan/* 公网可达
// 这个 middleware 给所有 /api/xiapan/* 加一道门 ·
//
// 通过条件 (任一即可) ·
//   1. header x-api-token === API_TOKEN  (native app · cron · 内部)
//   2. 来源是 Tailscale (100.x) · localhost · LAN 192.168.x  (内网放行)
//   3. 路径是 /api/xiapan/telegram/webhook  (有自己的 secret_token 校验)
//
// 失败 → 401
//
// 没配 API_TOKEN 时 · 整个门关掉 · 等于现状 (向后兼容)

import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/api/xiapan/:path*"],
};

const TG_WEBHOOK_PATH = "/api/xiapan/telegram/webhook";

function isInternalIP(ip: string | null): boolean {
  if (!ip) return false;
  // 取首个 IP (x-forwarded-for 可能是逗号串)
  const first = ip.split(",")[0].trim();
  return (
    first === "127.0.0.1" ||
    first === "::1" ||
    first === "localhost" ||
    first.startsWith("100.") ||           // Tailscale CGNAT
    first.startsWith("192.168.") ||
    first.startsWith("10.") ||
    first.startsWith("172.")              // 172.16-31 内网
  );
}

export function middleware(req: NextRequest) {
  const expected = process.env.API_TOKEN;

  // 没配 token → 门关掉 · 兼容
  if (!expected) return NextResponse.next();

  // TG webhook 自带校验 · 跳过
  if (req.nextUrl.pathname === TG_WEBHOOK_PATH) return NextResponse.next();

  // 内网放行 (Tailscale / localhost / LAN)
  const fwd = req.headers.get("x-forwarded-for");
  const remote = req.headers.get("x-real-ip") ?? fwd;
  if (isInternalIP(remote)) return NextResponse.next();

  // header token 检查
  const got = req.headers.get("x-api-token");
  if (got === expected) return NextResponse.next();

  return NextResponse.json(
    { ok: false, error: "unauthorized · need x-api-token" },
    { status: 401 }
  );
}
