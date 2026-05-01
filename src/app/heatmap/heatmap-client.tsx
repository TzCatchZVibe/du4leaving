// heatmap-client.tsx · 客户端实时刷
"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import ContactFooter from "@/components/du4/contact-footer";

interface Pick {
  ticker: string;
  title: string;
  buy_side: string;
  buy_price_c: number;
  score: number;
  edge_pp: number;
  vol_24: number;
  reasons: string[];
}

interface WhaleTrade {
  side: string;
  size: number;
  price: number;
  dollar_value: number;
  market_title: string;
  outcome: string;
  age_minutes: number;
  pseudonym?: string;
}

interface ArbPair {
  k_ticker: string;
  event_label: string;
  k_yes_ask: number;
  poly_yes_price: number;
  yes_divergence_pp: number;
  edge_pp: number;
  signal: string;
}

interface MentionEvent {
  event_ticker: string;
  speaker: string;
  category: string;
  title: string;
  expires_at?: string;
  markets: Array<{
    ticker: string;
    target_word: string;
    yes_ask: number;
    bucket: string;
    bucket_label: string;
  }>;
}

export default function HeatmapClient() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [whales, setWhales] = useState<WhaleTrade[]>([]);
  const [arbs, setArbs] = useState<ArbPair[]>([]);
  const [mentions, setMentions] = useState<MentionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [pr, wr, ar, mr] = await Promise.all([
        fetch("/api/xiapan/picks?min=45&limit=8").then((r) => r.json()).catch(() => ({})),
        fetch("/api/xiapan/whales?minDollar=300&limit=10").then((r) => r.json()).catch(() => ({})),
        fetch("/api/xiapan/cross-arb?minDiv=3&limit=8").then((r) => r.json()).catch(() => ({})),
        fetch("/api/xiapan/mentions").then((r) => r.json()).catch(() => ({})),
      ]);
      setPicks(pr.picks ?? []);
      setWhales(wr.trades_feed ?? []);
      setArbs(ar.pairs ?? []);
      setMentions(mr.events ?? []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    track("heatmap_view");
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#F1EBDC] text-[#111111] font-mono">
      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight">
            押注热力图
          </h1>
          <a
            href="/xiapan"
            onClick={() => track("heatmap_cta_full", { source: "header" })}
            className="text-sm bg-[#111] text-[#F1EBDC] px-4 py-2 rounded-full hover:bg-[#C1272D] transition"
          >
            完整版 →
          </a>
        </div>
        <p className="mt-3 text-base text-[#6A6052] max-w-2xl">
          看哪场便宜 · 大户在押什么 · 两个网站价差 · 全免费 · 不用登录 · 高中生都能看懂
        </p>
        {!loading && (
          <p className="mt-2 text-xs text-[#6A6052]">
            ● 60 秒自动刷 · 数据 Kalshi + Polymarket 公开
          </p>
        )}
      </section>

      {/* 4 列 · 移动端单列 · 平板 2 列 */}
      <section className="max-w-6xl mx-auto px-6 pb-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 最便宜押注 */}
        <div className="bg-[#F7F2E6] rounded-lg border border-black/10 p-4">
          <h2 className="text-base font-bold mb-2">◇ 最便宜的押</h2>
          <p className="text-[10px] text-[#6A6052] mb-3">App 算的便宜分越高越值得下</p>
          {loading ? (
            <Skeleton n={5} />
          ) : picks.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {picks.slice(0, 6).map((p) => (
                <div key={p.ticker} className="text-xs border-b border-black/5 pb-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-[11px]">{p.score} 分</span>
                    <span
                      className={
                        p.buy_side === "yes" ? "text-[#6A8A6E]" : "text-[#C1272D]"
                      }
                    >
                      押「{p.buy_side === "yes" ? "会" : "不会"}」 {p.buy_price_c}¢
                    </span>
                  </div>
                  <div className="text-[11px] mt-1 line-clamp-2">{p.title}</div>
                  {p.reasons[0] && (
                    <div className="text-[10px] text-[#6A6052] mt-1 line-clamp-1">
                      · {p.reasons[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 大户在押 */}
        <div className="bg-[#F7F2E6] rounded-lg border border-black/10 p-4">
          <h2 className="text-base font-bold mb-2">≋ 大户在押</h2>
          <p className="text-[10px] text-[#6A6052] mb-3">
            Polymarket 上 $300+ 的单 · 看大户压哪边
          </p>
          {loading ? (
            <Skeleton n={5} />
          ) : whales.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {whales.slice(0, 6).map((w, i) => (
                <div key={i} className="text-xs border-b border-black/5 pb-2">
                  <div className="flex justify-between items-baseline">
                    <span
                      className={
                        w.side === "BUY" ? "text-[#6A8A6E] font-bold" : "text-[#C1272D] font-bold"
                      }
                    >
                      {w.side === "BUY" ? "买" : "卖"} ${Math.round(w.dollar_value)}
                    </span>
                    <span className="text-[#6A6052] text-[10px]">{w.age_minutes}min 前</span>
                  </div>
                  <div className="text-[11px] mt-1 line-clamp-2">{w.market_title}</div>
                  <div className="text-[10px] text-[#6A6052] mt-1">
                    押 {w.outcome} @ {Math.round(w.price * 100)}¢
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 两网价差 */}
        <div className="bg-[#F7F2E6] rounded-lg border border-black/10 p-4">
          <h2 className="text-base font-bold mb-2">⇆ 两网价差</h2>
          <p className="text-[10px] text-[#6A6052] mb-3">
            Kalshi 跟 Polymarket 同件事不同价 · 哪边便宜
          </p>
          {loading ? (
            <Skeleton n={5} />
          ) : arbs.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {arbs.slice(0, 6).map((a) => (
                <div key={a.k_ticker} className="text-xs border-b border-black/5 pb-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-[#B47820]">
                      +{a.edge_pp.toFixed(1)}pp
                    </span>
                    <span className="text-[10px] text-[#6A6052]">
                      {a.signal === "kalshi_cheap_yes"
                        ? "Kalshi「会」便宜"
                        : a.signal === "kalshi_cheap_no"
                        ? "Kalshi「不会」便宜"
                        : "—"}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1 line-clamp-2">{a.event_label}</div>
                  <div className="text-[10px] text-[#6A6052] mt-1 font-mono">
                    K {Math.round(a.k_yes_ask)}¢ ↔ Poly {Math.round(a.poly_yes_price)}¢
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mention 盘 (Catboy 案例公开化) */}
        <div className="bg-[#F7F2E6] rounded-lg border border-black/10 p-4">
          <h2 className="text-base font-bold mb-2">✎ 会说啥词?</h2>
          <p className="text-[10px] text-[#6A6052] mb-3">
            押「某人在某场合 · 会不会说某词」 · 查历史词频赚回归
          </p>
          {loading ? (
            <Skeleton n={5} />
          ) : mentions.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {mentions.slice(0, 4).map((ev) => (
                <div key={ev.event_ticker} className="text-xs border-b border-black/5 pb-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-[11px]">{ev.speaker}</span>
                    <span className="text-[10px] text-[#6A6052]">
                      {categoryBadge(ev.category)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6A6052] mt-1 line-clamp-2">
                    {ev.title}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ev.markets.slice(0, 4).map((m) => (
                      <span
                        key={m.ticker}
                        className={`text-[9px] px-1.5 py-0.5 rounded ${bucketStyle(m.bucket)}`}
                      >
                        {m.target_word} {Math.round(m.yes_ask)}¢
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-black/10">
        <div className="bg-[#111] text-[#F1EBDC] rounded-lg p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold font-serif mb-3">
            想看完整版?
          </h2>
          <p className="text-sm text-[#C4BEB0] mb-6 max-w-xl">
            完整版 du4leaving · iPhone + Mac · 多盘并行监控 · 智能退出顾问 · 沉淀+迭代 · 本地 AI 顾问 (Hermes) · 隐私 0 钱
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/xiapan"
              onClick={() => track("heatmap_cta_full", { source: "footer" })}
              className="bg-[#F1EBDC] text-[#111] px-5 py-3 rounded-full font-bold hover:bg-[#C1272D] hover:text-white transition text-sm"
            >
              在浏览器试用 →
            </a>
            <a
              href="https://github.com/tomouzheng/du4leaving"
              onClick={() => track("heatmap_cta_github")}
              className="border border-[#F1EBDC] px-5 py-3 rounded-full font-bold hover:bg-white/10 transition text-sm"
            >
              GitHub
            </a>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-[#C4BEB0]">
            <Feature t="多盘 cockpit" d="同时几场就同时看几场" />
            <Feature t="跨平台扫" d="Kalshi×Polymarket 价差" />
            <Feature t="本地 AI" d="Hermes 不联网 · 隐私" />
            <Feature t="沉淀链路" d="每输赢都成数据" />
          </div>
        </div>
      </section>

      {/* 高中生帮助 */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <h2 className="text-lg font-bold mb-3">§ 不懂?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <Item t="什么是「会 / 不会」?" d="每场就是一道是非题。「会」= 你押发生 · 中了赔到 1 美元。「不会」= 反过来。" />
          <Item t="65¢ 是什么意思?" d="买一张 0.65 美元 · 真的发生了 · 1 美元给你 · 中了赚 35¢。" />
          <Item t="便宜分?" d="App 模型估真概率 70% · Kalshi 才卖 65% · 便宜了 5 个点。越正越值得下。" />
          <Item t="为啥追大户?" d="大户花真金白银押 · 他们看到的信号 · 你跟着看一眼。但别 100% 跟。" />
          <Item t="会说啥词? (mention 盘)" d="押「某人在某场合 · 会不会说某个特定的词」。比如 Powell 开会会说 'inflation'。查历史词频比市场价更准 · 就有边。" />
          <Item t="冷门 vs 高位?" d="冷门 (<30¢) 中了大赚 · 高位 (>70¢) 几乎稳但赚少。 Catboy 在两端都赚到钱。" />
        </div>
      </section>

      {/* footer */}
      <ContactFooter />
    </div>
  );
}

function Skeleton({ n }: { n: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-12 bg-black/5 rounded" />
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-[#6A6052]">现在没数据 · 等下波</p>;
}

function Feature({ t, d }: { t: string; d: string }) {
  return (
    <div>
      <div className="font-bold text-[#F1EBDC]">{t}</div>
      <div>{d}</div>
    </div>
  );
}

function Item({ t, d }: { t: string; d: string }) {
  return (
    <div className="bg-[#F7F2E6] rounded-lg border border-black/10 p-3">
      <div className="font-bold text-[13px] mb-1">{t}</div>
      <div className="text-[12px] text-[#6A6052]">{d}</div>
    </div>
  );
}

function categoryBadge(c: string): string {
  switch (c) {
    case "political": return "政";
    case "earnings":  return "财";
    case "cultural":  return "文";
    default:          return "·";
  }
}

function bucketStyle(b: string): string {
  switch (b) {
    case "long_shot": return "bg-[#B47820]/15 text-[#B47820]";
    case "junk_bond":
    case "near_cert": return "bg-[#6A8A6E]/15 text-[#6A8A6E]";
    case "middle":    return "bg-black/10 text-[#111]";
    default:          return "bg-black/5 text-[#6A6052]";
  }
}
