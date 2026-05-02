// /api/xiapan/baichuan/todo
// V0.72 W3 Day 8 · /事 · 有啥要 TZ 动手做
// 没事说 "今天没事" · 不堆

import { NextResponse } from "next/server";
import { readPools } from "@/lib/xiapan/百川/pools";
import { liveStatus } from "@/lib/xiapan/百川/kalshi-live";
import { readAllLessons } from "@/lib/xiapan/百川/lessons";

export const dynamic = "force-dynamic";

interface Todo {
  priority: "high" | "med" | "low";
  text: string;
  why: string;
}

export async function GET() {
  const todos: Todo[] = [];
  const pools = readPools();
  const live = liveStatus();
  const lessons = readAllLessons();
  const closed = lessons.filter((l) => l.actual !== undefined && l.actual !== null);

  // 1 · pools 没 init
  if (!pools) {
    todos.push({
      priority: "high",
      text: "/pools_init 50 · 注入 $50 起步本金",
      why: "百川没启动 · 注入后系统才能下单",
    });
  }

  // 2 · 真钱没启
  if (pools && !live.enabled) {
    todos.push({
      priority: "high",
      text: "Kalshi 网站建 RSA + 上传 .pem + .env.local 加 LIVE_TRADING=true",
      why: "paper 跑了几天数据有了 · 接真钱才能赚",
    });
  }

  // 3 · circuit 异常
  if (pools && pools.circuit_state !== "running") {
    todos.push({
      priority: "high",
      text: `恢复 circuit · 当前 ${pools.circuit_state}`,
      why: pools.circuit_reason ?? "未知",
    });
  }

  // 4 · 月底 cashout 提示 (3 天内)
  if (pools && pools.lifetime.month_history.length > 0) {
    const now = new Date();
    const nextMonth1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysToMonth1 = (nextMonth1.getTime() - now.getTime()) / 86400_000;
    if (daysToMonth1 <= 3 && daysToMonth1 > 0) {
      todos.push({
        priority: "med",
        text: `月底 ${Math.ceil(daysToMonth1)} 天 · 准备 cashout`,
        why: "C 池 net_gain ≥ $50 · 月度自动分配 (你接 cashout 部分)",
      });
    }
  }

  // 5 · paper 满 30 单 → 真钱建议
  if (pools && !live.enabled && closed.length >= 30) {
    const wins = closed.filter((l) => l.actual === 1).length;
    const wr = wins / closed.length;
    const totalPnL = closed.reduce((s, l) => s + (l.pnl ?? 0), 0);
    if (wr >= 0.53 && totalPnL > 0) {
      todos.push({
        priority: "high",
        text: "paper 已 30 单 + wr ≥ 53% + PnL > 0 · 可考虑真钱",
        why: `wr ${(wr * 100).toFixed(0)}% · PnL +$${totalPnL.toFixed(2)} · checklist 通过`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    summary: { total: todos.length, high: todos.filter((t) => t.priority === "high").length },
    todos,
    empty_message: todos.length === 0 ? "今天没事 · 系统跑着 · 你忙别的" : null,
  });
}
