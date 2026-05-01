// 虾盘 · cron · Riot Esports schedule sync
//
// schedule (vercel.json) · 每 6 小时一次
// auth · Authorization: Bearer ${CRON_SECRET}
//
// 拉未来 14 天的赛程 + 已完成比赛的 winner 回填 · 同步 Elo 更新
// 与本地 backfill 脚本逻辑一致, 但只动 7 天滑动窗口避免超时

import { NextResponse } from "next/server";
import { authorizeCron, xiapanAdminDb } from "@/lib/xiapan/db-admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ESPORTS_BASE = "https://esports-api.lolesports.com/persisted/gw";
const RIOT_PUBLIC_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const HEADERS = {
  "x-api-key": RIOT_PUBLIC_KEY,
  Origin: "https://lolesports.com",
};

const TARGET_LEAGUES = [
  "lck",
  "lpl",
  "lec",
  "lcs",
  "msi",
  "worlds",
  "first_stand",
];

async function callRiot<T = unknown>(p: string): Promise<T> {
  const r = await fetch(`${ESPORTS_BASE}${p}`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`riot ${p} ${r.status}`);
  return r.json() as Promise<T>;
}

type RiotEvent = {
  startTime?: string;
  state?: string;
  blockName?: string;
  match?: {
    id?: string;
    teams?: Array<{
      id?: string;
      code?: string;
      name?: string;
      image?: string;
      result?: { outcome?: string; gameWins?: number };
    }>;
    strategy?: { type?: string; count?: number };
  };
};

type LeagueRow = { id: string; slug: string; riot_league_id: string | null };
type TeamRow = {
  id: string;
  slug: string;
  short_code: string | null;
  league_id: string;
};

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const summary: Record<string, unknown> = { leagues: {} };
  const errors: string[] = [];

  try {
    const sb = xiapanAdminDb();

    // 1. league lookup
    const { data: lgRows } = await sb
      .from("xiapan_leagues")
      .select("id, slug, riot_league_id")
      .returns<LeagueRow[]>();
    const lgBySlug = new Map((lgRows || []).map((l) => [l.slug, l]));

    // 2. fetch live leagues (riot)
    const { data: leagueData } = await callRiot<{
      data: { leagues: Array<{ id: string; slug: string }> };
    }>("/getLeagues?hl=en-US");
    const liveLeagues = (leagueData?.leagues || []).filter((l) =>
      TARGET_LEAGUES.includes((l.slug || "").toLowerCase())
    );

    // 3. backfill riot_league_id if missing
    for (const lg of liveLeagues) {
      const existing = lgBySlug.get(lg.slug.toLowerCase());
      if (existing && !existing.riot_league_id) {
        await sb
          .from("xiapan_leagues")
          .update({ riot_league_id: lg.id })
          .eq("slug", lg.slug.toLowerCase());
        existing.riot_league_id = lg.id;
      }
    }

    // 4. team lookup
    const { data: teamRows } = await sb
      .from("xiapan_teams")
      .select("id, slug, short_code, league_id")
      .returns<TeamRow[]>();
    const teamBySlug = new Map((teamRows || []).map((t) => [t.slug, t]));

    // 5. for each live league, fetch upcoming + recent (14d window)
    const lookback = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const lookahead = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    let upserted = 0;

    for (const lg of liveLeagues) {
      const lgRow = lgBySlug.get(lg.slug.toLowerCase());
      if (!lgRow) continue;
      try {
        const { data: schedData } = await callRiot<{
          data: {
            schedule?: { events?: RiotEvent[] };
          };
        }>(`/getSchedule?hl=en-US&leagueId=${lg.id}`);
        const events = schedData?.schedule?.events || [];
        let lgUpserts = 0;
        for (const ev of events) {
          if (!ev.startTime || !ev.match) continue;
          const t = new Date(ev.startTime);
          if (t < lookback || t > lookahead) continue;
          const teamA = ev.match.teams?.[0];
          const teamB = ev.match.teams?.[1];
          if (!teamA?.code || !teamB?.code) continue;
          const t1 = teamBySlug.get(teamA.code.toLowerCase());
          const t2 = teamBySlug.get(teamB.code.toLowerCase());
          if (!t1 || !t2) continue; // 等下一次 backfill

          const aScore = teamA.result?.gameWins ?? 0;
          const bScore = teamB.result?.gameWins ?? 0;
          const winnerId =
            (teamA.result?.outcome || "").toLowerCase() === "win"
              ? t1.id
              : (teamB.result?.outcome || "").toLowerCase() === "win"
                ? t2.id
                : aScore > bScore
                  ? t1.id
                  : bScore > aScore
                    ? t2.id
                    : null;
          const status =
            ev.state === "completed"
              ? "completed"
              : ev.state === "inProgress"
                ? "live"
                : "scheduled";
          const fmt =
            ev.match.strategy?.type === "bestOf"
              ? `bo${ev.match.strategy.count || 1}`
              : "bo1";

          const { error: upsertErr } = await sb.from("xiapan_matches").upsert(
            {
              league_id: lgRow.id,
              team1_id: t1.id,
              team2_id: t2.id,
              scheduled_at: ev.startTime,
              format: fmt,
              status,
              winner_team_id: winnerId,
              team1_score: aScore,
              team2_score: bScore,
              riot_match_id: ev.match.id,
            },
            { onConflict: "riot_match_id" }
          );
          if (upsertErr) errors.push(`${lg.slug}: ${upsertErr.message}`);
          else lgUpserts++;
        }
        upserted += lgUpserts;
        (summary.leagues as Record<string, number>)[lg.slug] = lgUpserts;
      } catch (e) {
        errors.push(`${lg.slug}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    summary.upserted = upserted;
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({
    ok: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...summary,
    errors,
  });
}
