// /api/wealth/export · 阶段 1 #22 1 键导出 CSV (去中心化承诺)
// V0.74 W1 · 你能随时拿走全部数据

import { NextResponse } from "next/server";
import { exportAllAsCsv } from "@/lib/wealth/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const csv = await exportAllAsCsv();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="du4leaving-wealth-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
