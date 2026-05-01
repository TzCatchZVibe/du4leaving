// /research/pulse/opengraph-image.tsx · 分享卡
//
// V0.54 · pulse essay 的 OG · 跟 /heatmap 同款风格
// 分享到 Twitter/微信 自动出图 · 1200×630
// 主标 + 当下 4 个核心数 + 给个钩子让人点开

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "本周押注脉搏 · 7 个值得看的信号 · DU4LEAVING";
export const revalidate = 60;

const BG = "#f1ebdc";
const INK = "#111111";
const SOFT = "#6a6052";
const SAGE = "#6a8a6e";
const ROD = "#c1272d";
const AMBER = "#b47820";
const PAPER_BRIGHT = "#f7f2e6";
const BORDER = "rgba(17, 17, 17, 0.10)";

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3001";

interface Pick {
  ticker: string; title: string; buy_side: string; buy_price_c: number; score: number;
}
interface WhaleResp {
  trades_feed?: Array<{ side: string; dollar_value: number; market_title: string }>;
  top_traders?: Array<{ trader_name?: string; pseudonym?: string; total_volume_usd: number }>;
}
interface ArbResp {
  pairs?: Array<{ event_label: string; edge_pp: number; signal: string }>;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const url = `${baseURL.startsWith("http") ? baseURL : `https://${baseURL}`}${path}`;
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default async function OG() {
  const [picksJ, whalesJ, arbsJ] = await Promise.all([
    fetchJson<{ picks?: Pick[] }>("/api/xiapan/picks?min=45&limit=2"),
    fetchJson<WhaleResp>("/api/xiapan/whales?minDollar=200&limit=20"),
    fetchJson<ArbResp>("/api/xiapan/cross-arb?minDiv=3&limit=2"),
  ]);

  const topPick = (picksJ?.picks ?? [])[0];
  const whaleTotal = (whalesJ?.trades_feed ?? []).reduce(
    (s, w) => s + (w.dollar_value ?? 0), 0
  );
  const topTrader = (whalesJ?.top_traders ?? [])[0];
  const topArb = (arbsJ?.pairs ?? [])[0];

  const verdict = !topPick
    ? "等"
    : topPick.score >= 65
    ? "下"
    : "看";
  const verdictColor = verdict === "下" ? SAGE : verdict === "看" ? AMBER : SOFT;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          background: BG, color: INK, padding: 56,
        }}
      >
        {/* eyebrow */}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            fontSize: 16, color: SOFT, fontFamily: "monospace",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex" }}>· DU4LEAVING / 研究 / 本周脉搏</div>
          <div style={{ display: "flex" }}>{new Date().toISOString().slice(0, 10)}</div>
        </div>

        {/* 主标 */}
        <div
          style={{
            display: "flex", flexDirection: "column",
            marginBottom: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 76, fontWeight: 800,
              letterSpacing: -2, lineHeight: 0.95,
              marginBottom: 12,
            }}
          >
            本周押注脉搏
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22, color: SOFT,
              fontFamily: "monospace",
            }}
          >
            7 个本周值得看的信号 · Kalshi + Polymarket 实时 · 自动写
          </div>
        </div>

        {/* 4 数 · 一行 */}
        <div
          style={{
            display: "flex", gap: 16, flex: 1,
          }}
        >
          <BigStat
            label="今天该不该下"
            value={verdict}
            color={verdictColor}
            sub={topPick ? `top pick ${topPick.score} 分` : "无强信号"}
          />
          <BigStat
            label="24h 大户烧"
            value={`$${Math.round(whaleTotal).toLocaleString()}`}
            color={AMBER}
            sub={topTrader ? `第一 ${topTrader.trader_name || topTrader.pseudonym || "anon"}` : ""}
          />
          <BigStat
            label="两网最大价差"
            value={topArb ? `+${topArb.edge_pp.toFixed(1)}pp` : "—"}
            color={topArb ? AMBER : SOFT}
            sub={
              topArb
                ? topArb.signal === "kalshi_cheap_yes"
                  ? "Kalshi「会」便宜"
                  : topArb.signal === "kalshi_cheap_no"
                  ? "Kalshi「不会」便宜"
                  : "—"
                : "两网接近"
            }
          />
          <BigStat
            label="最便宜的押"
            value={topPick ? `${topPick.score}` : "—"}
            color={INK}
            sub={
              topPick
                ? topPick.buy_side === "yes"
                  ? `押「会」 ${topPick.buy_price_c}¢`
                  : `押「不会」 ${topPick.buy_price_c}¢`
                : ""
            }
            subColor={topPick?.buy_side === "yes" ? SAGE : ROD}
          />
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between", alignItems: "center",
            marginTop: 28, fontSize: 16, color: SOFT, fontFamily: "monospace",
          }}
        >
          <div style={{ display: "flex" }}>
            ● 60 秒自动刷 · 数据 Kalshi + Polymarket 公开
          </div>
          <div style={{ display: "flex", color: INK, fontWeight: 800 }}>
            catchzvibe.studio/research/pulse
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

function BigStat({
  label, value, color, sub, subColor,
}: {
  label: string; value: string; color: string;
  sub: string; subColor?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        background: PAPER_BRIGHT, border: `1px solid ${BORDER}`,
        borderRadius: 14, padding: 22,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 14, color: SOFT, fontFamily: "monospace",
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 56, fontWeight: 800, color,
          letterSpacing: -1, lineHeight: 1.0,
          marginBottom: 12, fontFamily: "monospace",
          flex: 1, alignItems: "flex-start",
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 14, color: subColor ?? SOFT,
          fontFamily: "monospace",
          maxHeight: 40, overflow: "hidden",
        }}
      >
        {sub.length > 26 ? sub.slice(0, 24) + "…" : sub}
      </div>
    </div>
  );
}
