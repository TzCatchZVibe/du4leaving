// /api/xiapan/baichuan/train
// V0.72 W3 Day 9 · 自进化 · 周日 23:00 cron 自动跑
//
// 训练每板块 logistic regression
// 数据 < 100 跳过
// 改进 < 0.01 brier 跳过
// 保存到 ~/.du4leaving/百川/ml/{board}.json

import { NextResponse } from "next/server";
import { trainAllBoards } from "@/lib/xiapan/百川/ml/train";
import { clearCache } from "@/lib/xiapan/百川/ml/predict";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("cron") === "1";
  if (isCron) {
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const got = req.headers.get("authorization") ?? "";
      if (got !== `Bearer ${expected}`) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }
  }

  const start = Date.now();
  let results;
  try {
    results = trainAllBoards();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
  clearCache();           // 强制 fusion 重新加载

  const summary = {
    total_boards: results.length,
    trained: results.filter((r) => r.status === "trained").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    rejected: results.filter((r) => r.status === "rejected").length,
    duration_ms: Date.now() - start,
  };

  return NextResponse.json({
    ok: true,
    summary,
    results: results.map((r) => ({
      board: r.board,
      status: r.status,
      n_samples: r.n_samples,
      reason: r.reason,
      improvement: r.improvement_over_naive,
      val_brier: r.model?.metrics.val_brier,
      val_auc: r.model?.metrics.val_auc,
    })),
  });
}
