// /heatmap/opengraph-image.tsx
//
// V0.52 · 分享卡 · Twitter / 微信 / Telegram 自动出图
// 拉实时数据 · 60s revalidate · 让卡片本身值得点开
//
// 1200×630 · 4 象限 · 顶部最便宜 / 大户 · 底部价差 / mention

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DU4LEAVING · 押注热力图 · 哪场便宜 · 大户押什么";
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
  ticker: string;
  title: string;
  buy_side: string;
  buy_price_c: number;
  score: number;
  edge_pp: number;
}

interface WhaleTrade {
  side: string;
  dollar_value: number;
  market_title: string;
  outcome: string;
  age_minutes: number;
}

interface ArbPair {
  k_ticker: string;
  event_label: string;
  k_yes_ask: number;
  poly_yes_price: number;
  edge_pp: number;
  signal: string;
}

interface MentionEvent {
  event_ticker: string;
  speaker: string;
  title: string;
  markets: Array<{ target_word: string; yes_ask: number }>;
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
  const [picksJ, whalesJ, arbsJ, mentionsJ] = await Promise.all([
    fetchJson<{ picks?: Pick[] }>("/api/xiapan/picks?min=45&limit=2"),
    fetchJson<{ trades_feed?: WhaleTrade[] }>("/api/xiapan/whales?minDollar=300&limit=2"),
    fetchJson<{ pairs?: ArbPair[] }>("/api/xiapan/cross-arb?minDiv=3&limit=2"),
    fetchJson<{ events?: MentionEvent[] }>("/api/xiapan/mentions"),
  ]);

  const topPick = (picksJ?.picks ?? [])[0];
  const topWhale = (whalesJ?.trades_feed ?? [])[0];
  const topArb = (arbsJ?.pairs ?? [])[0];
  const topMention = (mentionsJ?.events ?? [])[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          padding: 48,
          color: INK,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: -1,
                lineHeight: 1.0,
              }}
            >
              押注热力图
            </div>
            <div
              style={{
                fontSize: 18,
                color: SOFT,
                marginTop: 8,
                fontFamily: "monospace",
              }}
            >
              哪场便宜 · 大户押什么 · 两网价差 · 会说啥词 · 全免费
            </div>
          </div>
          <div
            style={{
              fontSize: 14,
              color: SOFT,
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            DU4LEAVING · catchzvibe.studio/heatmap
          </div>
        </div>

        {/* 4 quadrants · flex (satori 不支持 grid) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Row 1 · top-left + top-right */}
          <div style={{ display: "flex", gap: 16, flex: 1 }}>
            <Quadrant
              badge="◇"
              title="最便宜的押"
              empty={!topPick}
              line1={topPick ? `${topPick.score} 分` : "—"}
              line1Color={INK}
              line2={topPick?.title ?? "现在没强候选"}
              line3={
                topPick
                  ? `押「${topPick.buy_side === "yes" ? "会" : "不会"}」  ${topPick.buy_price_c}¢/张`
                  : ""
              }
              line3Color={topPick?.buy_side === "yes" ? SAGE : ROD}
            />
            <Quadrant
              badge="≋"
              title="大户在押"
              empty={!topWhale}
              line1={topWhale ? `$${Math.round(topWhale.dollar_value)}` : "—"}
              line1Color={AMBER}
              line2={topWhale?.market_title ?? "暂无大单"}
              line3={
                topWhale
                  ? `${topWhale.side === "BUY" ? "买" : "卖"} ${topWhale.outcome} · ${topWhale.age_minutes}min 前`
                  : ""
              }
              line3Color={topWhale?.side === "BUY" ? SAGE : ROD}
            />
          </div>

          {/* Row 2 · bottom-left + bottom-right */}
          <div style={{ display: "flex", gap: 16, flex: 1 }}>
            <Quadrant
              badge="⇆"
              title="两网价差"
              empty={!topArb}
              line1={topArb ? `+${topArb.edge_pp.toFixed(1)}pp` : "—"}
              line1Color={AMBER}
              line2={topArb?.event_label ?? "两网现在差不多"}
              line3={
                topArb
                  ? `Kalshi ${Math.round(topArb.k_yes_ask)}¢  ↔  Poly ${Math.round(topArb.poly_yes_price)}¢`
                  : ""
              }
              line3Color={SOFT}
            />
            <Quadrant
              badge="✎"
              title="会说啥词"
              empty={!topMention}
              line1={topMention?.speaker ?? "—"}
              line1Color={INK}
              line2={topMention?.title ?? "暂无 mention 盘"}
              line3={
                topMention && topMention.markets.length > 0
                  ? topMention.markets
                      .slice(0, 3)
                      .map((m) => `${m.target_word} ${Math.round(m.yes_ask)}¢`)
                      .join(" · ")
                  : ""
              }
              line3Color={SOFT}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
            color: SOFT,
            fontFamily: "monospace",
          }}
        >
          <div style={{ display: "flex" }}>
            ● 实时 · 60s 刷 · 数据 Kalshi + Polymarket 公开
          </div>
          <div style={{ display: "flex" }}>
            高中生都能看懂
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

function Quadrant({
  badge,
  title,
  line1,
  line1Color,
  line2,
  line3,
  line3Color,
  empty,
}: {
  badge: string;
  title: string;
  line1: string;
  line1Color: string;
  line2: string;
  line3: string;
  line3Color: string;
  empty?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: PAPER_BRIGHT,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 24,
        opacity: empty ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          fontSize: 22,
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        <span style={{ display: "flex" }}>{badge}</span>
        <span style={{ display: "flex" }}>{title}</span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 42,
          fontWeight: 800,
          color: line1Color,
          letterSpacing: -1,
          lineHeight: 1.0,
          marginBottom: 12,
          fontFamily: "monospace",
        }}
      >
        {line1}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 18,
          color: INK,
          lineHeight: 1.3,
          marginBottom: 8,
          maxHeight: 70,
          overflow: "hidden",
        }}
      >
        {line2.length > 80 ? line2.slice(0, 78) + "…" : line2}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 14,
          color: line3Color,
          fontFamily: "monospace",
        }}
      >
        {line3}
      </div>
    </div>
  );
}
