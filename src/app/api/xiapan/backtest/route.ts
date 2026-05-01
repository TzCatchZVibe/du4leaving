// /api/xiapan/backtest
//
// 时间旅行 backtest · 反事实分析 · "如果只做 X 我会赚多少"
//
// 现状 · 我们没存历史 edge 快照 · 真正 backtest 难
// 替代 · 拉用户实际 fills + settlements · 按多种 filter 算反事实 PnL
//
// strategies ·
// 1. all          · 你实际所有
// 2. winners-only · 只保留 settle = win 的 (理想)
// 3. strong-only  · 只保留 fill_price 已被 close 验证为 sharp (clv >= 5pp)
// 4. by-sport-X   · 只保留某 sport
// 5. by-side-yes  · 只买 yes
// 6. avoid-night  · 22:00-06:00 不下
// 7. avoid-tilt   · 单日亏 ≥$15 后 24h 不下
//
// 输出 · 每 strategy 模拟 PnL + ROI + 与 actual 对比

import { NextResponse } from "next/server";
import { authedKalshi } from "@/lib/xiapan/kalshi-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  market_result?: string;
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

    const sett = new Map<string, Settlement>();
    for (const s of settlements) sett.set(s.ticker, s);

    // 单 fill PnL 摊分 · settlement.pnl 平摊到该 ticker 的所有 fills
    const fillsByTicker = new Map<string, Fill[]>();
    for (const f of fills) {
      const arr = fillsByTicker.get(f.ticker) || [];
      arr.push(f);
      fillsByTicker.set(f.ticker, arr);
    }

    type EnrichedFill = Fill & {
      sport: string;
      cost: number;
      pnl: number;
      hour: number;
      dow: number;
      ts_ms: number;
      is_settled: boolean;
      is_winner: boolean;
    };

    const enriched: EnrichedFill[] = fills.map((f) => {
      const settle = sett.get(f.ticker);
      const fillPrice = fp(f.yes_price_dollars || f.no_price_dollars);
      const cost = fp(f.count_fp) * fillPrice;
      const tickerCount = fillsByTicker.get(f.ticker)?.length || 1;
      const totalPnl = settle ? fp(settle.realized_pnl) : 0;
      const pnl = totalPnl / Math.max(1, tickerCount);
      const date = new Date(f.created_time);
      return {
        ...f,
        sport: sportOf(f.ticker),
        cost,
        pnl,
        hour: date.getHours(),
        dow: date.getDay(),
        ts_ms: date.getTime(),
        is_settled: !!settle,
        is_winner:
          settle?.market_result === f.side ||
          (settle?.market_result === "yes" && f.side === "yes") ||
          (settle?.market_result === "no" && f.side === "no"),
      };
    });

    // 计算 actual baseline
    const sumPnl = (xs: EnrichedFill[]) => xs.reduce((s, x) => s + x.pnl, 0);
    const sumCost = (xs: EnrichedFill[]) => xs.reduce((s, x) => s + x.cost, 0);
    const sumFee = (xs: EnrichedFill[]) =>
      xs.reduce((s, x) => s + fp(x.fee_cost), 0);

    const summarize = (xs: EnrichedFill[], label: string) => {
      const pnl = sumPnl(xs);
      const cost = sumCost(xs);
      const fee = sumFee(xs);
      const net = pnl - fee;
      return {
        strategy: label,
        kept_count: xs.length,
        pnl: Number(pnl.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        fee: Number(fee.toFixed(2)),
        net_pnl: Number(net.toFixed(2)),
        roi: cost > 0 ? Number((net / cost).toFixed(3)) : 0,
      };
    };

    // Strategy filters
    const all = enriched;
    const winnersOnly = enriched.filter((x) => x.is_winner);
    const strongOnly = enriched.filter((x) => x.is_winner); // 简化 · 真 strong 需 historical edge
    const yesOnly = enriched.filter((x) => x.side === "yes");
    const noOnly = enriched.filter((x) => x.side === "no");
    const noNight = enriched.filter((x) => !(x.hour >= 22 || x.hour < 6));
    const sortedByDay = [...enriched].sort((a, b) => a.ts_ms - b.ts_ms);

    // tilt-cooldown · 任意单日亏 ≥ $15 后 24h 内的 fills 删除
    const cooldownExclude = new Set<string>();
    const dayPnl = new Map<string, number>();
    for (const f of sortedByDay) {
      const day = new Date(f.ts_ms).toISOString().slice(0, 10);
      dayPnl.set(day, (dayPnl.get(day) || 0) + f.pnl);
    }
    const tiltDays = new Set<string>();
    for (const [d, v] of dayPnl) if (v <= -15) tiltDays.add(d);
    for (const f of enriched) {
      const tsDay = new Date(f.ts_ms);
      // 看前 24h 是否在 tilt day
      for (const td of tiltDays) {
        const tdMs = new Date(td + "T23:59:59").getTime();
        if (f.ts_ms > tdMs && f.ts_ms - tdMs < 24 * 3600 * 1000) {
          cooldownExclude.add(f.ticker + f.created_time);
          break;
        }
      }
    }
    const noTilt = enriched.filter((x) => !cooldownExclude.has(x.ticker + x.created_time));

    // sport-specific
    const sports = ["lol", "nba", "mlb", "nfl", "nhl", "tennis", "soccer", "crypto"];
    const bySport = sports.map((sp) =>
      summarize(enriched.filter((x) => x.sport === sp), `只下 ${sp.toUpperCase()}`)
    );

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      actual: summarize(all, "实际 (全下)"),
      strategies: [
        summarize(winnersOnly, "只保留中的 (理想 · 验证模型)"),
        summarize(yesOnly, "只买 yes"),
        summarize(noOnly, "只买 no"),
        summarize(noNight, "凌晨 22:00-06:00 不下"),
        summarize(noTilt, "亏 $15 后 24h 不下 (反 tilt)"),
        ...bySport.filter((b) => b.kept_count > 0),
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
