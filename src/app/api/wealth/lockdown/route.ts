// /api/wealth/lockdown · 冲动 lockdown · 阶段 1 #4
// 列 + 创建 + 决定

import { NextResponse } from "next/server";
import {
  createPending,
  listPending,
  listAll,
  decide,
  monthSavings,
  findByShortId,
  COOLDOWN_THRESHOLD_USD,
} from "@/lib/wealth/lockdown";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "pending";
  try {
    if (action === "stats") {
      const this_month = await monthSavings(0);
      const last_month = await monthSavings(-1);
      return NextResponse.json({ ok: true, this_month, last_month });
    }
    if (action === "all") {
      const days = parseInt(url.searchParams.get("days") || "30");
      const all = await listAll(days);
      return NextResponse.json({ ok: true, days, items: all });
    }
    if (action === "find") {
      const sid = url.searchParams.get("short_id") || "";
      const found = await findByShortId(sid);
      return NextResponse.json({ ok: true, item: found });
    }
    const pending = await listPending();
    return NextResponse.json({ ok: true, threshold_usd: COOLDOWN_THRESHOLD_USD, pending });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST · 创建 pending purchase
// body · { amount_usd, description, category?, cooldown_hours?, notes? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.amount_usd || !body.description) {
      return NextResponse.json({ ok: false, error: "缺 amount_usd 或 description" }, { status: 400 });
    }
    const pending = await createPending({
      amount_usd: Number(body.amount_usd),
      description: String(body.description),
      category: body.category,
      cooldown_hours: body.cooldown_hours ? Number(body.cooldown_hours) : undefined,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, pending });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// PATCH · 决定 (approve / cancel)
// body · { short_id, decision: 'approved' | 'cancelled' }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.short_id || !body.decision) {
      return NextResponse.json({ ok: false, error: "缺 short_id 或 decision" }, { status: 400 });
    }
    const item = await decide(body.short_id, body.decision);
    if (!item) return NextResponse.json({ ok: false, error: "找不到 short_id" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
