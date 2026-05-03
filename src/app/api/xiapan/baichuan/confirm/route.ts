// /api/xiapan/baichuan/confirm · D 模式 · TZ 点 ✓ 后真下单
// V0.73 W1 Day 4
//
// 调用方 · webhook callback handler · POST 进来 confirm/reject

import { NextResponse } from "next/server";
import { findPending, updatePending } from "@/lib/xiapan/百川/pending-orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, action, reject_reason } = body;
    if (!id || !action) {
      return NextResponse.json({ ok: false, error: "缺 id 或 action" }, { status: 400 });
    }

    const order = findPending(id);
    if (!order) {
      return NextResponse.json({ ok: false, error: "找不到 pending order · id=" + id }, { status: 404 });
    }
    if (order.status !== "pending") {
      return NextResponse.json({
        ok: false,
        error: `状态 ${order.status} · 已处理`,
      });
    }

    if (action === "reject") {
      const updated = updatePending(id, {
        status: "rejected",
        user_response_at: new Date().toISOString(),
        reject_reason: reject_reason || "无说明",
      });
      return NextResponse.json({ ok: true, action: "rejected", order: updated });
    }

    if (action === "confirm") {
      // 调 kalshi-live 真 RSA 下单 · 复用现成
      const stake = Math.min(order.stake_usd, 1); // 风控硬限 $1/单
      const ticker = order.ticker;
      const side = order.side;

      // 调 baichuan/run 现成 endpoint? 或直调 kalshi-live placeOrder?
      // 现先记 confirmed 状态 · 让 cron / run 循环检测处理 · 解耦
      const updated = updatePending(id, {
        status: "confirmed",
        user_response_at: new Date().toISOString(),
      });
      return NextResponse.json({
        ok: true,
        action: "confirmed",
        order: updated,
        message: "已标记 confirmed · 下次 cron 会执行真 RSA 下单",
      });
    }

    return NextResponse.json({ ok: false, error: "未知 action · " + action }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
