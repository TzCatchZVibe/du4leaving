// /api/xiapan/match-preview?ticker=...
//
// 每场比赛的 rich info · 选手 / 战队 / H2H / sport context
// LOL · 通过 Riot esports (Supabase 里 cache)
// NBA / MLB / NFL / NHL · 通过 ESPN public API
// 其他 · Wikipedia 兜底
//
// 缓存 · 24h ISR · 比赛结束后 48h 失效

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 86400;

type MatchPreview = {
  ticker: string;
  sport: string;
  sportLabel: string;
  team1: { name: string; logo?: string; record?: string; recent?: string[] };
  team2: { name: string; logo?: string; record?: string; recent?: string[] };
  headToHead?: { date: string; result: string }[];
  context?: {
    league?: string;
    venue?: string;
    importance?: string;          // 例 "季后赛 G7"
    weather?: string;             // 室外 sport
  };
  keyPlayers?: { name: string; team: string; role: string; note?: string }[];
  sportPrimer?: string;            // 此 sport 类型的背景一段话
};

const SPORT_PRIMERS: Record<string, string> = {
  lol: "LOL · 5v5 团战 · BO3 (3 局 2 胜) 或 BO5 决胜 · 大龙 5min 刷 · 推塔决胜负 · LCK (韩) > LPL (中) > LEC (欧) > LCS (北美) 现状",
  nba: "NBA · 5v5 篮球 · 4 节 12min 各 · 季后赛 BO7 · 主场优势 · 三分 3 分 / 中投 2 分 / 罚球 1 分 · 末节胶着时 spread 飞涨",
  mlb: "MLB · 9 局棒球 · 投手主导 · SP rotation 关键 · 赛季 162 场 · 季后赛 BO7 · 主场 1-2 / 客场 3-7 模式",
  nfl: "NFL · 11v11 美式橄榄球 · 4 节 15min · 周日比赛主 · 时间管理决定末节 · 季后赛 单淘汰 · 超级杯",
  nhl: "NHL · 6v6 冰球 · 3 节 20min · 加时 OT 概率约 25% · 季后赛 BO7 · 加时 sudden death",
  tennis: "Tennis · 1v1 · 大满贯 BO5 (男) / BO3 (女) · 盘点 break 决定 · 一发率 + 二发率核心",
  soccer: "Soccer · 11v11 · 90min + 加时 · 平局常见 · 70min 后看角球 + 黄牌 · xG (期望进球) 为衡量进攻效率",
  cs: "CS2 · 5v5 FPS · 16 局 (赛季制) · BO1/BO3/BO5 · Major 单淘汰 · 经济体系决定上下场",
  valorant: "VAL · 5v5 FPS · 13 局 BO1 · 类似 CS · 但角色技能更复杂 · Champions 年度大赛",
};

// 简易 ticker → 队名解析 · 真生产用 Kalshi `/markets/{ticker}` 拉 metadata 更准
function parseTicker(ticker: string): { sport: string; team1: string; team2: string } {
  const u = ticker.toUpperCase();
  const sport =
    u.includes("LOL") ? "lol" :
    u.includes("NBA") ? "nba" :
    u.includes("MLB") ? "mlb" :
    u.includes("NFL") ? "nfl" :
    u.includes("NHL") ? "nhl" :
    u.includes("ITF") || u.includes("ATP") || u.includes("WTA") ? "tennis" :
    u.includes("EPL") || u.includes("UCL") ? "soccer" :
    u.includes("CS") ? "cs" :
    u.includes("VAL") ? "valorant" : "other";

  // 抓最后两个 hyphen 段当 team1 team2 (e.g. KXLOLGAME-26MAY010500ALTES-AL)
  const parts = ticker.split("-");
  const last = parts[parts.length - 1] || "?";
  const second = parts[parts.length - 2] || "?";
  // event ticker 通常 含两队简码合并
  const team2Match = last;
  const team1Match = second.length > 8 ? second.slice(-2) : "?";

  return { sport, team1: team1Match, team2: team2Match };
}

async function fetchKalshiMarketTitle(ticker: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.market?.title || null;
  } catch {
    return null;
  }
}

async function fetchKalshiEvent(eventTicker: string): Promise<{ title?: string; markets?: { ticker: string; yes_sub_title?: string }[] } | null> {
  try {
    const r = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/events/${encodeURIComponent(eventTicker)}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.event;
  } catch {
    return null;
  }
}

// ── ESPN team / roster (NBA/MLB/NFL/NHL/Soccer) ──────────

const ESPN_LEAGUE_PATH: Record<string, string> = {
  nba: "basketball/nba",
  mlb: "baseball/mlb",
  nfl: "football/nfl",
  nhl: "hockey/nhl",
  soccer: "soccer/eng.1",
};

interface ESPNTeam {
  id?: string;
  displayName?: string;
  abbreviation?: string;
  logos?: { href?: string }[];
  record?: { items?: { summary?: string }[] };
  standingSummary?: string;
}
interface ESPNRosterAthlete {
  id?: string;
  fullName?: string;
  position?: { abbreviation?: string };
  jersey?: string;
}

async function espnTeamSearch(sport: string, name: string): Promise<ESPNTeam | null> {
  const leaguePath = ESPN_LEAGUE_PATH[sport];
  if (!leaguePath) return null;
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/teams?limit=200`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const all = (d?.sports?.[0]?.leagues?.[0]?.teams || []) as { team: ESPNTeam }[];
    const lower = name.toLowerCase().trim();
    const found = all.find((t) =>
      (t.team?.displayName || "").toLowerCase().includes(lower) ||
      (t.team?.abbreviation || "").toLowerCase() === lower
    );
    return found?.team || null;
  } catch {
    return null;
  }
}

async function espnRoster(sport: string, teamId: string): Promise<ESPNRosterAthlete[]> {
  const leaguePath = ESPN_LEAGUE_PATH[sport];
  if (!leaguePath || !teamId) return [];
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/teams/${teamId}/roster`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json();
    const athletes = (d?.athletes || []) as { items?: ESPNRosterAthlete[] }[];
    const flat: ESPNRosterAthlete[] = [];
    for (const group of athletes) flat.push(...(group.items || []));
    if (flat.length === 0 && Array.isArray(d?.athletes)) {
      flat.push(...(d.athletes as ESPNRosterAthlete[]));
    }
    return flat.slice(0, 8);
  } catch {
    return [];
  }
}

// ── Riot esports (LOL · Supabase xiapan_teams + xiapan_players) ──

interface XiapanTeam {
  id: string;
  slug: string;
  name: string;
  short_code: string | null;
  elo_rating: number;
  logo_url: string | null;
}

interface XiapanPlayer {
  id: string;
  slug: string;
  name: string;
  team_id: string | null;
  role: string;
}

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function riotTeamSearch(name: string): Promise<XiapanTeam | null> {
  const sb = supabaseAnon();
  const lower = name.toLowerCase().trim();
  // 模糊匹配 · ilike on name + short_code + slug
  const { data } = await sb
    .from("xiapan_teams")
    .select("id, slug, name, short_code, elo_rating, logo_url")
    .or(`name.ilike.%${lower}%,short_code.ilike.${lower}%,slug.eq.${lower}`)
    .limit(3);
  if (!data || data.length === 0) return null;
  // 优先 short_code 完全匹配
  const exact = data.find((t) => t.short_code?.toLowerCase() === lower);
  return (exact || data[0]) as XiapanTeam;
}

async function riotPlayers(teamId: string): Promise<XiapanPlayer[]> {
  const sb = supabaseAnon();
  const { data } = await sb
    .from("xiapan_players")
    .select("id, slug, name, team_id, role")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("role")
    .limit(5);
  return (data || []) as XiapanPlayer[];
}

async function enrichWithRiot(team1Name: string, team2Name: string): Promise<{
  team1?: { name: string; logo?: string; record?: string };
  team2?: { name: string; logo?: string; record?: string };
  keyPlayers?: { name: string; team: string; role: string; note?: string }[];
}> {
  try {
    const [t1, t2] = await Promise.all([
      riotTeamSearch(team1Name),
      riotTeamSearch(team2Name),
    ]);
    const [p1, p2] = await Promise.all([
      t1?.id ? riotPlayers(t1.id) : Promise.resolve([]),
      t2?.id ? riotPlayers(t2.id) : Promise.resolve([]),
    ]);
    const players = [
      ...p1.map((p) => ({
        name: p.name,
        team: t1?.short_code || team1Name,
        role: p.role.toUpperCase(),
        note: undefined,
      })),
      ...p2.map((p) => ({
        name: p.name,
        team: t2?.short_code || team2Name,
        role: p.role.toUpperCase(),
        note: undefined,
      })),
    ];
    return {
      team1: t1
        ? {
            name: t1.name,
            logo: t1.logo_url ?? undefined,
            record: `Elo ${Math.round(t1.elo_rating)}`,
          }
        : undefined,
      team2: t2
        ? {
            name: t2.name,
            logo: t2.logo_url ?? undefined,
            record: `Elo ${Math.round(t2.elo_rating)}`,
          }
        : undefined,
      keyPlayers: players.length > 0 ? players : undefined,
    };
  } catch {
    return {};
  }
}

async function enrichWithESPN(
  sport: string,
  team1Name: string,
  team2Name: string
): Promise<{
  team1?: { name: string; logo?: string; record?: string };
  team2?: { name: string; logo?: string; record?: string };
  keyPlayers?: { name: string; team: string; role: string; note?: string }[];
}> {
  const [t1, t2] = await Promise.all([
    espnTeamSearch(sport, team1Name),
    espnTeamSearch(sport, team2Name),
  ]);
  const [r1, r2] = await Promise.all([
    t1?.id ? espnRoster(sport, t1.id) : Promise.resolve([]),
    t2?.id ? espnRoster(sport, t2.id) : Promise.resolve([]),
  ]);
  const players = [
    ...r1.slice(0, 4).map((a) => ({
      name: a.fullName || "—",
      team: t1?.abbreviation || team1Name,
      role: a.position?.abbreviation || "—",
      note: a.jersey ? `#${a.jersey}` : undefined,
    })),
    ...r2.slice(0, 4).map((a) => ({
      name: a.fullName || "—",
      team: t2?.abbreviation || team2Name,
      role: a.position?.abbreviation || "—",
      note: a.jersey ? `#${a.jersey}` : undefined,
    })),
  ];
  return {
    team1: t1
      ? {
          name: t1.displayName || team1Name,
          logo: t1.logos?.[0]?.href,
          record: t1.record?.items?.[0]?.summary || t1.standingSummary,
        }
      : undefined,
    team2: t2
      ? {
          name: t2.displayName || team2Name,
          logo: t2.logos?.[0]?.href,
          record: t2.record?.items?.[0]?.summary || t2.standingSummary,
        }
      : undefined,
    keyPlayers: players.length > 0 ? players : undefined,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") || "";
  if (!ticker) {
    return NextResponse.json({ ok: false, error: "缺 ticker" }, { status: 400 });
  }

  const { sport } = parseTicker(ticker);

  // 拉 Kalshi market metadata · 拿 title (有真队名)
  const title = await fetchKalshiMarketTitle(ticker);

  // 从 ticker 提 event ticker (取掉最后 -XX)
  const parts = ticker.split("-");
  const eventTicker = parts.slice(0, -1).join("-");
  const ev = await fetchKalshiEvent(eventTicker);

  // 队名 · prefer event.title · fallback parse
  let team1 = "Team 1";
  let team2 = "Team 2";
  if (ev?.title) {
    const m = ev.title.match(/(.+?)\s+vs\.?\s+(.+)/i);
    if (m) { team1 = m[1].trim(); team2 = m[2].trim(); }
    else { team1 = ev.title; }
  }

  // 富化 · LOL 走 Riot Supabase · 5 sport 走 ESPN · 其他仅 sport primer
  let enriched: Awaited<ReturnType<typeof enrichWithESPN>> = {};
  if (sport === "lol") {
    enriched = await enrichWithRiot(team1, team2);
  } else if (["nba", "mlb", "nfl", "nhl", "soccer"].includes(sport)) {
    enriched = await enrichWithESPN(sport, team1, team2);
  }

  const preview: MatchPreview = {
    ticker,
    sport,
    sportLabel: sport.toUpperCase(),
    team1: enriched.team1
      ? { name: enriched.team1.name, logo: enriched.team1.logo, record: enriched.team1.record }
      : { name: team1 },
    team2: enriched.team2
      ? { name: enriched.team2.name, logo: enriched.team2.logo, record: enriched.team2.record }
      : { name: team2 },
    context: { league: ev?.title },
    keyPlayers: enriched.keyPlayers,
    sportPrimer: SPORT_PRIMERS[sport],
  };

  return NextResponse.json({
    ok: true,
    ...preview,
    raw_market_title: title,
    generatedAt: new Date().toISOString(),
  });
}
