// 虾盘 W2 · V0 Elo 模型训练 + Brier 回测
// 纯 Node · 不需要 db · `node scripts/xiapan-elo-train.mjs`
//
// 输入 · .xiapan-probe/riot-esports-sync-<最新>.json (W1 backfill 产物)
// 输出 ·
//   1. 控制台 · Brier score / 准确率 / reliability bin / 最终 Elo 排名
//   2. .xiapan-probe/elo-train-<ts>.json · 完整结果 + per-match prediction
//
// V0 模型 · 简单可解释
//   P(team1 win) = 1 / (1 + 10^((elo2 - elo1) / 400))
//   K = 32 (LOL 标准电竞 K 因子)
//   初始 Elo = 1500
//
// 评估指标 ·
//   Brier   = mean((p_pred - actual)^2)         越低越好, 0.25 = 随机, 0 = 完美
//   Acc     = (correct >50% predictions) / total
//   Cal     = reliability diagram (10 bin)

import fs from "node:fs";
import path from "node:path";

// ====== 加载最新 backfill JSON ======
function findLatestBackfill() {
  const dir = path.resolve(process.cwd(), ".xiapan-probe");
  if (!fs.existsSync(dir)) {
    console.error("❌ .xiapan-probe/ 不存在, 先跑 xiapan-sync-riot-esports.mjs");
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("riot-esports-sync-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    console.error("❌ 没找到 backfill JSON");
    process.exit(1);
  }
  return path.join(dir, files[files.length - 1]);
}

// ====== Elo 数学 ======
const INITIAL_ELO = 1500;
const K_FACTOR = 32;

function expectedScore(elo1, elo2) {
  return 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
}

function updateElo(eloA, eloB, actualA, k = K_FACTOR) {
  const expected = expectedScore(eloA, eloB);
  const delta = k * (actualA - expected);
  return [eloA + delta, eloB - delta];
}

// ====== 训练 + 回测 ======
function train(matches) {
  const elos = new Map(); // slug → elo
  const predictions = []; // 每场比赛的 (p_pred, actual)
  const teamLastSeen = new Map();

  // 按 scheduled_at 排序 (chronological)
  matches.sort(
    (a, b) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  for (const m of matches) {
    if (!m.winner_slug) continue; // 未结束 / 平局
    if (!m.team1_slug || !m.team2_slug) continue;

    const eloA = elos.get(m.team1_slug) ?? INITIAL_ELO;
    const eloB = elos.get(m.team2_slug) ?? INITIAL_ELO;

    const pred = expectedScore(eloA, eloB); // P(team1 win)
    const actual = m.winner_slug === m.team1_slug ? 1 : 0;

    predictions.push({
      ts: m.scheduled_at,
      league: m.league_slug,
      team1: m.team1_slug,
      team2: m.team2_slug,
      eloA_before: eloA,
      eloB_before: eloB,
      pred,
      actual,
      brier: Math.pow(pred - actual, 2),
      correct: (pred > 0.5 && actual === 1) || (pred < 0.5 && actual === 0),
    });

    const [newA, newB] = updateElo(eloA, eloB, actual);
    elos.set(m.team1_slug, newA);
    elos.set(m.team2_slug, newB);
    teamLastSeen.set(m.team1_slug, m.scheduled_at);
    teamLastSeen.set(m.team2_slug, m.scheduled_at);
  }

  return { elos, predictions, teamLastSeen };
}

function evalMetrics(predictions) {
  if (predictions.length === 0) return null;
  const brier =
    predictions.reduce((s, p) => s + p.brier, 0) / predictions.length;
  const acc =
    predictions.filter((p) => p.correct).length / predictions.length;

  // reliability diagram · 10 bins
  const bins = Array.from({ length: 10 }, () => ({
    lo: 0,
    hi: 0,
    sum_pred: 0,
    sum_actual: 0,
    n: 0,
  }));
  for (let i = 0; i < 10; i++) {
    bins[i].lo = i / 10;
    bins[i].hi = (i + 1) / 10;
  }
  for (const p of predictions) {
    let idx = Math.min(9, Math.floor(p.pred * 10));
    bins[idx].sum_pred += p.pred;
    bins[idx].sum_actual += p.actual;
    bins[idx].n += 1;
  }
  const reliability = bins.map((b) => ({
    range: `${b.lo.toFixed(1)}-${b.hi.toFixed(1)}`,
    n: b.n,
    avg_pred: b.n > 0 ? b.sum_pred / b.n : null,
    avg_actual: b.n > 0 ? b.sum_actual / b.n : null,
    diff:
      b.n > 0 ? Math.abs(b.sum_pred / b.n - b.sum_actual / b.n) : null,
  }));

  // calibration error · ECE (expected calibration error)
  const ece =
    bins
      .filter((b) => b.n > 0)
      .reduce(
        (s, b) =>
          s +
          (b.n / predictions.length) *
            Math.abs(b.sum_pred / b.n - b.sum_actual / b.n),
        0
      );

  return { brier, acc, ece, reliability };
}

// ====== rolling backtest · 第一年 warmup, 后两年评估 ======
function rollingBacktest(matches) {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
  );
  // 用前 30% 作 warmup, 后 70% 计 metric
  const warmupEnd = Math.floor(sorted.length * 0.3);
  const elos = new Map();

  const evalPredictions = [];
  let warmupCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (!m.winner_slug) continue;
    if (!m.team1_slug || !m.team2_slug) continue;

    const eloA = elos.get(m.team1_slug) ?? INITIAL_ELO;
    const eloB = elos.get(m.team2_slug) ?? INITIAL_ELO;
    const pred = expectedScore(eloA, eloB);
    const actual = m.winner_slug === m.team1_slug ? 1 : 0;

    if (i >= warmupEnd) {
      evalPredictions.push({
        ts: m.scheduled_at,
        league: m.league_slug,
        pred,
        actual,
        brier: Math.pow(pred - actual, 2),
        correct: (pred > 0.5 && actual === 1) || (pred < 0.5 && actual === 0),
      });
    } else {
      warmupCount++;
    }

    const [newA, newB] = updateElo(eloA, eloB, actual);
    elos.set(m.team1_slug, newA);
    elos.set(m.team2_slug, newB);
  }

  return { evalPredictions, warmupCount };
}

// ====== bar 渲染 ======
function bar(n, max, width = 20) {
  if (max <= 0) return "".padEnd(width, "·");
  return "█".repeat(Math.round((n / max) * width)).padEnd(width, "·");
}

// ====== 主流程 ======
async function main() {
  console.log("");
  console.log("🦞 虾盘 W2 · V0 Elo 模型训练 + 回测");
  console.log("═".repeat(60));
  console.log("");

  const file = findLatestBackfill();
  console.log(`📂 加载 ${path.relative(process.cwd(), file)}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const matches = data.matches || [];
  console.log(`   ${matches.length} matches`);
  console.log("");

  // ── 全样本训练 (得到最终 Elo) ──
  console.log("🧪 [1/3] 全样本训练 (得到最终 Elo)");
  const { elos, predictions } = train([...matches]);
  const m1 = evalMetrics(predictions);
  if (!m1) {
    console.log("   ⚠ 没足够的 completed matches");
    process.exit(0);
  }
  console.log(
    `   有效预测: ${predictions.length}  (out of ${matches.length} total)`
  );
  console.log(`   Brier:      ${m1.brier.toFixed(4)}   (越低越好, 0.25=随机)`);
  console.log(`   准确率:     ${(m1.acc * 100).toFixed(1)}%`);
  console.log(`   ECE:        ${m1.ece.toFixed(4)}   (校准误差)`);
  console.log("");

  // ── Rolling backtest (第一段 warmup, 后段评估) ──
  console.log("🧪 [2/3] Rolling backtest · 30% warmup → 70% eval");
  const { evalPredictions, warmupCount } = rollingBacktest([...matches]);
  const m2 = evalMetrics(evalPredictions);
  if (m2) {
    console.log(
      `   warmup: ${warmupCount}  ·  eval: ${evalPredictions.length}`
    );
    console.log(`   Brier:      ${m2.brier.toFixed(4)}`);
    console.log(`   准确率:     ${(m2.acc * 100).toFixed(1)}%`);
    console.log(`   ECE:        ${m2.ece.toFixed(4)}`);
  }
  console.log("");

  // ── Reliability diagram ──
  console.log("📊 Reliability diagram (rolling backtest)");
  console.log("   bin       n      pred     actual    diff");
  for (const b of m2.reliability) {
    if (b.n === 0) continue;
    console.log(
      `   ${b.range}   ${String(b.n).padStart(4)}   ${(b.avg_pred * 100).toFixed(1).padStart(5)}%   ${(b.avg_actual * 100).toFixed(1).padStart(5)}%   ${(b.diff * 100).toFixed(1)}%`
    );
  }
  console.log("");

  // ── 按联赛分组 ──
  console.log("🏆 [3/3] 按联赛 Brier (rolling)");
  const byLeague = new Map();
  for (const p of evalPredictions) {
    if (!byLeague.has(p.league)) byLeague.set(p.league, []);
    byLeague.get(p.league).push(p);
  }
  const leagueRows = [...byLeague.entries()]
    .map(([lg, ps]) => ({
      league: lg,
      n: ps.length,
      brier: ps.reduce((s, p) => s + p.brier, 0) / ps.length,
      acc: ps.filter((p) => p.correct).length / ps.length,
    }))
    .sort((a, b) => a.brier - b.brier);
  for (const r of leagueRows) {
    console.log(
      `   ${r.league.toUpperCase().padEnd(12)}  n=${String(r.n).padStart(4)}  Brier=${r.brier.toFixed(4)}  Acc=${(r.acc * 100).toFixed(1)}%`
    );
  }
  console.log("");

  // ── Top 20 队伍排名 ──
  console.log("🏅 当前 Elo Top 20 (按最近活跃)");
  const list = [...elos.entries()]
    .map(([slug, elo]) => ({ slug, elo }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 20);
  const maxElo = list[0]?.elo || 0;
  const minElo = list[list.length - 1]?.elo || 1500;
  for (const t of list) {
    const w = bar(t.elo - 1400, maxElo - 1400, 24);
    console.log(`   ${t.slug.toUpperCase().padEnd(8)}  ${t.elo.toFixed(0).padStart(5)}  ${w}`);
  }
  console.log("");

  // ── Verdict ──
  console.log("┌─ 结论 ─────────────────────────────────────────────────");
  if (m2.brier < 0.25) {
    console.log("│  ✅ 模型有信号 (Brier < 0.25)");
  } else {
    console.log(`│  ⚠ Brier ${m2.brier.toFixed(4)} ≥ 0.25, 模型 ≈ 随机`);
  }
  if (m2.brier < 0.22) {
    console.log("│  ✅ 可上 V0 (Brier < 0.22)");
  } else if (m2.brier < 0.25) {
    console.log("│  🟡 V0 边缘可用. V1 加 form/H2H/patch 因子提升");
  } else {
    console.log("│  ❌ 不可上线. 数据问题 or 需要更多特征");
  }
  console.log(`│  ECE ${m2.ece.toFixed(4)} ${m2.ece < 0.05 ? "校准好" : m2.ece < 0.1 ? "校准 OK" : "校准差"}`);
  console.log("└────────────────────────────────────────────────────────");
  console.log("");

  // ── 保存 ──
  const outDir = path.resolve(process.cwd(), ".xiapan-probe");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `elo-train-${ts}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        sourceFile: path.basename(file),
        matchCount: matches.length,
        warmupCount,
        evalCount: evalPredictions.length,
        fullSample: m1,
        rollingEval: m2,
        leagueBreakdown: leagueRows,
        finalElos: Object.fromEntries(elos),
        topTeams: list,
      },
      null,
      2
    )
  );
  console.log(`📄 完整结果: ${path.relative(process.cwd(), outFile)}`);
}

main().catch((e) => {
  console.error("❌ Train failed:", e);
  process.exit(1);
});
