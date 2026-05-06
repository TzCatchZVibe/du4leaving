// /api/wealth/jar · ① Guilty Pleasure · 看罐子状态

import { NextResponse } from "next/server";
import { listJars } from "@/lib/wealth/guilty";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jars = await listJars();
    return NextResponse.json({ ok: true, jars });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
