// /api/xiapan/百川/brier
//
// V0.72 · 周更 · 计算每信号源的 Brier · 调权重
// cron · 周日 22:30 · 在 paper-weekly 之后

import { NextResponse } from "next/server";
import { readAllLessons, brierBySource } from "@/lib/xiapan/百川/lessons";
import { loadWeights, saveWeights, brierToWeight } from "@/lib/xiapan/百川/weights";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  const lessons = readAllLessons();
  const closed = lessons.filter((l) => l.actual !== undefined && l.actual !== null);
  if (closed.length < 5) {
    return NextResponse.json({
      ok: true,
      message: `仅 ${closed.length} 单已结算 · 不够算 Brier (需 ≥ 5)`,
      lessons_total: lessons.length,
      closed: closed.length,
    });
  }

  const brier = brierBySource(closed);
  const oldWeights = loadWeights();
  const newWeights: Record<string, number> = { ...oldWeights };
  const changes: Array<{ source: string; old: number; new: number; brier: number; n: number }> = [];

  for (const [src, b] of Object.entries(brier)) {
    if (b.n < 10) continue;          // 样本不够 · 不调
    const w = brierToWeight(b.brier);
    const oldW = oldWeights[src] ?? 1.0;
    if (Math.abs(w - oldW) > 0.05) {
      newWeights[src] = w;
      changes.push({ source: src, old: oldW, new: w, brier: b.brier, n: b.n });
    }
  }

  saveWeights(newWeights, brier);

  // V0.72 · push Telegram 周报
  if (changes.length > 0) {
    try {
      const tg = await import("@/lib/xiapan/telegram");
      if (tg.tgEnabled()) {
        const lines = [
          `▼ Brier 周校准 · ${new Date().toISOString().slice(0, 10)}`,
          `${closed.length} 单已平 · 调 ${changes.length} 个信号权重`,
          ``,
        ];
        for (const c of changes.slice(0, 8)) {
          const arrow = c.new > c.old ? "↑" : "↓";
          lines.push(
            `${arrow} ${c.source}  ${c.old.toFixed(2)} → ${c.new.toFixed(2)}  (Brier ${c.brier.toFixed(2)} · n=${c.n})`
          );
        }
        await tg.sendTelegramMessage(lines.join("\n"), { parseMode: undefined });
      }
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    closed_lessons: closed.length,
    brier_by_source: brier,
    weights_old: oldWeights,
    weights_new: newWeights,
    changes,
  });
}
