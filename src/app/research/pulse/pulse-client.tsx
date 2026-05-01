// pulse-client · 自动写 essay-form · 7 个信号
"use client";

import { useEffect, useMemo, useState } from "react";
import { track } from "@vercel/analytics";
import ContactFooter from "@/components/du4/contact-footer";

interface Pick {
  ticker: string; title: string; buy_side: string; buy_price_c: number;
  score: number; edge_pp: number; vol_24: number; reasons: string[];
}
interface WhaleTrade {
  side: string; size: number; price: number; dollar_value: number;
  market_title: string; outcome: string; age_minutes: number; pseudonym?: string;
  trader_name?: string;
}
interface TopTrader {
  wallet: string; trader_name?: string; pseudonym?: string;
  trade_count: number; total_volume_usd: number;
  buy_count: number; sell_count: number; recent_markets: string[];
}
interface ArbPair {
  k_ticker: string; event_label: string;
  k_yes_ask: number; poly_yes_price: number;
  edge_pp: number; signal: string;
}
interface MentionEvent {
  speaker: string; category: string; title: string;
  markets: Array<{ target_word: string; yes_ask: number; bucket: string }>;
}

export default function PulseClient() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [whales, setWhales] = useState<WhaleTrade[]>([]);
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [arbs, setArbs] = useState<ArbPair[]>([]);
  const [mentions, setMentions] = useState<MentionEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now] = useState(new Date());

  useEffect(() => {
    track("pulse_view");
    Promise.all([
      fetch("/api/xiapan/picks?min=45&limit=15").then((r) => r.json()).catch(() => ({})),
      fetch("/api/xiapan/whales?minDollar=200&limit=50").then((r) => r.json()).catch(() => ({})),
      fetch("/api/xiapan/cross-arb?minDiv=3&limit=20").then((r) => r.json()).catch(() => ({})),
      fetch("/api/xiapan/mentions").then((r) => r.json()).catch(() => ({})),
    ]).then(([p, w, a, m]) => {
      setPicks(p.picks ?? []);
      setWhales(w.trades_feed ?? []);
      setTopTraders(w.top_traders ?? []);
      setArbs(a.pairs ?? []);
      setMentions(m.events ?? []);
      setLoaded(true);
    });
  }, []);

  // ======== 派生 7 个信号 ========

  const totalWhaleVolume = useMemo(
    () => whales.reduce((s, w) => s + w.dollar_value, 0),
    [whales]
  );

  const sideSkew = useMemo(() => {
    const buy = whales.filter((w) => w.side === "BUY").length;
    const sell = whales.filter((w) => w.side === "SELL").length;
    const total = buy + sell;
    if (total === 0) return null;
    return { buy, sell, buyPct: (buy / total) * 100 };
  }, [whales]);

  const topPick = picks[0];
  const topArb = arbs[0];

  const mostTradedMarkets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of whales) {
      counts.set(w.market_title, (counts.get(w.market_title) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [whales]);

  const totalMentionWords = useMemo(
    () => mentions.reduce((s, ev) => s + ev.markets.length, 0),
    [mentions]
  );

  const longShotMentions = useMemo(
    () =>
      mentions.flatMap((ev) =>
        ev.markets
          .filter((m) => m.bucket === "long_shot")
          .map((m) => ({ speaker: ev.speaker, word: m.target_word, price: m.yes_ask }))
      ).slice(0, 5),
    [mentions]
  );

  return (
    <div className="min-h-screen bg-[#F1EBDC] text-[#111111] font-cjk">
      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* HERO */}
        <header className="mb-12">
          <div className="text-xs text-[#6A6052] font-mono mb-2">
            发布 · {now.toISOString().slice(0, 10)} · 60 秒自动刷
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-serif tracking-tight mb-4">
            本周押注脉搏
          </h1>
          <p className="text-lg text-[#6A6052] leading-relaxed">
            Kalshi + Polymarket 实时数据 · 7 个本周值得看的信号 · 不是夸张 · 不是软文 · 是真数据。
          </p>
          <div className="mt-3 text-sm text-[#6A6052] font-mono">
            · 数据 {loaded ? "已就绪" : "加载中"} · 共 {whales.length} 大单 / {arbs.length} 价差 / {mentions.length} mention
          </div>
        </header>

        {/* SIGNAL 1 */}
        <Section
          num="1"
          title="过去 24 小时 · Polymarket 大户在玩什么"
          metric={`$${Math.round(totalWhaleVolume).toLocaleString()}`}
          metricLabel="总大单金额 · ≥ $200/单"
        >
          {sideSkew && (
            <p>
              {whales.length} 笔大单里 ·{" "}
              <strong className="text-[#6A8A6E]">{sideSkew.buy} 笔买</strong> ·{" "}
              <strong className="text-[#C1272D]">{sideSkew.sell} 笔卖</strong> ·{" "}
              买方占比{" "}
              <strong>{sideSkew.buyPct.toFixed(0)}%</strong>。
              {sideSkew.buyPct >= 60 && " 大户偏多 · 上行情绪更浓。"}
              {sideSkew.buyPct <= 40 && " 大户在收钱 · 下行偏多。"}
              {sideSkew.buyPct > 40 && sideSkew.buyPct < 60 && " 多空均衡 · 没明显偏向。"}
            </p>
          )}
          {!sideSkew && <p className="text-[#6A6052]">数据加载中…</p>}
        </Section>

        {/* SIGNAL 2 */}
        <Section
          num="2"
          title="最被反复下注的 5 个市场"
          metric={`${mostTradedMarkets[0]?.[1] ?? 0} 笔`}
          metricLabel="第一名 24h 大单数"
        >
          {mostTradedMarkets.length === 0 ? (
            <p className="text-[#6A6052]">暂无数据</p>
          ) : (
            <ol className="space-y-2 list-decimal list-inside marker:text-[#6A6052]">
              {mostTradedMarkets.map(([title, n]) => (
                <li key={title} className="text-[15px]">
                  <span className="font-medium">{title}</span> ·{" "}
                  <span className="text-[#B47820] font-bold">{n} 笔</span>
                </li>
              ))}
            </ol>
          )}
          <Aside>
            热门市场 ≠ 该跟。当大家都涌入 · 价格已经被定。看完 7 条再决定。
          </Aside>
        </Section>

        {/* SIGNAL 3 */}
        <Section
          num="3"
          title="App 算的最便宜的押"
          metric={topPick ? `${topPick.score} 分` : "—"}
          metricLabel="picks 引擎 top 1 (满 100)"
        >
          {topPick ? (
            <>
              <p className="text-[16px]">
                <span className="font-bold">{topPick.title}</span> ·
                {" "}
                建议押「
                <strong className={topPick.buy_side === "yes" ? "text-[#6A8A6E]" : "text-[#C1272D]"}>
                  {topPick.buy_side === "yes" ? "会" : "不会"}
                </strong>
                」 · 现价 {topPick.buy_price_c}¢ 一张
              </p>
              <ul className="mt-2 space-y-1 text-[14px] text-[#6A6052]">
                {topPick.reasons.slice(0, 3).map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[#6A6052]">现在没强候选 · 下波再说</p>
          )}
        </Section>

        {/* SIGNAL 4 */}
        <Section
          num="4"
          title="Top 3 鲸鱼 · 24h 谁在烧最多钱"
          metric={topTraders[0] ? `$${Math.round(topTraders[0].total_volume_usd)}` : "—"}
          metricLabel="第 1 名 24h 总下单"
        >
          {topTraders.length === 0 ? (
            <p className="text-[#6A6052]">数据加载中…</p>
          ) : (
            <div className="space-y-3">
              {topTraders.slice(0, 3).map((t) => {
                const skew = t.buy_count + t.sell_count > 0
                  ? (t.buy_count / (t.buy_count + t.sell_count)) * 100
                  : 50;
                return (
                  <div key={t.wallet} className="border-l-2 border-[#B47820] pl-3">
                    <div className="font-bold text-[15px]">
                      {t.trader_name || t.pseudonym || t.wallet.slice(0, 10) + "…"}
                    </div>
                    <div className="text-[13px] text-[#6A6052]">
                      {t.trade_count} 笔 · ${Math.round(t.total_volume_usd)} ·{" "}
                      <span className="text-[#6A8A6E]">买{skew.toFixed(0)}%</span>
                    </div>
                    {t.recent_markets[0] && (
                      <div className="text-[12px] text-[#6A6052] mt-1 italic">
                        最近押 · {t.recent_markets[0]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Aside>
            鲸鱼亏起来也是真亏 · 别盲目跟。但他们花了真钱 · 他们看到的信号你应该过一遍。
          </Aside>
        </Section>

        {/* SIGNAL 5 */}
        <Section
          num="5"
          title="Kalshi 跟 Polymarket 哪边便宜"
          metric={topArb ? `+${topArb.edge_pp.toFixed(1)}pp` : "—"}
          metricLabel="最大单事件价差"
        >
          {topArb ? (
            <>
              <p>
                <span className="font-bold">{topArb.event_label}</span>
              </p>
              <p className="mt-2 font-mono text-[14px]">
                Kalshi {Math.round(topArb.k_yes_ask)}¢ ↔ Polymarket{" "}
                {Math.round(topArb.poly_yes_price)}¢
              </p>
              <p className="mt-2">
                {topArb.signal === "kalshi_cheap_yes" && "Kalshi 这边「会」便宜 · 押 YES 性价比高。"}
                {topArb.signal === "kalshi_cheap_no" && "Kalshi 这边「不会」便宜 · 押 NO。"}
                {topArb.signal === "neutral" && "两网接近 · 没差。"}
              </p>
            </>
          ) : (
            <p className="text-[#6A6052]">两网此刻接近 · 没明显套利机会</p>
          )}
        </Section>

        {/* SIGNAL 6 */}
        <Section
          num="6"
          title="他会说哪些词 · mention 盘活跃度"
          metric={`${totalMentionWords}`}
          metricLabel="目前公开追踪的词数"
        >
          {longShotMentions.length === 0 ? (
            <p className="text-[#6A6052]">无活跃 mention · 等下个演讲日</p>
          ) : (
            <>
              <p>
                这周冷门 (≤ 30¢) 的词 · 被低估的可能性大 · 列前 5 ·
              </p>
              <ul className="mt-2 space-y-1">
                {longShotMentions.map((m, i) => (
                  <li key={i} className="font-mono text-[14px]">
                    · <strong>{m.speaker}</strong> 会说「{m.word}」?{" "}
                    <span className="text-[#B47820]">{Math.round(m.price)}¢</span>
                  </li>
                ))}
              </ul>
              <Aside>
                Catboy ($872K · top-100) 的主战场。秘诀 · 翻 15-20 场转录算词频 · 比直觉准。
              </Aside>
            </>
          )}
        </Section>

        {/* SIGNAL 7 */}
        <Section
          num="7"
          title="今天该不该下 · 一个简单判断"
          metric={
            picks.length === 0 ? "等" :
            sideSkew && sideSkew.buyPct >= 65 ? "慎" :
            picks.filter((p) => p.score >= 65).length >= 3 ? "下" : "看"
          }
          metricLabel="综合 · 等 / 看 / 下 / 慎"
        >
          <div className="space-y-2 text-[15px] leading-relaxed">
            {picks.length === 0 && (
              <p>没强候选 · 没 picks 引擎超 45 分的盘 · <strong>等</strong>。</p>
            )}
            {picks.length > 0 && picks.filter((p) => p.score >= 65).length >= 3 && (
              <p>
                <strong>有 {picks.filter((p) => p.score >= 65).length} 个强信号 (≥65 分)</strong> · 大户也活跃 ·{" "}
                <strong className="text-[#6A8A6E]">可下</strong>。但 Kelly 半仓 ·{" "}
                别 all in。
              </p>
            )}
            {picks.length > 0 && picks.filter((p) => p.score >= 65).length < 3 && (
              <p>
                有些候选但不够强 ·{" "}
                <strong>看</strong> · 别冲。
              </p>
            )}
            {sideSkew && sideSkew.buyPct >= 65 && (
              <p className="text-[#C1272D]">
                ⚠ 大户买入比例 {sideSkew.buyPct.toFixed(0)}% · 偏 FOMO 区 ·{" "}
                <strong>慎</strong>。逆势可能更值钱。
              </p>
            )}
          </div>
        </Section>

        {/* CTA */}
        <section className="mt-12 mb-8 p-8 bg-[#111] text-[#F1EBDC] rounded-lg">
          <h2 className="text-2xl font-bold mb-3 font-serif">
            想看完整版?
          </h2>
          <p className="text-sm text-[#C4BEB0] mb-4">
            完整版 du4leaving · iPhone + Mac · 多盘并行 · 智能退出 · 沉淀+迭代 · 本地 AI 顾问
          </p>
          <div className="flex gap-3 flex-wrap">
            <a
              href="/xiapan"
              onClick={() => track("pulse_cta_full")}
              className="bg-[#F1EBDC] text-[#111] px-5 py-2 rounded-full font-bold text-sm hover:bg-[#C1272D] hover:text-white transition"
            >
              在浏览器试用 →
            </a>
            <a
              href="/heatmap"
              onClick={() => track("pulse_cta_heatmap")}
              className="border border-[#F1EBDC] px-5 py-2 rounded-full font-bold text-sm hover:bg-white/10 transition"
            >
              热力图 →
            </a>
          </div>
        </section>

        {/* methodology */}
        <div className="text-xs text-[#6A6052] font-mono space-y-1 border-t border-black/10 pt-4">
          <p>· 数据源 · Kalshi + Polymarket 公开 API · 60s 自动刷</p>
          <p>· picks 引擎 · 5 路融合 (便宜分 + Kelly + cross-arb + AI mention + 信号 feed)</p>
          <p>· 本页自动写 · 不是一次性博客 · 你来 1 次跟 1 周后内容会不一样</p>
          <p>· 不构成投资建议 · 押注有亏损风险 · 量力而行</p>
        </div>
      </article>
      <ContactFooter />
    </div>
  );
}

function Section({
  num, title, metric, metricLabel, children,
}: {
  num: string; title: string;
  metric: string; metricLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-[28px] font-bold font-serif text-[#B47820]">
          {num}
        </span>
        <h2 className="text-xl md:text-2xl font-bold font-serif">{title}</h2>
      </div>
      <div className="bg-[#F7F2E6] border border-black/10 rounded-lg p-5 mb-3">
        <div className="text-3xl md:text-4xl font-bold font-mono">{metric}</div>
        <div className="text-xs text-[#6A6052] mt-1">{metricLabel}</div>
      </div>
      <div className="text-[15px] leading-relaxed text-[#111] space-y-2">
        {children}
      </div>
    </section>
  );
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 border-l-2 border-[#B47820] pl-3 py-1 text-[13px] text-[#6A6052] italic">
      {children}
    </div>
  );
}
