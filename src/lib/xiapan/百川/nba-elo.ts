// 百川/nba-elo.ts · NBA Elo 评分库
// V0.72 W3 Day 3 · 体育品类 Tier 1 · 第 4 个品类
//
// 数据源 ·
//   主 · 538 nba-elo CSV (history archive · github.com/fivethirtyeight/data)
//   备 · 硬码 seed (2024-25 末季 Elo · 手抄 ESPN)
//
// Elo 公式 (沿用现有 elo.ts) ·
//   E_team1 = 1 / (1 + 10^((R_team2 - R_team1 - home_bonus) / 400))
//   K_NBA = 20 · home_bonus = 100

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const ELO_DIR = path.join(HOME, ".du4leaving", "百川", "nba-elo");
const ELO_FILE = path.join(ELO_DIR, "elo-current.json");

// 2024-25 NBA 末季 Elo seed (手抄 · 各队近似)
// 真实 Elo 应每场赛后更新 · 这里仅作冷启动 baseline
const SEED_ELO_2025: Record<string, number> = {
  BOS: 1700, OKC: 1690, DEN: 1665, MIN: 1655, NYK: 1640, MIL: 1620,
  CLE: 1615, LAL: 1605, PHI: 1595, MIA: 1590, IND: 1585, ORL: 1580,
  PHX: 1575, GSW: 1570, LAC: 1565, DAL: 1560, NOP: 1555, MEM: 1550,
  SAC: 1545, HOU: 1540, ATL: 1525, CHI: 1520, BKN: 1500, TOR: 1495,
  POR: 1485, UTA: 1475, SAS: 1465, CHA: 1460, WAS: 1450, DET: 1445,
};

// 队伍别名 (Kalshi ticker / 全称 → 三字母代码)
export const NBA_TEAM_ALIASES: Record<string, string> = {
  // 三字母
  BOS: "BOS", OKC: "OKC", DEN: "DEN", MIN: "MIN", NYK: "NYK", MIL: "MIL",
  CLE: "CLE", LAL: "LAL", PHI: "PHI", MIA: "MIA", IND: "IND", ORL: "ORL",
  PHX: "PHX", GSW: "GSW", LAC: "LAC", DAL: "DAL", NOP: "NOP", MEM: "MEM",
  SAC: "SAC", HOU: "HOU", ATL: "ATL", CHI: "CHI", BKN: "BKN", TOR: "TOR",
  POR: "POR", UTA: "UTA", SAS: "SAS", CHA: "CHA", WAS: "WAS", DET: "DET",
  // 全称
  CELTICS: "BOS", LAKERS: "LAL", "76ERS": "PHI", WARRIORS: "GSW",
  THUNDER: "OKC", NUGGETS: "DEN", T_WOLVES: "MIN", TIMBERWOLVES: "MIN",
  KNICKS: "NYK", BUCKS: "MIL", CAVS: "CLE", CAVALIERS: "CLE",
  HEAT: "MIA", PACERS: "IND", MAGIC: "ORL", SUNS: "PHX",
  CLIPPERS: "LAC", MAVS: "DAL", MAVERICKS: "DAL",
  PELICANS: "NOP", GRIZZLIES: "MEM", KINGS: "SAC", ROCKETS: "HOU",
  HAWKS: "ATL", BULLS: "CHI", NETS: "BKN", RAPTORS: "TOR",
  TRAILBLAZERS: "POR", "TRAIL_BLAZERS": "POR", JAZZ: "UTA",
  SPURS: "SAS", HORNETS: "CHA", WIZARDS: "WAS", PISTONS: "DET",
};

const HOME_BONUS = 100;

function ensureDir() {
  if (!fs.existsSync(ELO_DIR)) fs.mkdirSync(ELO_DIR, { recursive: true });
}

interface EloFile {
  ts: string;
  source: "538" | "seed" | "manual";
  ratings: Record<string, number>;
}

export function loadElo(): { ratings: Record<string, number>; source: string; ts: string } {
  if (fs.existsSync(ELO_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(ELO_FILE, "utf8")) as EloFile;
      // 检过期 · > 30 天回退 seed
      const age_days = (Date.now() - new Date(data.ts).getTime()) / 86400_000;
      if (age_days < 30) return { ratings: data.ratings, source: data.source, ts: data.ts };
    } catch {}
  }
  return { ratings: { ...SEED_ELO_2025 }, source: "seed", ts: "2025-04-15" };
}

export function saveElo(ratings: Record<string, number>, source: EloFile["source"] = "manual"): void {
  ensureDir();
  fs.writeFileSync(ELO_FILE, JSON.stringify({
    ts: new Date().toISOString(),
    source,
    ratings,
  } satisfies EloFile, null, 2));
}

/// 主 · 538 GitHub archive 拉
export async function refreshFrom538(): Promise<{ ok: boolean; source?: string; n?: number; error?: string }> {
  try {
    const r = await fetch(
      "https://projects.fivethirtyeight.com/nba-model/nba_elo_latest.csv",
      { cache: "no-store", signal: AbortSignal.timeout(10_000) }
    );
    if (!r.ok) return { ok: false, error: `538 HTTP ${r.status}` };
    const csv = await r.text();
    const lines = csv.split("\n").filter(Boolean);
    if (lines.length < 2) return { ok: false, error: "empty CSV" };
    const header = lines[0].split(",");
    // 538 CSV 各场 · team1/team2/elo1_post/elo2_post
    const team1Idx = header.indexOf("team1");
    const team2Idx = header.indexOf("team2");
    const elo1Idx = header.indexOf("elo1_post");
    const elo2Idx = header.indexOf("elo2_post");
    if (team1Idx < 0 || elo1Idx < 0) return { ok: false, error: "CSV format unexpected" };

    // 取每队最新 Elo (CSV 按时间排 · 取最后一场)
    const ratings: Record<string, number> = {};
    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const t1 = cols[team1Idx];
      const t2 = cols[team2Idx];
      const e1 = parseFloat(cols[elo1Idx]);
      const e2 = parseFloat(cols[elo2Idx]);
      if (t1 && !isNaN(e1)) ratings[t1] = e1;
      if (t2 && !isNaN(e2)) ratings[t2] = e2;
    }
    if (Object.keys(ratings).length < 20) {
      return { ok: false, error: `仅 ${Object.keys(ratings).length} 队 · 数据不全` };
    }
    saveElo(ratings, "538");
    return { ok: true, source: "538", n: Object.keys(ratings).length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function normalizeTeam(name: string): string | null {
  if (!name) return null;
  const upper = name.toUpperCase().replace(/[^A-Z]/g, "_");
  return NBA_TEAM_ALIASES[upper] ?? NBA_TEAM_ALIASES[upper.replace(/_/g, "")] ?? null;
}

/// 给定两队 · 算 home team 胜率 (Elo)
export function expectedScoreNBA(home: string, away: string): number | null {
  const { ratings } = loadElo();
  const Rh = ratings[home];
  const Ra = ratings[away];
  if (Rh === undefined || Ra === undefined) return null;
  return 1 / (1 + Math.pow(10, (Ra - Rh - HOME_BONUS) / 400));
}

export const PATHS = { ELO_DIR, ELO_FILE };
