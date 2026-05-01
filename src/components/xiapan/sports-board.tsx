"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type SportRow = {
  sport: string;
  sportLabel: string;
  emoji: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subTitle: string;
  scheduledAt: string | null;
};

type SportTab = {
  key: string;
  label: string;
  emoji: string;
  count: number;
};

const DALLAS_TZ = "America/Chicago";
function fmtDallas(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: DALLAS_TZ,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(5, 16).replace("T", " ");
  }
}
function timeUntil(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) {
    const past = -ms;
    if (past < 3600_000) return `${Math.floor(past / 60_000)}min前`;
    if (past < 86400_000) return `${Math.floor(past / 3600_000)}h前`;
    return `${Math.floor(past / 86400_000)}d前`;
  }
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s 后`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}min 后`;
  if (ms < 86400_000) return `${(ms / 3600_000).toFixed(1)}h 后`;
  return `${Math.floor(ms / 86400_000)}d 后`;
}

export function SportsBoard() {
  const [data, setData] = useState<{ events: SportRow[]; sports: SportTab[] } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string>("all");
  const [hours, setHours] = useState(72);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/xiapan/all-events?hours=${hours}`)
      .then((r) => r.json())
      .then((d) => setData(d.ok ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false));
    // 60s 自刷
    const id = setInterval(() => {
      fetch(`/api/xiapan/all-events?hours=${hours}`)
        .then((r) => r.json())
        .then((d) => d.ok && setData(d))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [hours]);

  if (loading && !data) {
    return (
      <div className="bg-paper-bright border border-ink/10 rounded-md p-4 text-sm text-ink-dim font-mono">
        加载全赛事 events…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-paper-bright border border-ink/10 rounded-md p-4 text-sm text-red font-mono">
        全赛事接口失败 · 检查 Kalshi 连通
      </div>
    );
  }

  const filtered =
    activeSport === "all"
      ? data.events
      : data.events.filter((e) => e.sport === activeSport);
  const totalEvents = data.events.length;

  return (
    <section className="bg-paper-bright border border-ink/10 rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-ink/10 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">▤ Kalshi 全赛事</h2>
          <span className="text-[11px] text-ink-dim">
            未来 {hours}h · {totalEvents} 场 · 60s 自动刷
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-2 py-1 text-xs font-mono bg-paper border border-ink/20 rounded"
          >
            <option value={24}>24h</option>
            <option value={48}>48h</option>
            <option value={72}>72h</option>
            <option value={168}>1 周</option>
          </select>
        </div>
      </div>

      {/* Sport Tabs */}
      <div className="px-4 py-2 border-b border-ink/5 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveSport("all")}
          className={`text-[11px] font-mono px-2 py-1 rounded transition ${
            activeSport === "all"
              ? "bg-ink text-paper"
              : "bg-paper-deep/40 hover:bg-paper-deep"
          }`}
        >
          全部 ({totalEvents})
        </button>
        {data.sports
          .filter((s) => s.count > 0)
          .map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSport(s.key)}
              className={`text-[11px] font-mono px-2 py-1 rounded transition ${
                activeSport === s.key
                  ? "bg-ink text-paper"
                  : "bg-paper-deep/40 hover:bg-paper-deep"
              }`}
            >
              [{s.emoji}] {s.label} ({s.count})
            </button>
          ))}
      </div>

      {/* Events List */}
      <div className="max-h-[480px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-ink-dim text-center">
            这个赛事窗口内没比赛 · 调大时间窗试试
          </div>
        ) : (
          <ul className="divide-y divide-ink/5">
            <AnimatePresence>
              {filtered.slice(0, 100).map((e) => (
                <motion.li
                  key={e.eventTicker}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-4 py-2.5 hover:bg-paper-deep/20 transition"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-paper-deep rounded text-ink-dim">
                          [{e.emoji}] {e.sportLabel}
                        </span>
                        <span className="text-sm font-bold truncate">
                          {e.subTitle || e.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-dim font-mono mt-0.5 truncate">
                        {e.eventTicker}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono">
                        {fmtDallas(e.scheduledAt)}
                      </div>
                      <div className="text-[10px] text-ink-dim">
                        {timeUntil(e.scheduledAt)}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`https://kalshi.com/markets/${e.seriesTicker}/${e.eventTicker}`}
                    target="_blank"
                    rel="noopener"
                    className="mt-1 inline-block text-[10px] font-mono text-ink-dim hover:text-ink"
                  >
                    Kalshi 页面 →
                  </a>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
