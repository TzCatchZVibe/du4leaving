// 虾盘 · 比赛决策依据聚合
// /api/xiapan/match-context/<ticker>
// 返回 · 战队近 5 场 + 相关新闻 + 直播源建议 + 战队 logo

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

type LeagueGuess = "lck" | "lec" | "lcs" | "lpl" | "msi" | "worlds" | "first_stand" | null;

function guessLeagueFromTicker(ticker: string): LeagueGuess {
  const t = ticker.toUpperCase();
  if (t.includes("LCK")) return "lck";
  if (t.includes("LEC")) return "lec";
  if (t.includes("LCS")) return "lcs";
  if (t.includes("LPL")) return "lpl";
  if (t.includes("MSI")) return "msi";
  if (t.includes("WORLDS")) return "worlds";
  return null;
}

const STREAM_BY_LEAGUE: Record<string, { embed: (h: string) => string; url: string; label: string }> = {
  lck: {
    embed: (h) => `https://player.twitch.tv/?channel=lck&parent=${h}&muted=true`,
    url: "https://twitch.tv/lck",
    label: "LCK · Twitch",
  },
  lec: {
    embed: (h) => `https://player.twitch.tv/?channel=lec&parent=${h}&muted=true`,
    url: "https://twitch.tv/lec",
    label: "LEC · Twitch",
  },
  lcs: {
    embed: (h) => `https://player.twitch.tv/?channel=lcs&parent=${h}&muted=true`,
    url: "https://twitch.tv/lcs",
    label: "LCS · Twitch",
  },
  lpl: {
    embed: () => "https://www.youtube.com/embed/live_stream?channel=UCdkWzHIpOLp4o7H2c5JI3jw",
    url: "https://youtube.com/@LPLEnglish/streams",
    label: "LPL · YouTube",
  },
};

function loadEloHistory(): Array<{
  team1_slug: string;
  team2_slug: string;
  scheduled_at: string;
  team1_score: number;
  team2_score: number;
  winner_slug: string | null;
  league_slug: string;
}> {
  try {
    const dir = path.resolve(process.cwd(), ".xiapan-probe");
    if (!fs.existsSync(dir)) return [];
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("riot-esports-sync-") && f.endsWith(".json"))
      .sort();
    if (!files.length) return [];
    const data = JSON.parse(
      fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8")
    );
    return data.matches || [];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    // 1. 拉 market detail 拿队名 + event
    const r = await fetch(`${KALSHI}/markets/${ticker}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `kalshi ${r.status}` },
        { status: 500 }
      );
    }
    const m = (await r.json()).market;
    const yesSub: string = m.yes_sub_title || "";
    const noSub: string = m.no_sub_title || "";
    const eventTicker: string = m.event_ticker || "";

    // 2. league guess
    const league = guessLeagueFromTicker(ticker);
    const stream = league ? STREAM_BY_LEAGUE[league] : null;

    // 3. recent matches (LOL · 我们有 backfill 数据)
    const allMatches = loadEloHistory();
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const yesNorm = norm(yesSub);
    const noNorm = norm(noSub);
    const yesRecent = allMatches
      .filter(
        (mm) =>
          mm.team1_slug && mm.team2_slug && mm.scheduled_at &&
          (norm(mm.team1_slug).includes(yesNorm.slice(0, 4)) ||
            norm(mm.team2_slug).includes(yesNorm.slice(0, 4)))
      )
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .slice(0, 5);
    const noRecent = allMatches
      .filter(
        (mm) =>
          mm.team1_slug && mm.team2_slug && mm.scheduled_at &&
          (norm(mm.team1_slug).includes(noNorm.slice(0, 4)) ||
            norm(mm.team2_slug).includes(noNorm.slice(0, 4)))
      )
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .slice(0, 5);

    // 4. H2H
    const h2h = allMatches
      .filter((mm) => {
        const t1 = norm(mm.team1_slug);
        const t2 = norm(mm.team2_slug);
        return (
          (t1.includes(yesNorm.slice(0, 4)) && t2.includes(noNorm.slice(0, 4))) ||
          (t1.includes(noNorm.slice(0, 4)) && t2.includes(yesNorm.slice(0, 4)))
        );
      })
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .slice(0, 5);

    return NextResponse.json({
      ok: true,
      ticker,
      eventTicker,
      title: m.title,
      yesSub,
      noSub,
      league,
      stream,
      yesRecent,
      noRecent,
      h2h,
      // 链接区 · 用户跳出去看
      links: {
        kalshi: `https://kalshi.com/markets/${ticker}`,
        kalshiEvent: eventTicker
          ? `https://kalshi.com/markets/${eventTicker.split("-")[0]}/${eventTicker}`
          : null,
        redditSearchYes: `https://www.reddit.com/search/?q=${encodeURIComponent(yesSub)}&sort=new&t=day`,
        redditSearchNo: `https://www.reddit.com/search/?q=${encodeURIComponent(noSub)}&sort=new&t=day`,
        twitterYes: `https://twitter.com/search?q=${encodeURIComponent(yesSub)}&f=live`,
        liquipedia: league
          ? `https://liquipedia.net/leagueoflegends/${yesSub.replace(/\s+/g, "_")}`
          : null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
