// /api/xiapan/insights
//
// Lifetime aggregation · single-screen overview of TZ's entire DU4LEAVING activity
// 公式来自 quant (ADR-0001) · 实现来自 next-engineer · 显示来自 swift-engineer
//
// 8 核心 KPI ·
//   1. total_volume      $ 累计成交
//   2. total_fee         $ 累计抽水
//   3. total_pnl         $ 已结净盈亏
//   4. net_pnl           $ 净 = pnl - fee
//   5. roi_pct           % 净 / 总投入
//   6. win_rate          % 已结中赢的比例
//   7. brier_lite        模型实战 Brier (近似 · fill price vs 0/100 settlement)
//   8. clv_avg_pp        平均 CLV (vs current/closing)
//
// 排名 ·
//   - bySport (top 3 best · top 3 worst)
//   - byHour  (best hour vs worst hour)
//   - byDayOfWeek (best dow vs worst dow)
//
// 故事 ·
//   - current_streak (win 或 lose · n 单)
//   - biggest_win (单笔最大盈)
//   - biggest_loss (单笔最大亏)
//   - sharpest_call (CLV 最高的单)

import { NextResponse } from "next/server";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 300;        // 5min cache · TZ 高频访问 · 0 钱省

type Fill = {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count_fp: string;
  yes_price_dollars?: string;
  no_price_dollars?: string;
  fee_cost?: string;
  created_time: string;
};
type Settlement = {
  ticker: string;
  market_result?: string;     // "yes" | "no" | "void"
  realized_pnl?: string;
  settled_time: string;
};

const fp = (s: string | undefined) => parseFloat(s || "0");

const sportOf = (t: string): string => {
  const u = t.toUpperCase();
  if (u.includes("LOL")) return "lol";
  if (u.includes("NBA")) return "nba";
  if (u.includes("MLB")) return "mlb";
  if (u.includes("NFL")) return "nfl";
  if (u.includes("NHL")) return "nhl";
  if (u.includes("ITF") || u.includes("ATP") || u.includes("WTA")) return "tennis";
  if (u.includes("EPL") || u.includes("UCL") || u.includes("MLS")) return "soccer";
  if (u.includes("BTC") || u.includes("ETH") || u.includes("SOL")) return "crypto";
  return "other";
};

export async function GET() {
  try {
    const [fillsResp, setResp] = await Promise.all([
      authedKalshi<{ fills?: Fill[] }>("GET", "/portfolio/fills?limit=500"),
      authedKalshi<{ settlements?: Settlement[] }>("GET", "/portfolio/settlements?limit=500"),
    ]);
    const fills = fillsResp.fills || [];
    const settlements = setResp.settlements || [];

    if (fills.length === 0 && settlements.length === 0) {
      return NextResponse.json({
        ok: true,
        empty: true,
        generatedAt: new Date().toISOString(),
      });
    }

    // index settlements
    const sett = new Map<string, Settlement>();
    for (const s of settlements) sett.set(s.ticker, s);

    // group fills per ticker
    const fillsByTicker = new Map<string, Fill[]>();
    for (const f of fills) {
      const arr = fillsByTicker.get(f.ticker) || [];
      arr.push(f);
      fillsByTicker.set(f.ticker, arr);
    }

    // ── 8 核心 KPI ──────────────────────────────
    let totalVolume = 0;
    let totalFee = 0;
    let totalPnl = 0;
    let settledCount = 0;
    let wonCount = 0;
    let brierSum = 0;        // sum of (fill_price - actual)^2
    let brierCount = 0;
    let clvSum = 0;          // sum of clv_pp
    let clvCount = 0;

    for (const f of fills) {
      const fillPrice = fp(f.yes_price_dollars || f.no_price_dollars);
      const cost = fp(f.count_fp) * fillPrice;
      totalVolume += cost;
      totalFee += fp(f.fee_cost);
    }
    for (const s of settlements) {
      totalPnl += fp(s.realized_pnl);
      settledCount++;
      // 这 ticker 的 fills 算 brier + clv
      const tickerFills = fillsByTicker.get(s.ticker) || [];
      for (const tf of tickerFills) {
        const fillPrice = fp(tf.yes_price_dollars || tf.no_price_dollars);
        // Brier · 你买 yes 价为 p · 真实 yes-win 1 / no-win 0
        // 注 yes 视角 · buy no 价 (1-p) 折算 yes 实际值
        const isWinSide =
          (s.market_result === "yes" && tf.side === "yes") ||
          (s.market_result === "no" && tf.side === "no");
        if (isWinSide) wonCount++;
        const yesActual =
          s.market_result === "yes" ? 1 :
          s.market_result === "no"  ? 0 :
          0.5;
        // 你的押 yes 价 (yes 视角 implied)
        const yesP = tf.side === "yes" ? fillPrice : 1 - fillPrice;
        brierSum += (yesP - yesActual) * (yesP - yesActual);
        brierCount++;
        // CLV pp · 你 fill 价 vs 结算 = 100¢/0¢
        const refC = s.market_result === "yes" ? 100 : s.market_result === "no" ? 0 : 50;
        const fillC = Math.round(fillPrice * 100);
        const sideFactor = tf.side === "yes" ? 1 : -1;
        const clv = (refC - fillC) * sideFactor;
        clvSum += clv;
        clvCount++;
      }
    }

    const netPnl = totalPnl - totalFee;
    const roiPct = totalVolume > 0 ? netPnl / totalVolume : 0;
    const winRate = settledCount > 0 ? wonCount / settledCount : 0;
    const brierLite = brierCount > 0 ? brierSum / brierCount : 0;
    const clvAvgPp = clvCount > 0 ? clvSum / clvCount : 0;

    // ── 排名 by sport ──────────────────────────
    type Bucket = { count: number; netPnl: number; volume: number };
    const sportBucket: Record<string, Bucket> = {};
    const hourBucket: Record<number, Bucket> = {};
    const dowBucket: Record<number, Bucket> = {};

    for (const f of fills) {
      const sp = sportOf(f.ticker);
      const fillPrice = fp(f.yes_price_dollars || f.no_price_dollars);
      const cost = fp(f.count_fp) * fillPrice;
      const fee = fp(f.fee_cost);
      const tickerCount = fillsByTicker.get(f.ticker)?.length || 1;
      const settle = sett.get(f.ticker);
      const netForFill = settle ? (fp(settle.realized_pnl) / Math.max(1, tickerCount)) - fee : -fee;
      const date = new Date(f.created_time);
      const hour = date.getHours();
      const dow = date.getDay();

      sportBucket[sp] = sportBucket[sp] || { count: 0, netPnl: 0, volume: 0 };
      sportBucket[sp].count++;
      sportBucket[sp].netPnl += netForFill;
      sportBucket[sp].volume += cost;

      hourBucket[hour] = hourBucket[hour] || { count: 0, netPnl: 0, volume: 0 };
      hourBucket[hour].count++;
      hourBucket[hour].netPnl += netForFill;
      hourBucket[hour].volume += cost;

      dowBucket[dow] = dowBucket[dow] || { count: 0, netPnl: 0, volume: 0 };
      dowBucket[dow].count++;
      dowBucket[dow].netPnl += netForFill;
      dowBucket[dow].volume += cost;
    }

    const sportSorted = Object.entries(sportBucket)
      .map(([k, v]) => ({ key: k, ...v, roi: v.volume > 0 ? v.netPnl / v.volume : 0 }))
      .sort((a, b) => b.netPnl - a.netPnl);
    const hourSorted = Object.entries(hourBucket)
      .map(([k, v]) => ({ key: parseInt(k), ...v }))
      .sort((a, b) => b.netPnl - a.netPnl);
    const dowSorted = Object.entries(dowBucket)
      .map(([k, v]) => ({ key: parseInt(k), ...v }))
      .sort((a, b) => b.netPnl - a.netPnl);

    // ── 故事 ────────────────────────────────────
    // streak · 按 settlement 时间排序 · 当前连续同结果数
    const sortedSettlements = [...settlements].sort(
      (a, b) => (b.settled_time || "").localeCompare(a.settled_time || "")
    );
    let streakKind: "win" | "lose" | null = null;
    let streakCount = 0;
    for (const s of sortedSettlements) {
      const tickerFills = fillsByTicker.get(s.ticker) || [];
      if (tickerFills.length === 0) continue;
      const first = tickerFills[0];
      const isWin =
        (s.market_result === "yes" && first.side === "yes") ||
        (s.market_result === "no" && first.side === "no");
      const kind: "win" | "lose" = isWin ? "win" : "lose";
      if (streakKind === null) { streakKind = kind; streakCount = 1; continue; }
      if (kind === streakKind) streakCount++;
      else break;
    }

    // biggest win / loss · 看 settlement.realized_pnl 极值
    const bestSettle = settlements.reduce<Settlement | null>(
      (best, s) => !best || fp(s.realized_pnl) > fp(best.realized_pnl) ? s : best,
      null
    );
    const worstSettle = settlements.reduce<Settlement | null>(
      (worst, s) => !worst || fp(s.realized_pnl) < fp(worst.realized_pnl) ? s : worst,
      null
    );

    return NextResponse.json({
      ok: true,
      empty: false,
      generatedAt: new Date().toISOString(),
      kpi: {
        total_volume: Number(totalVolume.toFixed(2)),
        total_fee: Number(totalFee.toFixed(2)),
        total_pnl: Number(totalPnl.toFixed(2)),
        net_pnl: Number(netPnl.toFixed(2)),
        roi_pct: Number(roiPct.toFixed(4)),
        win_rate: Number(winRate.toFixed(3)),
        brier_lite: Number(brierLite.toFixed(4)),
        clv_avg_pp: Number(clvAvgPp.toFixed(2)),
      },
      counts: {
        total_fills: fills.length,
        unique_tickers: fillsByTicker.size,
        settled: settledCount,
        won: wonCount,
      },
      ranking: {
        bySport: sportSorted.map((b) => ({
          key: b.key,
          count: b.count,
          net_pnl: Number(b.netPnl.toFixed(2)),
          volume: Number(b.volume.toFixed(2)),
          roi: Number(b.roi.toFixed(3)),
        })),
        byHour: hourSorted.slice(0, 5).concat(hourSorted.slice(-3)).map((b) => ({
          hour: b.key,
          count: b.count,
          net_pnl: Number(b.netPnl.toFixed(2)),
        })),
        byDayOfWeek: dowSorted.map((b) => ({
          dow: b.key,
          count: b.count,
          net_pnl: Number(b.netPnl.toFixed(2)),
        })),
      },
      stories: {
        streak: streakKind ? { kind: streakKind, count: streakCount } : null,
        biggest_win: bestSettle && fp(bestSettle.realized_pnl) > 0 ? {
          ticker: bestSettle.ticker,
          pnl: Number(fp(bestSettle.realized_pnl).toFixed(2)),
          settled_time: bestSettle.settled_time,
        } : null,
        biggest_loss: worstSettle && fp(worstSettle.realized_pnl) < 0 ? {
          ticker: worstSettle.ticker,
          pnl: Number(fp(worstSettle.realized_pnl).toFixed(2)),
          settled_time: worstSettle.settled_time,
        } : null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
