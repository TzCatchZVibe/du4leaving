"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

type Recent = {
  team1_slug: string;
  team2_slug: string;
  scheduled_at: string;
  team1_score: number;
  team2_score: number;
  winner_slug: string | null;
  league_slug: string;
};

type Context = {
  ok: boolean;
  ticker: string;
  title: string;
  yesSub: string;
  noSub: string;
  league: string | null;
  stream: { embed: (h: string) => string; url: string; label: string } | null;
  yesRecent: Recent[];
  noRecent: Recent[];
  h2h: Recent[];
  links: {
    kalshi: string;
    kalshiEvent: string | null;
    redditSearchYes: string;
    redditSearchNo: string;
    twitterYes: string;
    liquipedia: string | null;
  };
};

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "America/Chicago",
      month: "numeric",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(5, 10);
  }
}

function MiniMatch({ m }: { m: Recent }) {
  const won = m.winner_slug;
  const t1 = m.team1_slug.toUpperCase();
  const t2 = m.team2_slug.toUpperCase();
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono py-0.5">
      <span className="text-ink-dim w-10">{fmt(m.scheduled_at)}</span>
      <span className="text-ink-dim w-10 text-[9px] uppercase">
        {m.league_slug}
      </span>
      <span
        className={
          won === m.team1_slug ? "font-bold text-sage" : "text-ink-soft"
        }
      >
        {t1}
      </span>
      <span className="tabular-nums text-ink-dim">
        {m.team1_score}-{m.team2_score}
      </span>
      <span
        className={
          won === m.team2_slug ? "font-bold text-sage" : "text-ink-soft"
        }
      >
        {t2}
      </span>
    </div>
  );
}

export function MatchContext({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamOpen, setStreamOpen] = useState(false);
  const [host, setHost] = useState("localhost");

  useEffect(() => {
    setHost(typeof window !== "undefined" ? window.location.hostname : "localhost");
    let alive = true;
    fetch(`/api/xiapan/match-context/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ticker]);

  if (loading)
    return (
      <div className="text-[11px] text-ink-dim font-mono pt-2">
        加载决策依据…
      </div>
    );
  if (!data || !data.ok) return null;

  // 该队赢/输统计
  const yesStats = (() => {
    let w = 0, l = 0;
    for (const r of data.yesRecent) {
      if (!r.winner_slug) continue;
      const isYesTeam =
        r.team1_slug.includes(data.yesSub.toLowerCase().slice(0, 3)) ||
        r.team2_slug.includes(data.yesSub.toLowerCase().slice(0, 3));
      if (!isYesTeam) continue;
      if (
        r.winner_slug.includes(data.yesSub.toLowerCase().slice(0, 3))
      )
        w++;
      else l++;
    }
    return `${w}胜 ${l}负`;
  })();
  const noStats = (() => {
    let w = 0, l = 0;
    for (const r of data.noRecent) {
      if (!r.winner_slug) continue;
      const isNoTeam =
        r.team1_slug.includes(data.noSub.toLowerCase().slice(0, 3)) ||
        r.team2_slug.includes(data.noSub.toLowerCase().slice(0, 3));
      if (!isNoTeam) continue;
      if (
        r.winner_slug.includes(data.noSub.toLowerCase().slice(0, 3))
      )
        w++;
      else l++;
    }
    return `${w}胜 ${l}负`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 space-y-3"
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
        ⊙ 决策依据
      </div>

      {/* 直播 */}
      {data.stream && (
        <div className="bg-paper rounded border border-ink/10 overflow-hidden">
          <button
            onClick={() => setStreamOpen(!streamOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-paper-deep/30"
          >
            <span className="font-bold">▷ {data.stream.label}</span>
            <span className="text-ink-dim text-[10px]">
              {streamOpen ? "▴ 收起" : "▾ 看比赛直播"}
            </span>
          </button>
          {streamOpen && (
            <div className="aspect-video bg-black">
              <iframe
                src={data.stream.embed(host)}
                className="w-full h-full"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                title={data.stream.label}
              />
            </div>
          )}
        </div>
      )}

      {/* 战队近期 + H2H */}
      <div className="bg-paper rounded border border-ink/10 p-3 space-y-2.5">
        <div>
          <div className="text-[11px] font-bold mb-1">
            <span className="text-red">{data.yesSub}</span> 近 5 场 · {yesStats}
          </div>
          {data.yesRecent.length === 0 ? (
            <div className="text-[10px] text-ink-dim">暂无历史 (V0 仅 LOL)</div>
          ) : (
            <div>
              {data.yesRecent.slice(0, 5).map((m, i) => (
                <MiniMatch key={i} m={m} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-ink/5 pt-2">
          <div className="text-[11px] font-bold mb-1">
            <span className="text-red">{data.noSub}</span> 近 5 场 · {noStats}
          </div>
          {data.noRecent.length === 0 ? (
            <div className="text-[10px] text-ink-dim">暂无历史</div>
          ) : (
            <div>
              {data.noRecent.slice(0, 5).map((m, i) => (
                <MiniMatch key={i} m={m} />
              ))}
            </div>
          )}
        </div>

        {data.h2h.length > 0 && (
          <div className="border-t border-ink/5 pt-2">
            <div className="text-[11px] font-bold mb-1">两队历史交手</div>
            {data.h2h.slice(0, 5).map((m, i) => (
              <MiniMatch key={i} m={m} />
            ))}
          </div>
        )}
      </div>

      {/* 跳外部 */}
      <div className="bg-paper rounded border border-ink/10 p-3">
        <div className="text-[11px] text-ink-dim mb-1.5">
          外部链接 · 跳出看更多
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
          <a
            href={data.links.kalshi}
            target="_blank"
            rel="noopener"
            className="px-2 py-1 bg-paper-deep rounded hover:bg-ink hover:text-paper"
          >
            Kalshi 页 ↗
          </a>
          <a
            href={data.links.redditSearchYes}
            target="_blank"
            rel="noopener"
            className="px-2 py-1 bg-paper-deep rounded hover:bg-ink hover:text-paper"
          >
            Reddit 搜 {data.yesSub.slice(0, 8)} ↗
          </a>
          <a
            href={data.links.redditSearchNo}
            target="_blank"
            rel="noopener"
            className="px-2 py-1 bg-paper-deep rounded hover:bg-ink hover:text-paper"
          >
            Reddit 搜 {data.noSub.slice(0, 8)} ↗
          </a>
          <a
            href={data.links.twitterYes}
            target="_blank"
            rel="noopener"
            className="px-2 py-1 bg-paper-deep rounded hover:bg-ink hover:text-paper"
          >
            X 搜 ↗
          </a>
          {data.links.liquipedia && (
            <a
              href={data.links.liquipedia}
              target="_blank"
              rel="noopener"
              className="px-2 py-1 bg-paper-deep rounded hover:bg-ink hover:text-paper"
            >
              Liquipedia ↗
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
