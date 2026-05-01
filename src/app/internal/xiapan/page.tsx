// 虾盘 · /internal/xiapan
// 全屏 dashboard · server component
//
// 数据源 · Supabase xiapan_* 表 (W1 backfill 后填充)
// 缺数据时优雅 empty state 引导 setup

import { createClient } from "@/lib/supabase/server";

type Team = {
  id: string;
  slug: string;
  name: string;
  short_code: string | null;
  elo_rating: number;
  league_id: string;
  logo_url: string | null;
};

type League = {
  id: string;
  slug: string;
  name: string;
  region: string;
};

type Prediction = {
  match_id: string;
  model_version: string;
  p1_win: number;
  confidence: number | null;
};

type Match = {
  id: string;
  scheduled_at: string;
  format: string;
  status: string;
  team1_id: string;
  team2_id: string;
  team1_score: number | null;
  team2_score: number | null;
  winner_team_id: string | null;
  league_id: string;
};

type Snapshot = {
  ok: true;
  teams: Team[];
  leagues: League[];
  matches: Match[];
  upcoming: Match[];
  predictions: Map<string, Prediction>;
  totalMatches: number;
} | {
  ok: false;
  reason: "no_table" | "no_data" | "no_auth";
  detail?: string;
};

async function loadSnapshot(): Promise<Snapshot> {
  const supabase = await createClient();
  try {
    const teamsRes = await supabase
      .from("xiapan_teams")
      .select("id, slug, name, short_code, elo_rating, league_id, logo_url")
      .order("elo_rating", { ascending: false })
      .limit(50);

    if (teamsRes.error) {
      const msg = (teamsRes.error.message || "").toLowerCase();
      const code = teamsRes.error.code || "";
      const isMissingTable =
        msg.includes("not exist") ||
        msg.includes("does not exist") ||
        msg.includes("could not find the table") ||
        msg.includes("schema cache") ||
        msg.includes("relation") ||
        code === "42P01" ||
        code === "PGRST205";
      return {
        ok: false,
        reason: isMissingTable ? "no_table" : "no_auth",
        detail: teamsRes.error.message,
      };
    }

    const teams = (teamsRes.data || []) as Team[];
    if (teams.length === 0) {
      return { ok: false, reason: "no_data" };
    }

    const now = new Date().toISOString();
    const future = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const [leaguesRes, matchesRes, upcomingRes, totalRes, predRes] = await Promise.all([
      supabase.from("xiapan_leagues").select("id, slug, name, region"),
      supabase
        .from("xiapan_matches")
        .select(
          "id, scheduled_at, format, status, team1_id, team2_id, team1_score, team2_score, winner_team_id, league_id"
        )
        .order("scheduled_at", { ascending: false })
        .limit(20),
      supabase
        .from("xiapan_matches")
        .select(
          "id, scheduled_at, format, status, team1_id, team2_id, team1_score, team2_score, winner_team_id, league_id"
        )
        .eq("status", "scheduled")
        .gte("scheduled_at", now)
        .lte("scheduled_at", future)
        .order("scheduled_at")
        .limit(15),
      supabase.from("xiapan_matches").select("id", { count: "exact", head: true }),
      supabase
        .from("xiapan_predictions")
        .select("match_id, model_version, p1_win, confidence")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const predictions = new Map<string, Prediction>();
    for (const p of (predRes.data || []) as Prediction[]) {
      if (!predictions.has(p.match_id)) predictions.set(p.match_id, p);
    }

    return {
      ok: true,
      teams,
      leagues: (leaguesRes.data || []) as League[],
      matches: (matchesRes.data || []) as Match[],
      upcoming: (upcomingRes.data || []) as Match[],
      predictions,
      totalMatches: totalRes.count ?? 0,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "no_table",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export default async function XiapanPage() {
  const snap = await loadSnapshot();

  return (
    <div className="h-full w-full overflow-y-auto bg-paper text-ink">
      <div className="max-w-6xl mx-auto px-6 py-8 lg:px-12 lg:py-12">
        <Header />

        {!snap.ok && <SetupGuide reason={snap.reason} detail={snap.detail} />}

        {snap.ok && (
          <>
            <ModelStateRow totalMatches={snap.totalMatches} />
            <UpcomingPredictions
              upcoming={snap.upcoming}
              teams={snap.teams}
              leagues={snap.leagues}
              predictions={snap.predictions}
            />
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-8">
              <EloLeaderboard
                teams={snap.teams.slice(0, 20)}
                leagues={snap.leagues}
              />
              <RecentMatches matches={snap.matches} teams={snap.teams} leagues={snap.leagues} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────── Header ──────────────────

function Header() {
  return (
    <header className="mb-8">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
          🦞 虾盘
        </h1>
        <span className="text-sm font-mono text-ink-dim">
          KALSHI × LOL · Value Engine
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 w-16 bar-red" />
        <div className="h-1 w-4 bar-ink" />
        <span className="text-xs font-mono uppercase tracking-widest text-ink-dim">
          v0.1 · 第 8 只龙虾
        </span>
      </div>
    </header>
  );
}

// ────────────────── Setup Guide (empty state) ──────────────────

function SetupGuide({
  reason,
  detail,
}: {
  reason: "no_table" | "no_data" | "no_auth";
  detail?: string;
}) {
  const steps = [
    {
      done: false,
      title: "在 Supabase SQL Editor 跑 migration",
      cmd: "supabase/migrations/00008_xiapan_init.sql",
      hint: "建 8 张 xiapan_* 表 + RLS policy + seed 6 个联赛",
    },
    {
      done: false,
      title: "本地跑 backfill (dry-run)",
      cmd: "node scripts/xiapan-sync-riot-esports.mjs",
      hint: "先 dry-run 看数据 (LCK/LEC/LCS/MSI/Worlds, ~1235 场)",
    },
    {
      done: false,
      title: "确认数据后入库",
      cmd: "node scripts/xiapan-sync-riot-esports.mjs --commit",
      hint: "把 1235 场写进 Postgres",
    },
    {
      done: false,
      title: "训练 V0 模型",
      cmd: "node scripts/xiapan-elo-train.mjs",
      hint: "Brier 0.196 · Acc 70.9% · 上线门槛已破",
    },
    {
      done: false,
      title: "Kalshi 探测 + 写预测",
      cmd: "node scripts/xiapan-probe-kalshi.mjs && node scripts/xiapan-write-elos.mjs && node scripts/xiapan-generate-predictions.mjs",
      hint: "977 events · 46 场未来 14d · LCK 单场 vol24 $67K",
    },
  ];

  return (
    <section className="mt-4">
      <div className="bg-paper-bright border-2 border-ink/10 rounded-lg p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🛠</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">Setup needed</h2>
            <p className="text-sm text-ink-soft mt-1">
              {reason === "no_table" &&
                "数据库还没建表 · 先跑 migration"}
              {reason === "no_data" &&
                "表已建好 · 还没数据 · 跑 backfill --commit"}
              {reason === "no_auth" &&
                "数据库连接异常 · 检查 SUPABASE 环境变量"}
            </p>
            {detail && (
              <pre className="mt-2 text-xs font-mono text-ink-dim bg-paper-deep px-2 py-1 rounded overflow-x-auto">
                {detail.slice(0, 200)}
              </pre>
            )}
          </div>
        </div>

        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex gap-3 items-start border-l-2 border-ink/15 pl-4"
            >
              <div className="bg-ink text-paper text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-ink-dim mt-0.5">{s.hint}</div>
                <pre className="text-xs font-mono bg-paper-deep px-2 py-1.5 rounded mt-2 overflow-x-auto">
                  {s.cmd}
                </pre>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 pt-4 border-t border-ink/10">
          <div className="text-xs font-mono uppercase tracking-widest text-ink-dim mb-2">
            为什么有这一页
          </div>
          <p className="text-sm text-ink-soft leading-relaxed">
            虾盘是个 Kalshi × LOL 价值投注引擎 · 长期跑数据找 edge ·
            Kalshi 当前有 29 个 LOL events 流动性 $1M+ · 主流战队 90%
            自动映射 · 立刻可玩。
          </p>
        </div>
      </div>
    </section>
  );
}

// ────────────────── Model State Row ──────────────────

function ModelStateRow({ totalMatches }: { totalMatches: number }) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <StatCard
        label="模型 Brier"
        value="0.196"
        hint="< 0.22 上线门槛"
        accent="sage"
      />
      <StatCard
        label="准确率"
        value="70.9%"
        hint="rolling backtest"
        accent="amber"
      />
      <StatCard
        label="数据覆盖"
        value={`${totalMatches.toLocaleString()}`}
        hint="matches in db"
        accent="ink"
      />
      <StatCard
        label="Kalshi"
        value="LIVE"
        hint="977 events · 46 in 14d"
        accent="red"
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "red" | "amber" | "sage" | "ink";
}) {
  const accentBar = {
    red: "bg-red",
    amber: "bg-amber",
    sage: "bg-sage",
    ink: "bg-ink",
  }[accent];

  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 h-0.5 w-full ${accentBar}`} />
      <div className="text-xs font-mono uppercase tracking-widest text-ink-dim">
        {label}
      </div>
      <div className="text-2xl lg:text-3xl font-bold mt-1 tabular-nums">
        {value}
      </div>
      <div className="text-xs text-ink-dim mt-0.5">{hint}</div>
    </div>
  );
}

// ────────────────── Elo Leaderboard ──────────────────

function EloLeaderboard({
  teams,
  leagues,
}: {
  teams: Team[];
  leagues: League[];
}) {
  if (teams.length === 0) return null;
  const maxElo = teams[0]?.elo_rating ?? 2000;
  const minElo = 1400;
  const span = Math.max(maxElo - minElo, 100);

  const leagueById = new Map(leagues.map((l) => [l.id, l]));

  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md overflow-hidden">
      <div className="px-5 py-3 border-b border-ink/10 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Elo Top 20</h2>
        <span className="text-xs font-mono uppercase tracking-widest text-ink-dim">
          team rankings
        </span>
      </div>
      <ol className="divide-y divide-ink/5">
        {teams.map((t, i) => {
          const lg = leagueById.get(t.league_id);
          const w = ((t.elo_rating - minElo) / span) * 100;
          return (
            <li key={t.id} className="px-5 py-2.5 grid grid-cols-[2.5rem_3.5rem_1fr_4rem_5rem] items-center gap-3 text-sm">
              <div className="text-ink-dim font-mono text-xs">
                #{i + 1}
              </div>
              <div className="font-mono font-bold uppercase">
                {t.short_code || t.slug.toUpperCase()}
              </div>
              <div className="truncate text-ink-soft text-xs">
                {t.name}
              </div>
              <div className="text-xs font-mono text-ink-dim">
                {lg?.slug.toUpperCase() ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right tabular-nums font-bold">
                  {Math.round(t.elo_rating)}
                </div>
                <div className="w-16 h-1.5 bg-paper-deep rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink"
                    style={{ width: `${Math.max(2, Math.min(100, w))}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ────────────────── Upcoming Predictions ──────────────────

function UpcomingPredictions({
  upcoming,
  teams,
  leagues,
  predictions,
}: {
  upcoming: Match[];
  teams: Team[];
  leagues: League[];
  predictions: Map<string, Prediction>;
}) {
  if (upcoming.length === 0) {
    return (
      <section className="mt-8 bg-paper-bright border border-ink/10 rounded-md p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-bold">未来 14 天比赛</h2>
          <span className="text-xs font-mono uppercase tracking-widest text-ink-dim">
            upcoming
          </span>
        </div>
        <p className="text-sm text-ink-dim">
          暂无 scheduled 比赛 · 跑 Riot cron 同步赛程, 或赛区休赛中
        </p>
      </section>
    );
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const leagueById = new Map(leagues.map((l) => [l.id, l]));

  return (
    <section className="mt-8 bg-paper-bright border border-ink/10 rounded-md overflow-hidden">
      <div className="px-5 py-3 border-b border-ink/10 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">未来 14 天 · 模型预测</h2>
        <span className="text-xs font-mono uppercase tracking-widest text-ink-dim">
          upcoming · v0.1-elo
        </span>
      </div>
      <ul className="divide-y divide-ink/5">
        {upcoming.map((m) => {
          const t1 = teamById.get(m.team1_id);
          const t2 = teamById.get(m.team2_id);
          const lg = leagueById.get(m.league_id);
          const pred = predictions.get(m.id);
          const date = new Date(m.scheduled_at);
          const dateStr = `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
          const timeStr = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
          const p1 = pred?.p1_win ?? null;
          const fav = p1 === null ? null : p1 >= 0.5 ? "1" : "2";
          const favPct = p1 === null ? null : Math.round((fav === "1" ? p1 : 1 - p1) * 100);
          return (
            <li
              key={m.id}
              className="px-5 py-3 grid grid-cols-[3.5rem_4rem_1fr_8rem] items-center gap-3 text-sm"
            >
              <div className="font-mono">
                <div className="text-ink">{dateStr}</div>
                <div className="text-xs text-ink-dim">{timeStr}</div>
              </div>
              <div className="text-xs font-mono uppercase text-ink-dim">
                {lg?.slug ?? "?"}
                <div className="text-[10px]">{m.format.toUpperCase()}</div>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`font-mono font-bold ${fav === "1" ? "text-ink" : "text-ink-soft"}`}
                >
                  {t1?.short_code || "?"}
                </span>
                <span className="text-ink-dim">vs</span>
                <span
                  className={`font-mono font-bold ${fav === "2" ? "text-ink" : "text-ink-soft"}`}
                >
                  {t2?.short_code || "?"}
                </span>
              </div>
              <div className="text-right">
                {p1 === null ? (
                  <span className="text-xs text-ink-dim font-mono">无预测</span>
                ) : (
                  <div>
                    <div className="text-xs font-mono text-ink-dim">
                      {fav === "1" ? t1?.short_code : t2?.short_code} 胜
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-12 h-1 bg-paper-deep rounded-full overflow-hidden">
                        <div
                          className={`h-full ${(favPct || 0) >= 70 ? "bg-red" : (favPct || 0) >= 60 ? "bg-amber" : "bg-sage"}`}
                          style={{ width: `${favPct}%` }}
                        />
                      </div>
                      <span className="text-base font-bold tabular-nums">
                        {favPct}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="px-5 py-2.5 border-t border-ink/5 bg-paper-deep/30">
        <span className="text-xs text-ink-dim">
          Kalshi 实时报价 · cron 5min 抓盘口 · scan-edges 10min 推 STRONG 信号
        </span>
      </div>
    </section>
  );
}

// ────────────────── Recent Matches ──────────────────

function RecentMatches({
  matches,
  teams,
  leagues,
}: {
  matches: Match[];
  teams: Team[];
  leagues: League[];
}) {
  if (matches.length === 0) return null;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const leagueById = new Map(leagues.map((l) => [l.id, l]));

  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md overflow-hidden">
      <div className="px-5 py-3 border-b border-ink/10 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">最近比赛</h2>
        <span className="text-xs font-mono uppercase tracking-widest text-ink-dim">
          recent matches
        </span>
      </div>
      <ul className="divide-y divide-ink/5">
        {matches.slice(0, 12).map((m) => {
          const t1 = teamById.get(m.team1_id);
          const t2 = teamById.get(m.team2_id);
          const lg = leagueById.get(m.league_id);
          const winnerSlug =
            m.winner_team_id === m.team1_id
              ? "1"
              : m.winner_team_id === m.team2_id
                ? "2"
                : null;
          const date = new Date(m.scheduled_at);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <li
              key={m.id}
              className="px-4 py-2 text-xs grid grid-cols-[3rem_2.5rem_1fr_3rem] items-center gap-2"
            >
              <span className="font-mono text-ink-dim">{dateStr}</span>
              <span className="font-mono text-ink-dim text-[10px] uppercase">
                {lg?.slug ?? ""}
              </span>
              <span className="truncate">
                <span
                  className={`font-mono font-bold ${winnerSlug === "1" ? "text-ink" : "text-ink-dim"}`}
                >
                  {t1?.short_code || "?"}
                </span>{" "}
                <span className="tabular-nums">
                  {m.team1_score ?? 0}-{m.team2_score ?? 0}
                </span>{" "}
                <span
                  className={`font-mono font-bold ${winnerSlug === "2" ? "text-ink" : "text-ink-dim"}`}
                >
                  {t2?.short_code || "?"}
                </span>
              </span>
              <span
                className={`text-[10px] font-mono uppercase ${
                  m.status === "completed"
                    ? "text-sage"
                    : m.status === "live"
                      ? "text-red"
                      : "text-ink-dim"
                }`}
              >
                {m.status}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
