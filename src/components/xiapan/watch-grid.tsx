"use client";

import { useEffect, useState } from "react";

type Position = {
  ticker: string;
  side: "yes" | "no";
  qty: number;
  exposure: number;
  avg_cents: number;
  realized_pnl: number;
  fees: number;
};

const DEFAULT_STREAM_PRESETS: Record<string, { label: string; embedUrl: (host: string) => string; openUrl: string }> = {
  lck: {
    label: "LCK · Twitch (官方英语)",
    embedUrl: (host) => `https://player.twitch.tv/?channel=lck&parent=${host}`,
    openUrl: "https://www.twitch.tv/lck",
  },
  lec: {
    label: "LEC · Twitch",
    embedUrl: (host) => `https://player.twitch.tv/?channel=lec&parent=${host}`,
    openUrl: "https://www.twitch.tv/lec",
  },
  lcs: {
    label: "LCS · Twitch",
    embedUrl: (host) => `https://player.twitch.tv/?channel=lcs&parent=${host}`,
    openUrl: "https://www.twitch.tv/lcs",
  },
  lpl: {
    label: "LPL · YouTube (English)",
    embedUrl: () =>
      "https://www.youtube.com/embed/live_stream?channel=UCdkWzHIpOLp4o7H2c5JI3jw",
    openUrl: "https://www.youtube.com/@LPLEnglish/streams",
  },
  ytv_nba: {
    label: "NBA · YouTube TV (新窗口登录)",
    embedUrl: () => "",
    openUrl: "https://tv.youtube.com",
  },
  ytv_mlb: {
    label: "MLB · YouTube TV",
    embedUrl: () => "",
    openUrl: "https://tv.youtube.com",
  },
  custom: {
    label: "Custom · 粘贴 URL",
    embedUrl: () => "",
    openUrl: "",
  },
};

function autoPickPreset(ticker: string): string {
  const t = ticker.toUpperCase();
  if (t.includes("LOLGAME") || t.includes("LOL")) {
    // Kalshi sub_title 推一下, 但 ticker 信息不够, 默认 LCK
    return "lck";
  }
  if (t.includes("NBA")) return "ytv_nba";
  if (t.includes("MLB")) return "ytv_mlb";
  if (t.includes("ITF") || t.includes("ATP") || t.includes("WTA")) return "custom";
  return "custom";
}

function loadStreamMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("xiapan:streams") || "{}");
  } catch {
    return {};
  }
}

function saveStreamMap(m: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("xiapan:streams", JSON.stringify(m));
}

export function WatchGrid({ positions }: { positions: Position[] }) {
  const [streams, setStreams] = useState<Record<string, string>>(() => loadStreamMap());
  const [host, setHost] = useState("localhost");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.hostname || "localhost");
    }
  }, []);

  if (positions.length === 0) {
    return (
      <div className="bg-paper-bright border border-ink/10 rounded-md p-6 text-center">
        <div className="text-2xl">🎥</div>
        <div className="font-bold mt-1">观赛模式</div>
        <div className="text-xs text-ink-dim mt-1">
          没持仓 · 下了单这里自动出现直播窗口
        </div>
      </div>
    );
  }

  function setStream(ticker: string, val: string) {
    const next = { ...streams, [ticker]: val };
    setStreams(next);
    saveStreamMap(next);
  }

  // grid · 1=1 col, 2=2 cols, 3-4=2x2, 5+=3x grid
  const n = positions.length;
  const cols =
    n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : n <= 4 ? "grid-cols-2" : "grid-cols-3";
  const aspectClass = n === 1 ? "aspect-video" : "aspect-video";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm font-bold">🎥 观赛模式</div>
          <div className="text-[11px] text-ink-dim">
            {positions.length} 个持仓 · 选直播源 → iframe 内嵌
          </div>
        </div>
      </div>
      <div className={`grid ${cols} gap-3`}>
        {positions.map((p) => {
          const presetKey = streams[p.ticker]
            ? streams[p.ticker].startsWith("preset:")
              ? streams[p.ticker].replace("preset:", "")
              : "custom"
            : autoPickPreset(p.ticker);
          const preset = DEFAULT_STREAM_PRESETS[presetKey];
          const customUrl =
            streams[p.ticker]?.startsWith("url:")
              ? streams[p.ticker].replace("url:", "")
              : "";
          const embed = preset?.embedUrl(host) || customUrl;
          return (
            <div
              key={p.ticker}
              className="bg-paper-bright border border-ink/10 rounded-md overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-ink/10 flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono truncate" title={p.ticker}>
                    {p.ticker}
                  </div>
                  <div className="text-[10px] text-ink-dim">
                    {p.side.toUpperCase()} {p.qty.toFixed(0)} @ {p.avg_cents}¢ · exposure $
                    {p.exposure.toFixed(2)}
                  </div>
                </div>
                <select
                  value={presetKey}
                  onChange={(e) => setStream(p.ticker, `preset:${e.target.value}`)}
                  className="text-[10px] font-mono px-1 py-0.5 bg-paper border border-ink/20 rounded"
                >
                  {Object.entries(DEFAULT_STREAM_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${aspectClass} bg-ink/5 relative`}>
                {presetKey === "custom" ? (
                  <CustomEmbed
                    url={customUrl}
                    onChange={(u) => setStream(p.ticker, `url:${u}`)}
                  />
                ) : presetKey.startsWith("ytv_") ? (
                  <YouTubeTvLauncher openUrl={preset.openUrl} />
                ) : embed ? (
                  <iframe
                    src={embed}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                    title={p.ticker}
                  />
                ) : null}
              </div>
              <div className="px-3 py-1.5 text-[10px] text-ink-dim flex justify-between">
                <a
                  href={preset?.openUrl || customUrl}
                  target="_blank"
                  rel="noopener"
                  className="hover:text-ink"
                >
                  外部窗口打开 →
                </a>
                <a
                  href={`https://kalshi.com/markets/${p.ticker}`}
                  target="_blank"
                  rel="noopener"
                  className="hover:text-ink"
                >
                  Kalshi 页面 →
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomEmbed({
  url,
  onChange,
}: {
  url: string;
  onChange: (u: string) => void;
}) {
  const [v, setV] = useState(url);
  if (!url) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-xs text-ink-dim">
        <div>粘贴 YouTube / Twitch / 直播页面 URL</div>
        <input
          type="text"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="https://..."
          className="w-full max-w-xs px-2 py-1 bg-paper border border-ink/20 rounded text-xs font-mono"
        />
        <button
          onClick={() => onChange(v)}
          className="px-3 py-1 bg-ink text-paper text-xs font-mono rounded"
        >
          嵌入
        </button>
        <div className="text-[10px] text-ink-dim mt-2">
          YouTube · 用 watch?v=ID → 自动转 embed
          <br />
          Twitch · 用 channel 名
        </div>
      </div>
    );
  }
  // 自动转 youtube watch → embed
  let embedUrl = url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) embedUrl = `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const tw = url.match(/twitch\.tv\/([\w-]+)/);
  if (tw && typeof window !== "undefined")
    embedUrl = `https://player.twitch.tv/?channel=${tw[1]}&parent=${window.location.hostname}`;
  return (
    <iframe
      src={embedUrl}
      className="w-full h-full"
      allow="autoplay; fullscreen; encrypted-media"
      allowFullScreen
      title="custom"
    />
  );
}

function YouTubeTvLauncher({ openUrl }: { openUrl: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-br from-paper to-paper-deep">
      <div className="text-3xl">📺</div>
      <div className="text-xs font-bold">YouTube TV 需登录</div>
      <div className="text-[10px] text-ink-dim max-w-xs leading-relaxed">
        Google 不允许 iframe 嵌入 · 点下面在新窗口打开 ·
        <br />
        登录后桌面分屏摆 4 个 tab
      </div>
      <button
        onClick={() => window.open(openUrl, "_blank", "popup,width=900,height=600")}
        className="px-4 py-2 bg-red text-paper text-xs font-mono rounded mt-1"
      >
        打开 YouTube TV →
      </button>
    </div>
  );
}
