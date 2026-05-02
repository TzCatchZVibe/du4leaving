// /api/xiapan/baichuan/companions
// V0.72 W3 Day 10 · BG3 同伴 approval 报告

import { NextResponse } from "next/server";
import { computeApproval } from "@/lib/xiapan/百川/companion-approval";

export const dynamic = "force-dynamic";

export async function GET() {
  const companions = computeApproval();
  return NextResponse.json({
    ok: true,
    companions,
    consensus: companions.reduce((s, c) => s + c.approval, 0) / companions.length,
    blind_spots: companions.filter((c) => c.blind_spot).map((c) => ({ name: c.name, blind_spot: c.blind_spot })),
  });
}
