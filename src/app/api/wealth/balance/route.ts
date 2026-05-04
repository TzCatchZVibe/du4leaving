// /api/wealth/balance · 加 / 改 余额
// V0.74 W1

import { NextResponse } from "next/server";
import { recordBalanceBySlug, listAccounts, findAccount, recordBalance } from "@/lib/wealth/store";

export const dynamic = "force-dynamic";

// GET · 列所有账户 + 最新余额
export async function GET() {
  try {
    const accounts = await listAccounts(false);
    return NextResponse.json({ ok: true, accounts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST · { slug, balance, notes? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug, balance, notes } = body;
    if (!slug || balance === undefined) {
      return NextResponse.json({ ok: false, error: "缺 slug 或 balance" }, { status: 400 });
    }
    const acc = await findAccount(slug);
    if (!acc) return NextResponse.json({ ok: false, error: `账户 ${slug} 不存在` }, { status: 404 });
    const rec = await recordBalance(acc.id, Number(balance), "manual", notes);
    return NextResponse.json({ ok: true, balance: rec, account: acc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
