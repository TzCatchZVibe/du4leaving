// /api/xiapan/baichuan/clv
// V0.72 W2 · CLV 跟踪报告

import { NextResponse } from "next/server";
import { computeCLV, clvSummary } from "@/lib/xiapan/百川/clv";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = computeCLV();
  const summary = clvSummary(records);
  return NextResponse.json({
    ok: true,
    summary,
    sample_records: records.slice(-10),
  });
}
