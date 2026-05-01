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

import type { EdgeRow as SharedEdgeRow } from "@/lib/xiapan/types";
// Sprint 4 · 用共享 EdgeRow super-set · play-dashboard 传入兼容
type EdgeRow = Pick<
  SharedEdgeRow,
  | "ts"
  | "marketTicker"
  | "team1"
  | "team2"
  | "modelPYes"
  | "myEdgePp"
  | "direction"
  | "buySide"
  | "buyPriceC"
  | "vol24"
  | "level"
  | "kellySuggestStake"
>;

const STREAM_PRESETS: Record<string, { label: string; embed?: (host: string) => string; openUrl?: string; emoji: string; tier: "free" | "paid" }> = {
  // ═══ 电竞 (全免费 · Twitch/YouTube 嵌入) ═══
  twitch_lck: {
    label: "[电] LCK · Twitch", emoji: "電", tier: "free",
    embed: (h) => `https://player.twitch.tv/?channel=lck&parent=${h}&muted=false`,
    openUrl: "https://www.twitch.tv/lck",
  },
  twitch_lec: {
    label: "[电] LEC · Twitch", emoji: "電", tier: "free",
    embed: (h) => `https://player.twitch.tv/?channel=lec&parent=${h}&muted=false`,
    openUrl: "https://www.twitch.tv/lec",
  },
  twitch_lcs: {
    label: "[电] LCS · Twitch", emoji: "電", tier: "free",
    embed: (h) => `https://player.twitch.tv/?channel=lcs&parent=${h}&muted=false`,
    openUrl: "https://www.twitch.tv/lcs",
  },
  yt_lpl: {
    label: "[电] LPL · YouTube", emoji: "電", tier: "free",
    embed: () => "https://www.youtube.com/embed/live_stream?channel=UCdkWzHIpOLp4o7H2c5JI3jw",
    openUrl: "https://www.youtube.com/@LPLEnglish/streams",
  },
  twitch_dota: {
    label: "[电] Dota2 · Twitch", emoji: "刀", tier: "free",
    embed: (h) => `https://player.twitch.tv/?channel=dota2ti&parent=${h}`,
    openUrl: "https://www.twitch.tv/directory/category/dota-2",
  },
  twitch_cs: {
    label: "[电] CS2 · Twitch ESL", emoji: "枪", tier: "free",
    embed: (h) => `https://player.twitch.tv/?channel=esl_csgo&parent=${h}`,
    openUrl: "https://www.twitch.tv/directory/category/counter-strike",
  },
  twitch_val: {
    label: "[电] VAL · VCT", emoji: "靶", tier: "free",
    embed: (h) => `https://player.twitch.tv/?channel=valorant&parent=${h}`,
    openUrl: "https://www.twitch.tv/valorant",
  },
  // ═══ 美式 (YT TV 弹窗 · 你已订阅) ═══
  ytv_nba: {
    label: "[篮] NBA · YouTube TV", emoji: "篮", tier: "paid",
    openUrl: "https://tv.youtube.com",
  },
  ytv_mlb: {
    label: "[棒] MLB · YouTube TV", emoji: "棒", tier: "paid",
    openUrl: "https://tv.youtube.com",
  },
  ytv_nfl: {
    label: "[球] NFL · YouTube TV", emoji: "球", tier: "paid",
    openUrl: "https://tv.youtube.com",
  },
  ytv_nhl: {
    label: "[冰] NHL · YouTube TV", emoji: "冰", tier: "paid",
    openUrl: "https://tv.youtube.com",
  },
  ytv_tennis: {
    label: "[网] Tennis · YT TV", emoji: "网", tier: "paid",
    openUrl: "https://tv.youtube.com/Tennis",
  },
  // ═══ 足球 ═══
  peacock_epl: {
    label: "[足] EPL · Peacock", emoji: "足", tier: "paid",
    openUrl: "https://www.peacocktv.com/sports/soccer/premier-league",
  },
  paramount_ucl: {
    label: "[足] UCL · Paramount+", emoji: "足", tier: "paid",
    openUrl: "https://www.paramountplus.com/sports/uefa-champions-league/",
  },
  espn_mls: {
    label: "[足] MLS · Apple TV+", emoji: "足", tier: "paid",
    openUrl: "https://tv.apple.com/us/mls",
  },
  // ═══ 综合体育 ═══
  espn_plus: {
    label: "[综] ESPN+ · UFC/Tennis", emoji: "综", tier: "paid",
    openUrl: "https://plus.espn.com/",
  },
  // ═══ 政治 / 其他 (免费 YT 直播) ═══
  yt_cnn: {
    label: "[闻] CNN Live · YouTube", emoji: "闻", tier: "free",
    embed: () => "https://www.youtube.com/embed/live_stream?channel=UCupvZG-5ko_eiXAupbDfxWw",
    openUrl: "https://www.youtube.com/@CNN/streams",
  },
  // ═══ 数据备忘 / 链接 ═══
  hltv: {
    label: "[查] CS2 · HLTV.org", emoji: "查", tier: "free",
    openUrl: "https://www.hltv.org/",
  },
  // ═══ 自定 ═══
  custom: {
    label: "粘贴 URL", emoji: "◇", tier: "free",
  },
};

function parseCustomUrl(url: string, host: string): string {
  if (!url) return "";
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const tw = url.match(/twitch\.tv\/([\w-]+)/);
  if (tw) return `https://player.twitch.tv/?channel=${tw[1]}&parent=${host}`;
  return url;
}

type CinemaSlot = {
  preset: string;
  customUrl?: string;
};

function loadSlots(): CinemaSlot[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem("xiapan:cinema") || "[]");
  } catch {
    return [];
  }
}
function saveSlots(s: CinemaSlot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("xiapan:cinema", JSON.stringify(s));
}

export function CinemaMode({
  edges,
  positions,
  onBet,
  onExit,
}: {
  edges: EdgeRow[];
  positions: Position[];
  onBet: (row: EdgeRow, count: number) => void;
  onExit: () => void;
}) {
  const [slots, setSlots] = useState<CinemaSlot[]>([]);
  const [host, setHost] = useState("localhost");
  const [gridSize, setGridSize] = useState<1 | 2 | 4>(2);

  useEffect(() => {
    setHost(typeof window !== "undefined" ? window.location.hostname : "localhost");
    const s = loadSlots();
    if (s.length === 0) {
      setSlots([
        { preset: "twitch_lck" },
        { preset: "twitch_lec" },
        { preset: "twitch_lcs" },
        { preset: "yt_lpl" },
      ]);
    } else {
      setSlots(s);
    }
  }, []);

  function updateSlot(idx: number, slot: CinemaSlot) {
    const next = [...slots];
    next[idx] = slot;
    setSlots(next);
    saveSlots(next);
  }

  const visibleSlots = slots.slice(0, gridSize);
  const gridClass =
    gridSize === 1 ? "grid-cols-1" : gridSize === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-2";
  const aspectClass = gridSize === 1 ? "aspect-video" : "aspect-video";

  const strong = edges.filter((e) => e.level === "strong");
  const watch = edges.filter((e) => e.level === "watch");

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* Top Bar */}
      <div className="px-4 py-2 border-b border-paper/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-bold">▣ 影院</span>
          <span className="text-[11px] font-mono text-paper/50">
            {gridSize} 路 · {strong.length} STRONG
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[11px] text-paper/50 font-mono">grid</span>
          {[1, 2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setGridSize(n as 1 | 2 | 4)}
              className={`px-2 py-0.5 text-xs font-mono rounded ${gridSize === n ? "bg-red text-paper" : "bg-paper/10 hover:bg-paper/20"}`}
            >
              {n}路
            </button>
          ))}
          <PiPHelp />
          <button
            onClick={onExit}
            className="px-3 py-1 bg-paper text-ink text-xs font-mono rounded"
          >
            退出 →
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-3 p-3">
        {/* 视频区 (左 70%) */}
        <div className={`grid ${gridClass} gap-2`}>
          {visibleSlots.map((slot, idx) => (
            <CinemaSlotView
              key={idx}
              slot={slot}
              host={host}
              aspectClass={aspectClass}
              onUpdate={(s) => updateSlot(idx, s)}
            />
          ))}
        </div>

        {/* Edge feed + 持仓 (右 30%) */}
        <aside className="space-y-2 max-h-[calc(100vh-100px)] overflow-y-auto pr-1">
          <div className="text-xs font-mono uppercase tracking-widest text-paper/50 mb-1">
            ▲ 锐 ({strong.length})
          </div>
          {strong.length === 0 && (
            <div className="bg-paper/5 rounded p-3 text-xs text-paper/50">
              当前无 STRONG · 点 [↻ 刷新] 重扫
            </div>
          )}
          {strong.map((r) => (
            <CinemaEdgeCard key={r.marketTicker} row={r} onBet={onBet} />
          ))}

          {watch.length > 0 && (
            <>
              <div className="text-xs font-mono uppercase tracking-widest text-paper/50 mt-3 mb-1">
                § 守 ({watch.length})
              </div>
              {watch.map((r) => (
                <CinemaEdgeCard key={r.marketTicker} row={r} onBet={onBet} />
              ))}
            </>
          )}

          {positions.length > 0 && (
            <>
              <div className="text-xs font-mono uppercase tracking-widest text-paper/50 mt-3 mb-1">
                ▣ 在仓 ({positions.length})
              </div>
              {positions.map((p) => (
                <div
                  key={p.ticker}
                  className="bg-paper/5 rounded p-2 text-[11px] font-mono"
                >
                  <div className="truncate" title={p.ticker}>
                    {p.ticker.slice(0, 32)}
                  </div>
                  <div className="flex justify-between text-paper/60 mt-0.5">
                    <span>
                      {p.side.toUpperCase()} {p.qty.toFixed(0)} @ {p.avg_cents}¢
                    </span>
                    <span className="tabular-nums">${p.exposure.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function CinemaSlotView({
  slot,
  host,
  aspectClass,
  onUpdate,
}: {
  slot: CinemaSlot;
  host: string;
  aspectClass: string;
  onUpdate: (s: CinemaSlot) => void;
}) {
  const preset = STREAM_PRESETS[slot.preset];
  const isCustom = slot.preset === "custom";
  const isYTtv = slot.preset.startsWith("ytv_");
  const isHltv = slot.preset === "hltv";
  const customEmbed = isCustom ? parseCustomUrl(slot.customUrl || "", host) : "";
  const embed = preset?.embed?.(host) || customEmbed;

  return (
    <div className="bg-paper/5 rounded overflow-hidden border border-paper/10">
      <div className="px-2 py-1 flex items-center gap-2 text-[11px]">
        <select
          value={slot.preset}
          onChange={(e) => onUpdate({ ...slot, preset: e.target.value })}
          className="bg-paper/10 text-paper text-[11px] font-mono px-1 py-0.5 rounded border-0 flex-1 min-w-0"
        >
          {Object.entries(STREAM_PRESETS).map(([k, v]) => (
            <option key={k} value={k} className="bg-ink">
              {v.emoji} {v.label}
            </option>
          ))}
        </select>
        {preset?.openUrl && (
          <button
            onClick={() => window.open(preset.openUrl, "_blank", "popup,width=900,height=600")}
            title="新窗口打开"
            className="text-paper/60 hover:text-paper"
          >
            ⤴
          </button>
        )}
      </div>
      <div className={`${aspectClass} bg-black relative`}>
        {isCustom && !customEmbed ? (
          <CustomUrlInput onSubmit={(u) => onUpdate({ ...slot, customUrl: u })} />
        ) : isYTtv || isHltv ? (
          <PopupOnly preset={preset!} />
        ) : embed ? (
          <iframe
            src={embed}
            className="w-full h-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            title={preset?.label}
          />
        ) : null}
      </div>
    </div>
  );
}

function CustomUrlInput({ onSubmit }: { onSubmit: (u: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-xs">
      <div className="text-paper/60 text-center">粘贴 YouTube/Twitch URL</div>
      <input
        type="text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="https://..."
        className="w-full max-w-xs px-2 py-1 bg-paper/10 border border-paper/20 rounded font-mono"
      />
      <button
        onClick={() => onSubmit(v)}
        className="px-3 py-1 bg-red text-paper text-xs rounded"
      >
        嵌入
      </button>
    </div>
  );
}

function PopupOnly({ preset }: { preset: typeof STREAM_PRESETS[string] }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-gradient-to-br from-paper/5 to-paper/15">
      <div className="text-4xl">{preset.emoji}</div>
      <div className="text-sm font-bold">{preset.label}</div>
      <div className="text-[11px] text-paper/60 max-w-xs leading-relaxed">
        Google/官方不允许 iframe · 点开新窗口
        <br />
        macOS Split View 拖到角落即可同屏
      </div>
      {preset.openUrl && (
        <button
          onClick={() => window.open(preset.openUrl, "_blank", "popup,width=900,height=600,top=50,left=50")}
          className="px-4 py-2 bg-red text-paper text-xs font-mono rounded mt-1"
        >
          打开 {preset.label} →
        </button>
      )}
    </div>
  );
}

function CinemaEdgeCard({
  row: r,
  onBet,
}: {
  row: EdgeRow;
  onBet: (row: EdgeRow, count: number) => void;
}) {
  const [count, setCount] = useState(() => {
    const k = r.kellySuggestStake;
    const p = r.buyPriceC;
    if (!k || !p) return 1;
    return Math.max(1, Math.round((k * 100) / p));
  });
  const isReverse = r.direction === "no";
  const cost = ((r.buyPriceC || 0) * count) / 100;
  return (
    <div className="bg-paper/8 rounded p-2.5 text-[11px]">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-bold text-sm">
          {r.team1} <span className="text-paper/40">vs</span> {r.team2}
        </div>
        <div
          className={`font-mono font-bold tabular-nums ${(r.myEdgePp || 0) >= 5 ? "text-red" : "text-amber"}`}
        >
          {r.myEdgePp?.toFixed(1)}pp
        </div>
      </div>
      <div className="text-paper/60 mt-0.5">
        {isReverse ? "反向 " : ""}
        买 {r.direction?.toUpperCase()} ({r.buySide}) @ {r.buyPriceC}¢
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
          className="w-14 px-1.5 py-1 bg-paper/10 border border-paper/20 rounded text-xs font-mono"
        />
        <span className="text-paper/60 text-[10px] tabular-nums">
          ${cost.toFixed(2)}
        </span>
        <button
          onClick={() => onBet(r, count)}
          className={`flex-1 px-2 py-1 rounded text-[11px] font-bold ${isReverse ? "bg-amber/30 hover:bg-amber/50" : "bg-red text-paper hover:bg-red-deep"}`}
        >
          {isReverse ? "◇ 反" : "▲ 押"}
        </button>
      </div>
    </div>
  );
}

function PiPHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="画中画提示"
        className="px-2 py-0.5 text-xs font-mono bg-paper/10 hover:bg-paper/20 rounded"
      >
        ◰ PiP
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-paper text-ink rounded-lg p-5 max-w-md text-sm space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-bold">◰ 画中画 (PiP) 怎么用</div>
            <div>突破 iframe 限制 · 任何视频都能浮窗</div>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>视频上 <b>右键</b> → "画中画"</li>
              <li>YouTube · 视频里右键两次 (第一次是 YouTube 菜单)</li>
              <li>YouTube TV · popup 打开后右键</li>
              <li>Twitch · 右键 → "画中画" (有时需点视频聚焦)</li>
              <li>macOS Safari · cmd+点 也行</li>
            </ol>
            <div className="text-xs text-ink-dim pt-2 border-t border-ink/10">
              替代方案 · macOS Rectangle / BetterTouchTool 强制 always-on-top
              <br />
              小技巧 · cmd+~ 同 app 切换 · cmd+tab 跨 app
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-2 px-3 py-1 bg-ink text-paper text-xs rounded"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}
