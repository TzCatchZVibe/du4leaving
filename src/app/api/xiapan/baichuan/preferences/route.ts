// /api/xiapan/baichuan/preferences · 读 / 改 user 偏好品类
// V0.73 W1 Day 3 · C 模式

import { NextResponse } from "next/server";
import { readPreferences, writePreferences } from "@/lib/xiapan/百川/preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ...readPreferences() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cur = readPreferences();
    const next = {
      user_categories: body.user_categories ?? cur.user_categories,
      auto_categories: body.auto_categories ?? cur.auto_categories,
      updated_at: new Date().toISOString(),
    };
    writePreferences(next);
    return NextResponse.json({ ok: true, ...next });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
