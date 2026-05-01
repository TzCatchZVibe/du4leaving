// 虾盘 · edge 信号核心
//
// edge = model_p - kalshi_implied_p
// kalshi_implied_p = yes_ask_cents / 100   (买 yes 的成本 ≈ 隐含胜率)
//
// 信号分级 ·
//   STRONG  edge ≥ 5pp  AND volume ≥ $500   AND spread ≤ 5¢
//   WATCH   edge ≥ 3pp  AND volume ≥ $200
//   SKIP    其他

export type SignalLevel = "skip" | "watch" | "strong";

export type EdgeInput = {
  modelP: number; // [0, 1]
  yesAsk: number | null | undefined; // cents
  yesBid: number | null | undefined; // cents
  volumeCents: number | null | undefined;
};

export type EdgeResult = {
  level: SignalLevel;
  modelP: number;
  impliedP: number | null;
  edgePp: number | null; // percentage points
  spreadCents: number | null;
  volumeUsd: number;
  kellyFrac: number | null; // 推荐 Kelly 仓位比例 (0.25 缩放)
  reasoning: string[];
};

const STRONG_EDGE_PP = 5;
const WATCH_EDGE_PP = 3;
const STRONG_VOL_USD = 500;
const WATCH_VOL_USD = 200;
const MAX_SPREAD_CENTS = 5;
const KELLY_SCALE = 0.25;

export function computeEdge(input: EdgeInput): EdgeResult {
  const { modelP, yesAsk, yesBid, volumeCents } = input;
  const reasoning: string[] = [];

  if (yesAsk == null) {
    return {
      level: "skip",
      modelP,
      impliedP: null,
      edgePp: null,
      spreadCents: null,
      volumeUsd: 0,
      kellyFrac: null,
      reasoning: ["yes_ask 缺失 · 无法定价"],
    };
  }

  const impliedP = yesAsk / 100;
  const edgePp = (modelP - impliedP) * 100;
  const spreadCents = yesBid != null ? yesAsk - yesBid : null;
  const volumeUsd = (volumeCents ?? 0) / 100;

  // Kelly · f = (p - q/b) where b = (1-impliedP)/impliedP
  // 简化 · for binary contract @ ask 价格
  // expected value per $1 stake = (modelP / impliedP) - 1
  // Kelly fraction = (modelP - impliedP) / (1 - impliedP)
  let kelly: number | null = null;
  if (impliedP > 0 && impliedP < 1) {
    const raw = (modelP - impliedP) / (1 - impliedP);
    kelly = Math.max(0, Math.min(0.5, raw)) * KELLY_SCALE;
  }

  // 分级
  let level: SignalLevel = "skip";
  if (edgePp >= STRONG_EDGE_PP) {
    if (volumeUsd >= STRONG_VOL_USD) {
      if (spreadCents == null || spreadCents <= MAX_SPREAD_CENTS) {
        level = "strong";
        reasoning.push(
          `edge +${edgePp.toFixed(1)}pp ≥ ${STRONG_EDGE_PP}, vol $${volumeUsd.toFixed(0)} ≥ $${STRONG_VOL_USD}`
        );
      } else {
        reasoning.push(`spread ${spreadCents}¢ > ${MAX_SPREAD_CENTS}¢ · 降为 watch`);
        level = "watch";
      }
    } else {
      reasoning.push(`vol $${volumeUsd.toFixed(0)} < $${STRONG_VOL_USD} · 降为 watch`);
      level = "watch";
    }
  } else if (edgePp >= WATCH_EDGE_PP && volumeUsd >= WATCH_VOL_USD) {
    level = "watch";
    reasoning.push(`edge +${edgePp.toFixed(1)}pp ≥ ${WATCH_EDGE_PP} · 仅观察`);
  } else {
    reasoning.push(
      `edge ${edgePp >= 0 ? "+" : ""}${edgePp.toFixed(1)}pp · 跳过`
    );
  }

  return {
    level,
    modelP,
    impliedP,
    edgePp,
    spreadCents,
    volumeUsd,
    kellyFrac: kelly,
    reasoning,
  };
}

// 推送文案 (markdown · for Telegram)
export function formatEdgeSignal(opts: {
  edge: EdgeResult;
  team1: string;
  team2: string;
  league: string;
  scheduledAt: string;
  kalshiTicker: string;
  format: string;
  bankrollUsd?: number; // 用于把 Kelly 算成 $
}): string {
  const { edge, team1, team2, league, scheduledAt, kalshiTicker, format } = opts;
  const date = new Date(scheduledAt);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
  const fav = edge.modelP >= 0.5 ? team1 : team2;
  const favPct = Math.round((edge.modelP >= 0.5 ? edge.modelP : 1 - edge.modelP) * 100);
  const emoji = edge.level === "strong" ? "🔥" : edge.level === "watch" ? "👀" : "⏭";

  const lines = [
    `${emoji} *${edge.level.toUpperCase()}*  ${dateStr}`,
    `${league.toUpperCase()} · ${format.toUpperCase()}  ·  *${team1}* vs *${team2}*`,
    "",
    `模型      ${fav} 胜  ${favPct}%`,
    `Kalshi    yes ${(edge.impliedP! * 100).toFixed(0)}%   ($${kalshiTicker})`,
    `EDGE      ${edge.edgePp! >= 0 ? "+" : ""}${edge.edgePp!.toFixed(1)} pp`,
  ];
  if (edge.spreadCents != null)
    lines.push(`spread    ${edge.spreadCents}¢`);
  lines.push(`vol       $${edge.volumeUsd.toFixed(0)}`);
  if (edge.kellyFrac != null && edge.kellyFrac > 0) {
    lines.push(
      `Kelly     ${(edge.kellyFrac * 100).toFixed(2)}% bankroll`
    );
    if (opts.bankrollUsd) {
      const stake = edge.kellyFrac * opts.bankrollUsd;
      lines.push(`建议仓位  $${stake.toFixed(2)}`);
    }
  }
  lines.push("", `_${edge.reasoning.join(" · ")}_`);
  return lines.join("\n");
}
