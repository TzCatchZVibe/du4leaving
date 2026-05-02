// /api/xiapan/baichuan/strategies
// V0.72 W3 Day 10 · 实时分配 · 你的 $X 应该怎么分到 15 策略

import { NextResponse } from "next/server";
import { readPools } from "@/lib/xiapan/百川/pools";
import { allocateStrategies } from "@/lib/xiapan/百川/allocator-strategies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bankrollOverride = parseFloat(url.searchParams.get("bankroll") ?? "0");

  const pools = readPools();
  const bankroll = bankrollOverride > 0
    ? bankrollOverride
    : (pools ? pools.S.balance + pools.C.balance : 400);

  const result = await allocateStrategies({
    bankroll,
    max_pct_per_strategy: 25,
    min_strategies: 5,
  });

  return NextResponse.json({
    ok: true,
    pools_initialized: !!pools,
    ...result,
    generated_at: new Date().toISOString(),
  });
}
