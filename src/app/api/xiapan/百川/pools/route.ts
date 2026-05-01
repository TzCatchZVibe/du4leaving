// /api/xiapan/百川/pools
// V0.72 · 两池状态 read + init
//
// GET  · 返回当前 pools 状态 (S / C / P0 / lifetime)
// POST · 初始化 P0 (仅首次 · 幂等)
//        body: { P0: 400 }

import { NextResponse } from "next/server";
import { readPools, initPools } from "@/lib/xiapan/百川/pools";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = readPools();
  if (!state) {
    return NextResponse.json({
      ok: true,
      initialized: false,
      message: "未初始化 · POST { P0: 400 } 起步",
    });
  }
  return NextResponse.json({ ok: true, initialized: true, state });
}

export async function POST(req: Request) {
  let body: { P0?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body.P0 || body.P0 <= 0 || body.P0 > 100_000) {
    return NextResponse.json(
      { ok: false, error: "P0 required · 0 < P0 ≤ 100000" },
      { status: 400 }
    );
  }
  const state = initPools(body.P0);
  return NextResponse.json({ ok: true, state });
}
