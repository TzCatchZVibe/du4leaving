// 虾盘 W1 · Riot Esports 数据 backfill
// 纯 Node · 直接 `node scripts/xiapan-sync-riot-esports.mjs`
// 选项 ·
//   --dry-run    不写 db, 只输出 JSON 报告 (默认开启)
//   --commit     真写 db (要求 SUPABASE_SERVICE_ROLE_KEY)
//   --leagues=lck,lpl,lec,lcs,msi,worlds  限定联赛
//   --years=2024,2025,2026                限定年份
//
// 数据源 · lolesports.com 内部 API (社区已知 public key)
// docs · 无官方文档, endpoint 通过 Chrome devtools 反推

import fs from "node:fs";
import path from "node:path";

// ====== Env loader (复用 seed-wiki.mjs 的逻辑) ======
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

// ====== Args ======
const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const TARGET_LEAGUES = (args.find((a) => a.startsWith("--leagues=")) || "")
  .replace("--leagues=", "")
  .split(",")
  .filter(Boolean);
const TARGET_YEARS = (args.find((a) => a.startsWith("--years=")) || "")
  .replace("--years=", "")
  .split(",")
  .filter(Boolean);

const DEFAULT_LEAGUES = ["lck", "lpl", "lec", "lcs", "msi", "worlds", "first_stand"];
const LEAGUES = TARGET_LEAGUES.length ? TARGET_LEAGUES : DEFAULT_LEAGUES;

// ====== Riot Esports API ======
const ESPORTS_BASE = "https://esports-api.lolesports.com/persisted/gw";
const RIOT_PUBLIC_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"; // lolesports.com 自己的 key
const HEADERS = {
  "x-api-key": RIOT_PUBLIC_KEY,
  Origin: "https://lolesports.com",
  "User-Agent": "Xiapan/0.1 (catchzvibe.studio)",
};

async function callRiot(p) {
  const r = await fetch(`${ESPORTS_BASE}${p}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`GET ${p} → ${r.status}`);
  return r.json();
}

async function getLeagues() {
  const d = await callRiot("/getLeagues?hl=en-US");
  return d?.data?.leagues || [];
}

async function getTournaments(leagueId) {
  const d = await callRiot(
    `/getTournamentsForLeague?hl=en-US&leagueId=${leagueId}`
  );
  return d?.data?.leagues?.[0]?.tournaments || [];
}

async function getCompletedEvents(tournamentId) {
  // /getCompletedEvents 用 paging cursor
  const all = [];
  let pageToken;
  for (let i = 0; i < 30; i++) {
    const q = new URLSearchParams({ hl: "en-US", tournamentId });
    if (pageToken) q.set("pageToken", pageToken);
    let d;
    try {
      d = await callRiot(`/getCompletedEvents?${q.toString()}`);
    } catch (e) {
      console.log(`     ⚠ pageToken=${pageToken}: ${e.message}`);
      break;
    }
    const events = d?.data?.schedule?.events || [];
    all.push(...events);
    pageToken = d?.data?.schedule?.pages?.older;
    if (!pageToken || events.length === 0) break;
    await sleep(150); // 礼貌等待
  }
  return all;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ====== 主流程 ======
async function main() {
  console.log("");
  console.log("🦞 虾盘 W1 · Riot Esports backfill");
  console.log("═".repeat(60));
  console.log(`   模式: ${COMMIT ? "🟢 COMMIT (写 db)" : "🟡 DRY-RUN (不写 db)"}`);
  console.log(`   联赛: ${LEAGUES.join(", ")}`);
  console.log(
    `   年份: ${TARGET_YEARS.length ? TARGET_YEARS.join(", ") : "全部"}`
  );
  console.log("");

  // 0. 准备 supabase client (commit 模式才真连)
  let supabase = null;
  if (COMMIT) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("❌ COMMIT 模式需要 SUPABASE env, 请配置 .env.local");
      process.exit(1);
    }
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  // 1. Leagues
  console.log("📡 [1/3] 拉 leagues …");
  const allLeagues = await getLeagues();
  const targetLeagues = allLeagues.filter((l) =>
    LEAGUES.includes((l.slug || "").toLowerCase())
  );
  console.log(
    `   匹配 ${targetLeagues.length}/${allLeagues.length}: ${targetLeagues.map((l) => l.slug).join(", ")}`
  );
  console.log("");

  // 2. Tournaments
  console.log("📡 [2/3] 拉 tournaments …");
  const tournamentList = [];
  for (const lg of targetLeagues) {
    const tournaments = await getTournaments(lg.id);
    let filtered = tournaments;
    if (TARGET_YEARS.length) {
      filtered = tournaments.filter((t) => {
        const startYear = (t.startDate || "").slice(0, 4);
        return TARGET_YEARS.includes(startYear);
      });
    }
    console.log(
      `   ${lg.slug.padEnd(14)}  ${filtered.length}/${tournaments.length} tournaments`
    );
    for (const t of filtered) tournamentList.push({ league: lg, tournament: t });
    await sleep(150);
  }
  console.log(`   合计 tournaments: ${tournamentList.length}`);
  console.log("");

  // 3. Events (= matches)
  console.log("📡 [3/3] 拉 completed events (matches) …");
  const allMatches = [];
  const teamsSet = new Map(); // slug -> team object

  for (let i = 0; i < tournamentList.length; i++) {
    const { league, tournament } = tournamentList[i];
    const events = await getCompletedEvents(tournament.id);
    console.log(
      `   [${(i + 1).toString().padStart(2)}/${tournamentList.length}]  ${league.slug.padEnd(12)}  ${(tournament.slug || "").slice(0, 40).padEnd(40)}  ${events.length} games`
    );
    for (const ev of events) {
      const m = ev.match;
      if (!m) continue;
      const teamA = m.teams?.[0];
      const teamB = m.teams?.[1];
      if (!teamA?.code || !teamB?.code) continue;

      // 累计 teams
      for (const t of [teamA, teamB]) {
        const slug = (t.code || "").toLowerCase();
        if (!slug) continue;
        if (!teamsSet.has(slug)) {
          teamsSet.set(slug, {
            slug,
            short_code: t.code,
            name: t.name || t.code,
            logo_url: t.image,
            league_slug: league.slug.toLowerCase(),
            riot_team_id: t.id,
          });
        }
      }

      // winner 优先用 outcome (大小写都试), fallback 用 score
      const aOutcome = (teamA.result?.outcome || "").toLowerCase();
      const bOutcome = (teamB.result?.outcome || "").toLowerCase();
      const aScore = teamA.result?.gameWins ?? 0;
      const bScore = teamB.result?.gameWins ?? 0;
      let winner = null;
      if (aOutcome === "win") winner = teamA.code;
      else if (bOutcome === "win") winner = teamB.code;
      else if (aScore > bScore) winner = teamA.code;
      else if (bScore > aScore) winner = teamB.code;
      // 同分 = 未结束 = null

      allMatches.push({
        riot_match_id: ev.match.id || ev.id,
        league_slug: league.slug.toLowerCase(),
        tournament_name: tournament.slug,
        scheduled_at: ev.startTime,
        team1_slug: teamA.code.toLowerCase(),
        team2_slug: teamB.code.toLowerCase(),
        team1_score: teamA.result?.gameWins ?? 0,
        team2_score: teamB.result?.gameWins ?? 0,
        winner_slug: winner ? winner.toLowerCase() : null,
        format: m.strategy?.type === "bestOf"
          ? `bo${m.strategy.count || 1}`
          : "bo1",
        state: ev.state,
        block_name: ev.blockName,
      });
    }
    await sleep(200);
  }
  console.log("");
  console.log(
    `   合计 matches: ${allMatches.length}, unique teams: ${teamsSet.size}`
  );
  console.log("");

  // 4. Sample
  console.log("📜 sample matches (前 5)");
  for (const m of allMatches.slice(0, 5)) {
    console.log(
      `   ${m.scheduled_at?.slice(0, 10)}  ${m.league_slug.toUpperCase().padEnd(8)}  ${m.team1_slug.toUpperCase().padEnd(5)} ${m.team1_score}-${m.team2_score} ${m.team2_slug.toUpperCase().padEnd(5)}  → ${(m.winner_slug || "?").toUpperCase()}`
    );
  }
  console.log("");

  // 5. Save report
  const outDir = path.resolve(process.cwd(), ".xiapan-probe");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fn = path.join(outDir, `riot-esports-sync-${ts}.json`);
  fs.writeFileSync(
    fn,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        commit: COMMIT,
        leagues: LEAGUES,
        years: TARGET_YEARS,
        teamsCount: teamsSet.size,
        matchesCount: allMatches.length,
        teams: [...teamsSet.values()],
        matches: allMatches,
      },
      null,
      2
    )
  );
  console.log(`📄 报告: ${path.relative(process.cwd(), fn)}`);
  console.log("");

  // 6. Commit?
  if (!COMMIT) {
    console.log("┌─ 下一步 ───────────────────────────────────────────");
    console.log("│  ✅ DRY-RUN 完成. 数据看起来对就跑:");
    console.log("│  ");
    console.log("│  node scripts/xiapan-sync-riot-esports.mjs --commit");
    console.log("│  ");
    console.log("│  前提 · 在 Supabase SQL editor 跑过 migration");
    console.log("└────────────────────────────────────────────────────");
    return;
  }

  console.log("💾 [4/4] 写 db …");
  // upsert leagues (slug 已 seed, 这里只 upsert riot_league_id)
  for (const lg of targetLeagues) {
    await supabase
      .from("xiapan_leagues")
      .update({ riot_league_id: lg.id })
      .eq("slug", lg.slug.toLowerCase());
  }

  // upsert teams
  let teamFails = 0;
  for (const team of teamsSet.values()) {
    const { data: lg } = await supabase
      .from("xiapan_leagues")
      .select("id")
      .eq("slug", team.league_slug)
      .single();
    if (!lg) {
      teamFails++;
      continue;
    }
    const { error } = await supabase.from("xiapan_teams").upsert(
      {
        slug: team.slug,
        name: team.name,
        short_code: team.short_code,
        league_id: lg.id,
        logo_url: team.logo_url,
        riot_team_id: team.riot_team_id,
      },
      { onConflict: "slug" }
    );
    if (error) {
      console.log(`   ⚠ team ${team.slug}: ${error.message}`);
      teamFails++;
    }
  }
  console.log(`   teams: ${teamsSet.size - teamFails} ok, ${teamFails} fail`);

  // upsert matches (需要先 lookup team ids)
  let matchOk = 0;
  let matchFail = 0;
  // 一次性把所有 teams id 拉下来做 lookup
  const { data: allTeams } = await supabase
    .from("xiapan_teams")
    .select("id, slug, league_id");
  const teamBySlug = new Map((allTeams || []).map((t) => [t.slug, t]));

  // 拿 league id by slug
  const { data: allLg } = await supabase.from("xiapan_leagues").select("id, slug");
  const lgBySlug = new Map((allLg || []).map((l) => [l.slug, l.id]));

  for (const m of allMatches) {
    const t1 = teamBySlug.get(m.team1_slug);
    const t2 = teamBySlug.get(m.team2_slug);
    const lgId = lgBySlug.get(m.league_slug);
    if (!t1 || !t2 || !lgId) {
      matchFail++;
      continue;
    }
    const winnerId = m.winner_slug
      ? teamBySlug.get(m.winner_slug)?.id
      : null;
    const status =
      m.state === "completed"
        ? "completed"
        : m.state === "inProgress"
          ? "live"
          : "scheduled";

    const { error } = await supabase.from("xiapan_matches").upsert(
      {
        league_id: lgId,
        team1_id: t1.id,
        team2_id: t2.id,
        scheduled_at: m.scheduled_at,
        format: m.format,
        status,
        winner_team_id: winnerId,
        team1_score: m.team1_score,
        team2_score: m.team2_score,
        riot_match_id: m.riot_match_id,
      },
      { onConflict: "riot_match_id" }
    );
    if (error) {
      matchFail++;
      if (matchFail < 5) console.log(`   ⚠ match: ${error.message}`);
    } else {
      matchOk++;
    }
  }
  console.log(`   matches: ${matchOk} ok, ${matchFail} fail`);
  console.log("");
  console.log("✅ 完成");
}

main().catch((e) => {
  console.error("❌ Sync failed:", e);
  process.exit(1);
});
