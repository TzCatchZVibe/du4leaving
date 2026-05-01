// 虾盘 W2.2 · 预测生成器
// 用现成 Elo 给所有未结束 matches 生成 P(team1 win), 写入 xiapan_predictions
//
// 跑法 ·
//   node scripts/xiapan-generate-predictions.mjs                # 默认 commit
//   node scripts/xiapan-generate-predictions.mjs --dry-run      # 不写 db
//   node scripts/xiapan-generate-predictions.mjs --window=14    # 未来 N 天 (默认 14)
//
// 流程 ·
//   1. 拉所有 status='scheduled' 的 matches
//   2. 用 xiapan_teams.elo_rating 算 P(team1 win)
//   3. upsert 到 xiapan_predictions (model_version='v0.1-elo')
//   4. 同 match + 同 model_version 已有则更新

import fs from "node:fs";
import path from "node:path";

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
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const WINDOW_DAYS = Number(
  (args.find((a) => a.startsWith("--window=")) || "--window=14")
    .replace("--window=", "")
);

const MODEL_VERSION = "v0.1-elo";

function expectedScore(elo1, elo2) {
  return 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
}

// 置信度 · |elo_diff| 越大越确信 · 软钳 [0.5, 0.95]
function confidenceFromGap(eloDiff) {
  const x = Math.abs(eloDiff);
  // 0 → 0.5, 200 → ~0.85, 400 → ~0.95
  return 0.5 + 0.45 * (1 - Math.exp(-x / 150));
}

async function main() {
  console.log("");
  console.log("🦞 虾盘 W2.2 · 生成预测");
  console.log("═".repeat(50));
  console.log(`   模式:     ${DRY_RUN ? "🟡 DRY-RUN" : "🟢 COMMIT"}`);
  console.log(`   时间窗口: 未来 ${WINDOW_DAYS} 天`);
  console.log(`   model:    ${MODEL_VERSION}`);
  console.log("");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌ 缺 SUPABASE env");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. 拉 teams elo
  const { data: teams, error: tErr } = await sb
    .from("xiapan_teams")
    .select("id, slug, short_code, elo_rating");
  if (tErr) {
    console.error(`❌ teams: ${tErr.message}`);
    process.exit(1);
  }
  const teamById = new Map((teams || []).map((t) => [t.id, t]));
  console.log(`📋 加载 ${teams?.length || 0} 队 (Elo)`);

  // 2. 拉 scheduled matches in window
  const now = new Date().toISOString();
  const future = new Date(
    Date.now() + WINDOW_DAYS * 24 * 3600 * 1000
  ).toISOString();
  const { data: matches, error: mErr } = await sb
    .from("xiapan_matches")
    .select("id, scheduled_at, team1_id, team2_id, format, league_id")
    .eq("status", "scheduled")
    .gte("scheduled_at", now)
    .lte("scheduled_at", future)
    .order("scheduled_at");
  if (mErr) {
    console.error(`❌ matches: ${mErr.message}`);
    process.exit(1);
  }
  console.log(`📅 ${matches?.length || 0} 场比赛在窗口内`);
  console.log("");

  if (!matches?.length) {
    console.log("_无未结束比赛 · 可能赛区休赛 · 等下一波赛程_");
    return;
  }

  // 3. 算预测
  const rows = [];
  console.log("🧮 预测明细");
  for (const m of matches) {
    const t1 = teamById.get(m.team1_id);
    const t2 = teamById.get(m.team2_id);
    if (!t1 || !t2) continue;
    const e1 = Number(t1.elo_rating) || 1500;
    const e2 = Number(t2.elo_rating) || 1500;
    const p1Win = expectedScore(e1, e2);
    const conf = confidenceFromGap(e1 - e2);
    const factors = {
      elo1: e1,
      elo2: e2,
      elo_diff: e1 - e2,
      method: "elo_logistic",
    };
    rows.push({
      match_id: m.id,
      model_version: MODEL_VERSION,
      p1_win: Math.round(p1Win * 10000) / 10000,
      confidence: Math.round(conf * 10000) / 10000,
      factors_json: factors,
    });
    const date = new Date(m.scheduled_at).toISOString().slice(5, 10);
    console.log(
      `   ${date}  *${(t1.short_code || "?").padEnd(5)}* (${e1.toFixed(0)}) vs *${(t2.short_code || "?").padEnd(5)}* (${e2.toFixed(0)})  →  ${(p1Win * 100).toFixed(1)}%  c=${(conf * 100).toFixed(0)}%`
    );
  }
  console.log("");
  console.log(`   合计 ${rows.length} 条预测`);
  console.log("");

  if (DRY_RUN) {
    console.log("跑 `node scripts/xiapan-generate-predictions.mjs` 真写入");
    return;
  }

  // 4. upsert · 没有 unique 索引, 用 delete+insert (按 match_id+model_version)
  let inserted = 0;
  let errs = 0;
  for (const row of rows) {
    // 删旧的同 (match, model_version) 预测
    await sb
      .from("xiapan_predictions")
      .delete()
      .eq("match_id", row.match_id)
      .eq("model_version", row.model_version);
    const { error } = await sb.from("xiapan_predictions").insert(row);
    if (error) {
      errs++;
      if (errs < 5) console.log(`   ⚠ ${row.match_id}: ${error.message}`);
    } else {
      inserted++;
    }
  }
  console.log(`✅ 写入 ${inserted}  ⚠ 失败 ${errs}`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
