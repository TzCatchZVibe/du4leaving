"use client";

import { useEffect, useState } from "react";

type Post = {
  title: string;
  url: string;
  permalink: string;
  score: number;
  comments: number;
  ts: string;
  sub: string;
  flair: string | null;
};

type Resp = {
  ok: boolean;
  topic: string;
  label: string;
  emoji: string;
  posts: Post[];
  error?: string;
};

const TOPICS = [
  { key: "lol", label: "[電] LOL" },
  { key: "nba", label: "[篮] NBA" },
  { key: "mlb", label: "[棒] MLB" },
  { key: "tennis", label: "[网] Tennis" },
  { key: "soccer", label: "[足] Soccer" },
  { key: "cs", label: "[枪] CS2" },
  { key: "valorant", label: "[准] VAL" },
  { key: "politics", label: "[政] Politics" },
];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "刚刚";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}min`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h`;
  return `${Math.floor(ms / 86400_000)}d`;
}

export function NewsCard() {
  const [topic, setTopic] = useState("lol");
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/xiapan/news?topic=${topic}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [topic]);

  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-ink/10">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-bold">¶ 闻 / 资讯</div>
          <div className="text-[10px] text-ink-dim">30min cache</div>
        </div>
        <div className="mt-1 flex gap-1 flex-wrap">
          {TOPICS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTopic(t.key)}
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${topic === t.key ? "bg-ink text-paper" : "bg-paper-deep/40 hover:bg-paper-deep"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {loading && (
          <div className="p-3 text-xs text-ink-dim font-mono">加载中…</div>
        )}
        {data && data.ok && (
          <ul className="divide-y divide-ink/5">
            {data.posts.slice(0, 12).map((p, i) => (
              <li key={i} className="px-3.5 py-2 hover:bg-paper-deep/20">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="block"
                  title={p.title}
                >
                  <div className="text-[11px] leading-snug line-clamp-3">
                    {p.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-ink-dim">
                    <span>r/{p.sub}</span>
                    <span>·</span>
                    <span>👍 {p.score}</span>
                    <span>·</span>
                    <span>💬 {p.comments}</span>
                    <span>·</span>
                    <span>{timeAgo(p.ts)}</span>
                    {p.flair && (
                      <span className="px-1 bg-amber/15 rounded text-[9px]">
                        {p.flair.slice(0, 14)}
                      </span>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
        {data && data.ok && data.posts.length === 0 && (
          <div className="p-3 text-xs text-ink-dim font-mono">无新闻</div>
        )}
        {data && !data.ok && (
          <div className="p-3 text-xs text-red font-mono">⚠ {data.error}</div>
        )}
      </div>
      <div className="px-3.5 py-1.5 border-t border-ink/5 text-[10px] text-ink-dim flex items-baseline justify-between gap-2">
        <a
          href="https://discord.gg/kalshi"
          target="_blank"
          rel="noopener"
          className="font-mono hover:text-ink"
        >
          🔗 Kalshi Discord
        </a>
        <a
          href="https://twitter.com/Kalshi"
          target="_blank"
          rel="noopener"
          className="font-mono hover:text-ink"
        >
          @Kalshi
        </a>
        <span>30m cache</span>
      </div>
    </div>
  );
}
