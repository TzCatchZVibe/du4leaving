// 虾盘 · cron · Kalshi LOL events 抓取 + market 报价快照
//
// 关键 · 用 /events?series_ticker=KXLOLGAME 而不是 /markets
//        因为 Kalshi LOL markets 嵌套在 events 下
//
// schedule (vercel.json) · 每 5 分钟一次
// auth · Authorization: Bearer ${CRON_SECRET}
//
// 流程 ·
//   1. fetchAllLolEvents() 拉所有 LOL events (KXLOLGAME)
//   2. 过滤未来 14 天内的
//   3. 每个 event 拉详情 (含嵌套 markets)
//   4. parseEventSubtitle → team1/team2 → slug
//   5. 关联 xiapan_matches (按 teams + 时间 24h tolerance)
//   6. pickMatchWinnerMarket → 主胜负 market 的报价
//   7. upsert xiapan_markets (kalshi_ticker = market ticker)

import { NextResponse } from "next/server";
import { authorizeCron, xiapanAdminDb } from "@/lib/xiapan/db-admin";
import {
  fetchAllLolEvents,
  fetchEventDetail,
  parseEventSubtitle,
  parseEventTicker,
  pickMatchWinnerMarket,
  teamNameToSlug,
  dollarStrToCents,
  fpToNumber,
} from "@/lib/xiapan/kalshi";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CONCURRENCY = 4;
const WINDOW_FUTURE_DAYS = 14;
const WINDOW_PAST_DAYS = 1;

type TeamRow = {
  id: string;
  slug: string;
  short_code: string | null;
};

type MatchRow = {
  id: string;
  scheduled_at: string;
  team1_id: string;
  team2_id: string;
};

async function pMap<T, R>(
  items: T[],
  fn: (x: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch {
        results[idx] = null as unknown as R;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let totalEvents = 0;
  let inWindow = 0;
  let mappedEvents = 0;
  let matchedToDb = 0;
  let upserted = 0;

  try {
    const sb = xiapanAdminDb();

    // 1. 拉所有 LOL events
    const events = await fetchAllLolEvents();
    totalEvents = events.length;

    // 2. 解析 + 过滤窗口内
    const now = Date.now();
    const past = now - WINDOW_PAST_DAYS * 24 * 3600 * 1000;
    const future = now + WINDOW_FUTURE_DAYS * 24 * 3600 * 1000;
    const candidates = [];
    for (const ev of events) {
      const parsed = parseEventTicker(ev.event_ticker);
      const t = parsed.scheduledAt?.getTime();
      if (!t || t < past || t > future) continue;
      const subtitle = parseEventSubtitle(ev.sub_title || "");
      if (!subtitle.team1 || !subtitle.team2) continue;
      const slug1 = teamNameToSlug(subtitle.team1);
      const slug2 = teamNameToSlug(subtitle.team2);
      if (!slug1 || !slug2) continue;
      candidates.push({
        event: ev,
        scheduledAt: parsed.scheduledAt!,
        slug1,
        slug2,
      });
    }
    inWindow = candidates.length;

    if (inWindow === 0) {
      return NextResponse.json({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        totalEvents,
        inWindow: 0,
        note: "无窗口内 LOL events 或无映射成功",
      });
    }

    // 3. team + match 映射准备
    const { data: teams } = await sb
      .from("xiapan_teams")
      .select("id, slug, short_code")
      .returns<TeamRow[]>();
    const teamBySlug = new Map((teams || []).map((t) => [t.slug, t]));

    const sinceISO = new Date(past).toISOString();
    const futureISO = new Date(future).toISOString();
    const { data: matches } = await sb
      .from("xiapan_matches")
      .select("id, scheduled_at, team1_id, team2_id")
      .gte("scheduled_at", sinceISO)
      .lte("scheduled_at", futureISO)
      .returns<MatchRow[]>();

    // 4. 并发拉每个 event 详情 + upsert
    const snapshotAt = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];

    await pMap(
      candidates,
      async ({ event, scheduledAt, slug1, slug2 }) => {
        const t1 = teamBySlug.get(slug1);
        const t2 = teamBySlug.get(slug2);
        if (!t1 || !t2) return;
        mappedEvents++;

        // 找匹配 match (24h tolerance)
        const match = (matches || []).find((m) => {
          const sameTeams =
            (m.team1_id === t1.id && m.team2_id === t2.id) ||
            (m.team1_id === t2.id && m.team2_id === t1.id);
          if (!sameTeams) return false;
          const dt = Math.abs(
            new Date(m.scheduled_at).getTime() - scheduledAt.getTime()
          );
          return dt < 24 * 3600 * 1000;
        });
        if (match) matchedToDb++;

        // 拉 event 详情 (含 markets)
        let detail;
        try {
          detail = await fetchEventDetail(event.event_ticker);
        } catch (e) {
          errors.push(
            `event ${event.event_ticker}: ${e instanceof Error ? e.message : String(e)}`
          );
          return;
        }

        const market = pickMatchWinnerMarket(detail.markets);
        if (!market || !market.ticker) return;

        // yes_sub_title 决定 yes 押哪队
        // Kalshi · yes_sub_title 通常 = team1 全名 (event 第一队)
        const yesSlug = teamNameToSlug(market.yes_sub_title || "");
        const teamForYesId =
          yesSlug === slug1 ? t1.id : yesSlug === slug2 ? t2.id : t1.id;

        rows.push({
          match_id: match?.id ?? null,
          kalshi_ticker: market.ticker,
          kalshi_event_ticker: event.event_ticker,
          kalshi_series_ticker: event.series_ticker || "KXLOLGAME",
          side: "yes" as const,
          team_for_yes_id: teamForYesId,
          yes_bid: dollarStrToCents(market.yes_bid_dollars),
          yes_ask: dollarStrToCents(market.yes_ask_dollars),
          no_bid: dollarStrToCents(market.no_bid_dollars),
          no_ask: dollarStrToCents(market.no_ask_dollars),
          last_price: dollarStrToCents(market.last_price_dollars),
          volume_cents: Math.round(fpToNumber(market.volume_24h_fp) * 100),
          open_interest_cents: Math.round(
            fpToNumber(market.open_interest_fp) * 100
          ),
          status: market.status || "active",
          close_time: market.close_time,
          snapshot_at: snapshotAt,
        });
      },
      CONCURRENCY
    );

    if (rows.length > 0) {
      const { error } = await sb.from("xiapan_markets").upsert(rows, {
        onConflict: "kalshi_ticker,snapshot_at",
      });
      if (error) errors.push(`upsert: ${error.message}`);
      else upserted = rows.length;
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({
    ok: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    totalEvents,
    inWindow,
    mappedEvents,
    matchedToDb,
    upserted,
    errors: errors.slice(0, 5),
  });
}
