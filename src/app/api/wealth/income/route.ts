// /api/wealth/income · HG 工资 + 奖金 + CZV 营收 1 屏

import { NextResponse } from "next/server";
import { summarizeIncome } from "@/lib/wealth/income";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  try {
    const this_month = await summarizeIncome(offset);
    const last_month = await summarizeIncome(offset - 1);
    return NextResponse.json({ ok: true, this_month, last_month });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
