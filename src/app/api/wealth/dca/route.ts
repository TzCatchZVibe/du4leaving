// /api/wealth/dca · DCA 计划 + 执行历史 · #7

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const c = sb();
    const { data: plans } = await c.from("dca_plans").select("*").eq("active", true);
    const { data: recent } = await c.from("dca_executions").select("*").order("scheduled_at", { ascending: false }).limit(10);
    return NextResponse.json({ ok: true, plans: plans || [], recent: recent || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST · { plan_id, status, ticker_price_usd?, notes? } · 标记执行
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const c = sb();
    const { data, error } = await c.from("dca_executions").insert({
      plan_id: body.plan_id,
      scheduled_at: body.scheduled_at || new Date().toISOString(),
      amount_usd: body.amount_usd,
      status: body.status || "executed",
      ticker_price_usd: body.ticker_price_usd,
      notes: body.notes,
      executed_at: body.status === "executed" ? new Date().toISOString() : null,
    }).select("*").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, execution: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
