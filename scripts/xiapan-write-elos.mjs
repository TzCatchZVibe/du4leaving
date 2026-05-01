// 虾盘 W2.1 · 把 Elo 训练结果写回 xiapan_teams.elo_rating
// 纯 Node · `node scripts/xiapan-write-elos.mjs [--dry-run]`
//
// 流程 ·
//   1. 读最新 elo-train-*.json (xiapan-elo-train.mjs 的产物)
//   2. 对每个 team slug, 把 finalElos[slug] 写到 xiapan_teams.elo_rating
//   3. 同时设 elo_last_updated_at = now()
//
// 前提 ·
//   - Supabase migration 00008 已跑 (xiapan_teams 表存在)
//   - xiapan-sync-riot-esports.mjs --commit 已跑 (teams 已入库)
//   - xiapan-elo-train.mjs 已跑 (.xiapan-probe/elo-train-*.json 存在)

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

const DRY_RUN = process.argv.includes("--dry-run");

function findLatestEloFile() {
  const dir = path.resolve(process.cwd(), ".xiapan-probe");
  if (!fs.existsSync(dir)) {
    console.error("❌ .xiapan-probe/ 不存在 · 先跑 xiapan-elo-train.mjs");
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("elo-train-") && f.endsWith(".json"))
    .sort();
  if (!files.length) {
    console.error("❌ 没找到 elo-train-*.json · 先跑 xiapan-elo-train.mjs");
    process.exit(1);
  }
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  console.log("");
  console.log("🦞 虾盘 W2.1 · Elo → db");
  console.log("═".repeat(50));
  console.log(`   模式: ${DRY_RUN ? "🟡 DRY-RUN" : "🟢 COMMIT"}`);

  const file = findLatestEloFile();
  console.log(`   读取: ${path.relative(process.cwd(), file)}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const finalElos = data.finalElos || {};
  const slugs = Object.keys(finalElos);
  console.log(`   ${slugs.length} 个 team Elo 待回写`);
  console.log("");

  if (DRY_RUN) {
    const list = Object.entries(finalElos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    console.log("📋 Top 20 (dry-run preview)");
    for (const [slug, elo] of list) {
      console.log(`   ${slug.toUpperCase().padEnd(8)}  ${elo.toFixed(0)}`);
    }
    console.log("");
    console.log("跑 `node scripts/xiapan-write-elos.mjs` (无 --dry-run) 真写入");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌ 缺 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const now = new Date().toISOString();
  let ok = 0;
  let fail = 0;
  let notFound = 0;

  for (const [slug, elo] of Object.entries(finalElos)) {
    const { data: row, error: selErr } = await sb
      .from("xiapan_teams")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (selErr || !row) {
      notFound++;
      continue;
    }
    const { error: updErr } = await sb
      .from("xiapan_teams")
      .update({
        elo_rating: Math.round(elo * 100) / 100,
        elo_last_updated_at: now,
      })
      .eq("id", row.id);
    if (updErr) {
      fail++;
      if (fail < 5) console.log(`   ⚠ ${slug}: ${updErr.message}`);
    } else {
      ok++;
    }
  }

  console.log("");
  console.log(`✅ 更新   ${ok}`);
  console.log(`⚠ 失败    ${fail}`);
  console.log(`🤷 db未匹配 ${notFound}  (slug 不在 xiapan_teams)`);
  console.log("");
  console.log("现在 /internal/xiapan 应该能看到正确 Elo 排名");
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
