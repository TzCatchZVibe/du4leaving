// 百川/clv.ts · CLV (Closing Line Value) 跟踪
// V0.72 W2 · 行业共识 · CLV > wr 是策略好坏的更早期信号
//
// CLV = "你下单时 vs 收盘时" 的方向性差
//   买 yes @ 50¢ · 平仓时 yes @ 55¢ → CLV +5pp (你抢到了好价)
//   买 yes @ 50¢ · 平仓时 yes @ 45¢ → CLV -5pp (你买在错的方向)
//
// 30 单 CLV > 0 就是真 alpha 的早期信号 · 比 wr 早暴露问题

import { readAllLessons, type LessonRecord } from "./lessons";

export interface CLVRecord {
  ticker: string;
  bucket: "stable" | "convex";
  side: "yes" | "no";
  entry_c: number;
  exit_c: number;
  clv_pp: number;             // 方向性差 · pp
  source: string;
  ts: string;
}

export function computeCLV(lessons?: LessonRecord[]): CLVRecord[] {
  const data = lessons ?? readAllLessons();
  const out: CLVRecord[] = [];
  for (const l of data) {
    if (l.exit_c === undefined || l.exit_c === null) continue;
    if (l.entry_c === undefined || l.entry_c === null) continue;
    // CLV 方向性 ·
    //   side=yes · 价升 (exit > entry) = good
    //   side=no  · 价降 (exit < entry) = good
    const sign = l.side === "yes" ? 1 : -1;
    const clv_pp = (l.exit_c - l.entry_c) * sign;
    out.push({
      ticker: l.ticker,
      bucket: l.bucket,
      side: l.side,
      entry_c: l.entry_c,
      exit_c: l.exit_c,
      clv_pp,
      source: l.source ?? l.signals_active.join("+"),
      ts: l.ts,
    });
  }
  return out;
}

export interface CLVSummary {
  n: number;
  avg_clv_pp: number;
  positive_pct: number;            // >0 占比
  by_bucket: Record<string, { n: number; avg_clv: number }>;
  by_source: Record<string, { n: number; avg_clv: number }>;
  recent_30: { n: number; avg_clv: number };
  verdict: "alpha+" | "neutral" | "alpha-";
}

export function clvSummary(records?: CLVRecord[]): CLVSummary {
  const data = records ?? computeCLV();
  if (data.length === 0) {
    return {
      n: 0,
      avg_clv_pp: 0,
      positive_pct: 0,
      by_bucket: {},
      by_source: {},
      recent_30: { n: 0, avg_clv: 0 },
      verdict: "neutral",
    };
  }

  const avg = data.reduce((s, r) => s + r.clv_pp, 0) / data.length;
  const positive = data.filter((r) => r.clv_pp > 0).length;

  const groupAvg = <K extends string>(get: (r: CLVRecord) => K) => {
    const groups: Record<string, CLVRecord[]> = {};
    for (const r of data) {
      const k = get(r);
      groups[k] = groups[k] ?? [];
      groups[k].push(r);
    }
    return Object.fromEntries(
      Object.entries(groups).map(([k, arr]) => [
        k,
        { n: arr.length, avg_clv: arr.reduce((s, r) => s + r.clv_pp, 0) / arr.length },
      ])
    );
  };

  const last30 = data.slice(-30);
  const recent_30 = {
    n: last30.length,
    avg_clv: last30.length ? last30.reduce((s, r) => s + r.clv_pp, 0) / last30.length : 0,
  };

  let verdict: CLVSummary["verdict"] = "neutral";
  if (data.length >= 30) {
    if (avg >= 1.0) verdict = "alpha+";
    else if (avg <= -1.0) verdict = "alpha-";
  }

  return {
    n: data.length,
    avg_clv_pp: avg,
    positive_pct: positive / data.length,
    by_bucket: groupAvg((r) => r.bucket),
    by_source: groupAvg((r) => r.source),
    recent_30,
    verdict,
  };
}
