// /api/wealth/age-of-money · ③ YNAB 钱龄 · 签证缓冲指标

import { NextResponse } from "next/server";
import { getAgeOfMoney } from "@/lib/wealth/age-of-money";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const r = await getAgeOfMoney();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
