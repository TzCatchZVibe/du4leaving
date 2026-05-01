import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// V0.72 · API gate · cloudflared tunnel 公网开口子防护
// 给 /api/xiapan/* 加 token 门 · 仅当 API_TOKEN 配了才生效

const TG_WEBHOOK_PATH = "/api/xiapan/telegram/webhook";

function isInternalIP(ip: string | null): boolean {
  if (!ip) return false;
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

function apiGate(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith("/api/xiapan/")) return null;

  const expected = process.env.API_TOKEN;
  if (!expected) return null;                                    // 未配 → 关门
  if (req.nextUrl.pathname === TG_WEBHOOK_PATH) return null;     // TG webhook 自带 secret

  const fwd = req.headers.get("x-forwarded-for");
  const remote = req.headers.get("x-real-ip") ?? fwd;
  if (isInternalIP(remote)) return null;                         // 内网放行

  const got = req.headers.get("x-api-token");
  if (got === expected) return null;                             // token 对放行

  return NextResponse.json(
    { ok: false, error: "unauthorized · need x-api-token" },
    { status: 401 }
  );
}

export async function proxy(request: NextRequest) {
  const blocked = apiGate(request);
  if (blocked) return blocked;
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
