// /api/xiapan/fda-edges
//
// V0.72 W2 Day 4 · FDA AdCom + Phase 3 信号源 · C 池凸性桶
//
// 数据驱动 ·
//   1. ~/.du4leaving/百川/fda/adcom-calendar.json (人工 seed · POST 更新)
//   2. 历史基率 + AdCom 投票 → P
//   3. Phase 3 readout shift
//
// 输出 Signal[] 给 fusion · source: fda-adcom

import { NextResponse } from "next/server";
import {
  readAdComCalendar,
  writeAdComCalendar,
  fairPFromAdCom,
  type AdComMeeting,
} from "@/lib/xiapan/百川/fda";
import type { Signal } from "@/lib/xiapan/百川/fusion";

export const dynamic = "force-dynamic";

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiMarket {
  ticker: string;
  status?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  volume_24h_fp?: string;
}

async function fetchKalshiMarket(ticker: string): Promise<KalshiMarket | null> {
  try {
    const r = await fetch(`${KALSHI_API}/markets/${ticker}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.market ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const meetings = readAdComCalendar();
  if (meetings.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "AdCom 日历为空 · 通过 POST 添加 meeting",
      signals: [],
      meetings: [],
    });
  }

  const edges: Array<{
    meeting: AdComMeeting;
    fair_p?: number;
    market_p?: number;
    edge_pp?: number;
    vol_24?: number;
    spread_c?: number;
    signal?: Signal;
  }> = [];

  for (const m of meetings) {
    if (!m.kalshi_ticker) {
      edges.push({ meeting: m });
      continue;
    }
    const market = await fetchKalshiMarket(m.kalshi_ticker);
    if (!market || (market.status !== "active" && market.status !== "open")) {
      edges.push({ meeting: m });
      continue;
    }
    const yes_ask_c = parseFloat(market.yes_ask_dollars || "0") * 100;
    const yes_bid_c = parseFloat(market.yes_bid_dollars || "0") * 100;
    if (yes_ask_c <= 0 || yes_ask_c >= 100) {
      edges.push({ meeting: m });
      continue;
    }
    const market_p = yes_ask_c / 100;
    const vol_24 = parseFloat(market.volume_24h_fp || "0");
    const spread_c = yes_ask_c - yes_bid_c;

    const { P: fair_p, reasoning } = fairPFromAdCom(m);
    const edge_pp = (fair_p - market_p) * 100;

    let signal: Signal | undefined;
    // C 池凸性 · 高门槛 · |edge| ≥ 12pp 才触发
    if (Math.abs(edge_pp) >= 12 && vol_24 >= 100) {
      const direction: 1 | -1 = edge_pp >= 0 ? 1 : -1;
      signal = {
        source: "fda-adcom",
        ticker: m.kalshi_ticker,
        direction,
        predicted_p: fair_p,
        confidence: m.vote_status && m.vote_status !== "scheduled" ? 0.70 : 0.55,
        reason: `${m.drug} (${m.indication}) · ${reasoning}`,
        ts: new Date().toISOString(),
        data: {
          drug: m.drug,
          sponsor: m.sponsor,
          vote_status: m.vote_status,
          pdufa_date: m.pdufa_date,
        },
      };
    }

    edges.push({ meeting: m, fair_p, market_p, edge_pp, vol_24, spread_c, signal });
  }

  const signals = edges.map((e) => e.signal).filter((s): s is Signal => !!s);

  return NextResponse.json({
    ok: true,
    summary: {
      total_meetings: meetings.length,
      with_kalshi: edges.filter((e) => e.market_p !== undefined).length,
      signals: signals.length,
    },
    edges,
    signals,
  });
}

// POST · 添加 / 更新 AdCom meeting
//   body · { meeting: AdComMeeting }  // upsert by drug+date
export async function POST(req: Request) {
  let body: { meeting?: AdComMeeting };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body.meeting?.drug || !body.meeting?.date) {
    return NextResponse.json({ ok: false, error: "meeting.drug and date required" }, { status: 400 });
  }
  const meetings = readAdComCalendar();
  const idx = meetings.findIndex((m) => m.drug === body.meeting!.drug && m.date === body.meeting!.date);
  if (idx >= 0) meetings[idx] = body.meeting;
  else meetings.push(body.meeting);
  writeAdComCalendar(meetings);
  return NextResponse.json({ ok: true, total: meetings.length, meeting: body.meeting });
}
