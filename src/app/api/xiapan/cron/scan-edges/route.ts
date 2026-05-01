// 虾盘 · cron · 扫描 edge 信号 + 推 Telegram
//
// schedule (vercel.json) · 每 10 分钟一次
// auth · Authorization: Bearer ${CRON_SECRET}
//
// 流程 ·
//   1. 拉所有 LOL 相关 markets 的最新 snapshot (xiapan_markets)
//   2. 关联到 xiapan_matches + xiapan_predictions (model_version='v0.1-elo')
//   3. computeEdge() 算 level/edge/Kelly
//   4. 对 STRONG 信号去重检查 (xiapan_risk_flags 用作 push log)
//   5. 调 Telegram sendMessage
//
// 当前 (2026-04) Kalshi LOL 淡季 → 0 markets → 0 信号
// 5 月 MSI 上线后自动开始工作

import { NextResponse } from "next/server";
import { authorizeCron, xiapanAdminDb } from "@/lib/xiapan/db-admin";
import { computeEdge, formatEdgeSignal } from "@/lib/xiapan/edge";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL_VERSION = "v0.1-elo";
const PUSH_DEDUPE_HOURS = 6; // 同一 ticker × level 每 6h 最多推 1 次
const BANKROLL_USD = Number(process.env.XIAPAN_BANKROLL_USD || "100");

type MarketRow = {
  id: string;
  match_id: string | null;
  kalshi_ticker: string;
  yes_bid: number | null;
  yes_ask: number | null;
  volume_cents: number | null;
  team_for_yes_id: string | null;
  snapshot_at: string;
};

type MatchRow = {
  id: string;
  scheduled_at: string;
  format: string;
  team1_id: string;
  team2_id: string;
  league_id: string;
};

type PredictionRow = { match_id: string; p1_win: number };
type TeamRow = { id: string; slug: string; short_code: string };
type LeagueRow = { id: string; slug: string };
type RiskFlagRow = { note: string | null; created_at: string };

async function tgSend(text: string): Promise<{ ok: boolean; err?: string }> {
  const token = process.env.TG_XIAPAN_BOT_TOKEN;
  const chatId = process.env.TG_XIAPAN_CHAT_ID;
  if (!token || !chatId) return { ok: false, err: "missing tg env" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    const data = await r.json();
    return { ok: !!data.ok, err: data.description };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let scanned = 0;
  let strongCount = 0;
  let watchCount = 0;
  let pushed = 0;
  let dedupedSkips = 0;

  try {
    const sb = xiapanAdminDb();

    // 1. 拉最新 markets snapshot · 每个 ticker 取 snapshot_at 最大的一条
    // 简化 · 拿最近 30 min 内的 markets, 然后按 ticker 取最新
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: marketRows, error: mErr } = await sb
      .from("xiapan_markets")
      .select(
        "id, match_id, kalshi_ticker, yes_bid, yes_ask, volume_cents, team_for_yes_id, snapshot_at"
      )
      .gte("snapshot_at", since)
      .order("snapshot_at", { ascending: false })
      .returns<MarketRow[]>();
    if (mErr) {
      errors.push(`markets: ${mErr.message}`);
      throw new Error(mErr.message);
    }

    const latestByTicker = new Map<string, MarketRow>();
    for (const r of marketRows || []) {
      if (!latestByTicker.has(r.kalshi_ticker)) latestByTicker.set(r.kalshi_ticker, r);
    }
    const targetMarkets = [...latestByTicker.values()].filter(
      (m) => m.match_id && m.team_for_yes_id
    );

    if (targetMarkets.length === 0) {
      return NextResponse.json({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        scanned: 0,
        note: "无近 30min markets snapshot · Kalshi 可能淡季",
      });
    }

    // 2. 拉关联 matches 和 predictions (一次性)
    const matchIds = [...new Set(targetMarkets.map((m) => m.match_id!))];
    const [matchesRes, predRes] = await Promise.all([
      sb
        .from("xiapan_matches")
        .select(
          "id, scheduled_at, format, team1_id, team2_id, league_id"
        )
        .in("id", matchIds)
        .returns<MatchRow[]>(),
      sb
        .from("xiapan_predictions")
        .select("match_id, p1_win")
        .in("match_id", matchIds)
        .eq("model_version", MODEL_VERSION)
        .returns<PredictionRow[]>(),
    ]);
    const matchById = new Map(
      (matchesRes.data || []).map((m) => [m.id, m])
    );
    const predByMatch = new Map(
      (predRes.data || []).map((p) => [p.match_id, p.p1_win as number])
    );

    // 3. 拉 teams + leagues for 文案
    const teamIds = new Set<string>();
    matchesRes.data?.forEach((m) => {
      teamIds.add(m.team1_id);
      teamIds.add(m.team2_id);
    });
    targetMarkets.forEach((m) => m.team_for_yes_id && teamIds.add(m.team_for_yes_id));
    const leagueIds = new Set(
      (matchesRes.data || []).map((m) => m.league_id)
    );
    const [teamsRes, leaguesRes] = await Promise.all([
      sb
        .from("xiapan_teams")
        .select("id, slug, short_code")
        .in("id", [...teamIds])
        .returns<TeamRow[]>(),
      sb
        .from("xiapan_leagues")
        .select("id, slug")
        .in("id", [...leagueIds])
        .returns<LeagueRow[]>(),
    ]);
    const teamById = new Map((teamsRes.data || []).map((t) => [t.id, t]));
    const leagueById = new Map((leaguesRes.data || []).map((l) => [l.id, l]));

    // 4. dedupe lookup · 6h 内同 ticker × strong 不重推
    const dedupeSince = new Date(
      Date.now() - PUSH_DEDUPE_HOURS * 3600 * 1000
    ).toISOString();
    const { data: recentPushes } = await sb
      .from("xiapan_risk_flags")
      .select("note, created_at, type")
      .eq("type", "edge_push")
      .gte("created_at", dedupeSince)
      .returns<RiskFlagRow[]>();
    const recentPushedTickers = new Set(
      (recentPushes || []).map((r) => (r.note || "").split("|")[0]).filter(Boolean)
    );

    // 5. 逐个 market 算 edge
    for (const market of targetMarkets) {
      scanned++;
      const match = matchById.get(market.match_id!);
      if (!match) continue;
      const p1Win = predByMatch.get(market.match_id!);
      if (p1Win == null) continue;

      // model_p 必须对齐 yes 代表的队
      // team_for_yes_id 是 yes 押的那队 · 如果 = team1, 用 p1Win; 否则 1-p1Win
      const modelP =
        market.team_for_yes_id === match.team1_id ? p1Win : 1 - p1Win;

      const edge = computeEdge({
        modelP,
        yesAsk: market.yes_ask,
        yesBid: market.yes_bid,
        volumeCents: market.volume_cents,
      });

      if (edge.level === "strong") strongCount++;
      else if (edge.level === "watch") watchCount++;

      // 推送 · 仅 strong + 未在 dedupe 窗口内
      if (edge.level === "strong") {
        if (recentPushedTickers.has(market.kalshi_ticker)) {
          dedupedSkips++;
          continue;
        }
        const t1 = teamById.get(match.team1_id);
        const t2 = teamById.get(match.team2_id);
        const lg = leagueById.get(match.league_id);
        const text = formatEdgeSignal({
          edge,
          team1: t1?.short_code || t1?.slug.toUpperCase() || "?",
          team2: t2?.short_code || t2?.slug.toUpperCase() || "?",
          league: lg?.slug || "?",
          scheduledAt: match.scheduled_at,
          kalshiTicker: market.kalshi_ticker,
          format: match.format,
          bankrollUsd: BANKROLL_USD,
        });
        const pushRes = await tgSend(text);
        if (pushRes.ok) {
          pushed++;
          await sb.from("xiapan_risk_flags").insert({
            match_id: match.id,
            type: "edge_push",
            severity: "info",
            note: `${market.kalshi_ticker}|edge ${edge.edgePp?.toFixed(1)}pp`,
            source: "scan-edges-cron",
          });
        } else {
          errors.push(`tg: ${pushRes.err}`);
        }
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({
    ok: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    scanned,
    strongCount,
    watchCount,
    pushed,
    dedupedSkips,
    errors,
  });
}
