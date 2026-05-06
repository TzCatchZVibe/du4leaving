// /api/wealth/lumpy · ② YNAB 大坑摊月

import { NextResponse } from "next/server";
import { lumpyTotal, setLumpyPaid } from "@/lib/wealth/lumpy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await lumpyTotal();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.slug || body.paid_usd == null) {
      return NextResponse.json({ ok: false, error: "缺 slug 或 paid_usd" }, { status: 400 });
    }
    const r = await setLumpyPaid(body.slug, Number(body.paid_usd));
    return NextResponse.json({ ok: true, lumpy: r });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
