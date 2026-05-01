// /api/xiapan/polymarket?wallet=0x...
//
// Polymarket 链上账户 · 通过 Polymarket 公开 data-api 拉
// - /value     · portfolio 当前估值
// - /positions · 当前持仓
// - /trades    · 全成交记录 (近 N 单)
// - /activity  · 活动 log (含 redeem)
//
// docs · https://docs.polymarket.com/api-reference/data-api

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 60;

const POLY = "https://data-api.polymarket.com";

type ValueRow = { user: string; value: number };

type Position = {
  proxyWallet?: string;
  asset?: string;
  conditionId?: string;
  size?: number;
  avgPrice?: number;
  initialValue?: number;
  currentValue?: number;
  cashPnl?: number;
  percentPnl?: number;
  totalBought?: number;
  realizedPnl?: number;
  curPrice?: number;
  redeemable?: boolean;
  title?: string;
  slug?: string;
  outcome?: string;
  outcomeIndex?: number;
  endDate?: string;
};

type Trade = {
  proxyWallet?: string;
  asset?: string;
  conditionId?: string;
  side?: string;            // BUY / SELL
  size?: number;
  price?: number;
  timestamp?: number | string;
  title?: string;
  outcome?: string;
};

async function probe<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${POLY}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = (searchParams.get("wallet") || "").toLowerCase().trim();
  if (!wallet || !wallet.startsWith("0x") || wallet.length !== 42) {
    return NextResponse.json(
      { ok: false, error: "需 Polygon 钱包地址 0x... 42 字符" },
      { status: 400 }
    );
  }

  try {
    const [valueArr, positions, trades] = await Promise.all([
      probe<ValueRow[]>(`/value?user=${wallet}`),
      probe<Position[]>(`/positions?user=${wallet}&limit=50`),
      probe<Trade[]>(`/trades?user=${wallet}&limit=200`),
    ]);

    const value = valueArr?.[0]?.value ?? 0;

    // 汇总
    const totalRealized = (positions || []).reduce((s, p) => s + (p.realizedPnl || 0), 0);
    const totalCash = (positions || []).reduce((s, p) => s + (p.cashPnl || 0), 0);
    const totalCurrent = (positions || []).reduce((s, p) => s + (p.currentValue || 0), 0);
    const tradeVolume = (trades || []).reduce(
      (s, t) => s + (t.size || 0) * (t.price || 0),
      0
    );
    const tradeFees = 0; // Polymarket 0 fee

    return NextResponse.json({
      ok: true,
      wallet,
      generatedAt: new Date().toISOString(),
      summary: {
        portfolio_value: value,
        positions_count: positions?.length ?? 0,
        trades_count: trades?.length ?? 0,
        total_realized_pnl: Number(totalRealized.toFixed(2)),
        total_cash_pnl: Number(totalCash.toFixed(2)),
        total_current_value: Number(totalCurrent.toFixed(2)),
        trade_volume: Number(tradeVolume.toFixed(2)),
        trade_fees: tradeFees,
      },
      positions: positions ?? [],
      trades: trades ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
