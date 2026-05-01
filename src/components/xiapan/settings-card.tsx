"use client";

import { useEffect, useState } from "react";

export type Settings = {
  kellyMultiplier: number; // 0.10 / 0.20 / 0.25 / 0.40
  maxSinglePct: number; // 0.05 / 0.10 / 0.125 / 0.20
  hotkeysEnabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  kellyMultiplier: 0.25,
  maxSinglePct: 0.125,
  hotkeysEnabled: true,
};

const KEY = "xiapan:settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

const KELLY_OPTIONS = [
  { v: 0.1, label: "保守 0.1", hint: "Domer 风险厌恶" },
  { v: 0.2, label: "稳 0.2", hint: "推荐起步" },
  { v: 0.25, label: "标准 0.25", hint: "教科书" },
  { v: 0.4, label: "激进 0.4", hint: "Domer 满仓" },
];
const MAX_SINGLE_OPTIONS = [
  { v: 0.05, label: "5%" },
  { v: 0.075, label: "7.5%" },
  { v: 0.1, label: "10%" },
  { v: 0.125, label: "12.5%" },
  { v: 0.2, label: "20% 激进" },
];

export function SettingsCard({
  settings,
  onChange,
  onExport,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onExport: () => void;
}) {
  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md p-3.5 space-y-3">
      <div>
        <div className="text-sm font-bold">⚙ 个人设置</div>
        <div className="text-[10px] text-ink-dim mt-0.5">
          自动存 · 影响下单仓位
        </div>
      </div>

      <div>
        <div className="text-[11px] text-ink-dim mb-1.5">
          Kelly 系数 · 多激进
        </div>
        <div className="grid grid-cols-2 gap-1">
          {KELLY_OPTIONS.map((o) => (
            <button
              key={o.v}
              onClick={() => onChange({ ...settings, kellyMultiplier: o.v })}
              className={`text-[11px] font-mono px-2 py-1 rounded transition ${
                settings.kellyMultiplier === o.v
                  ? "bg-ink text-paper"
                  : "bg-paper-deep/40 hover:bg-paper-deep"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-ink-dim mt-1">
          当前 {settings.kellyMultiplier} ·{" "}
          {KELLY_OPTIONS.find((o) => o.v === settings.kellyMultiplier)?.hint}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-ink-dim mb-1.5">单笔上限 % bankroll</div>
        <div className="grid grid-cols-3 gap-1">
          {MAX_SINGLE_OPTIONS.map((o) => (
            <button
              key={o.v}
              onClick={() => onChange({ ...settings, maxSinglePct: o.v })}
              className={`text-[10px] font-mono px-2 py-1 rounded transition ${
                settings.maxSinglePct === o.v
                  ? "bg-ink text-paper"
                  : "bg-paper-deep/40 hover:bg-paper-deep"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-ink/5">
        <label className="text-[11px] text-ink-soft flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.hotkeysEnabled}
            onChange={(e) =>
              onChange({ ...settings, hotkeysEnabled: e.target.checked })
            }
          />
          快捷键 (J/K/B/N/Esc)
        </label>
        <button
          onClick={onExport}
          className="text-[11px] font-mono px-2.5 py-1 bg-ink text-paper rounded hover:scale-105 transition"
        >
          ↓ 导出 CSV
        </button>
      </div>

      {settings.hotkeysEnabled && (
        <div className="text-[9px] font-mono text-ink-dim leading-relaxed bg-paper rounded p-2">
          J/K · 切 edge 卡 · B · 押 yes · N · 押 no · Esc · 取消
        </div>
      )}
    </div>
  );
}

// CSV utility
export function exportToCsv(opts: {
  positions: Array<Record<string, unknown>>;
  fills: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}) {
  const sections = [
    { name: "positions", rows: opts.positions },
    { name: "fills", rows: opts.fills },
    { name: "edges", rows: opts.edges },
  ];
  const lines: string[] = [];
  for (const s of sections) {
    lines.push(`### ${s.name}`);
    if (s.rows.length === 0) {
      lines.push("(empty)");
      lines.push("");
      continue;
    }
    const cols = Object.keys(s.rows[0]);
    lines.push(cols.join(","));
    for (const r of s.rows) {
      lines.push(
        cols
          .map((c) => {
            const v = r[c];
            const str =
              v == null
                ? ""
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : String(v);
            return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
          })
          .join(",")
      );
    }
    lines.push("");
  }
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `du4leaving-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// hotkey hook
export function useHotkeys(opts: {
  enabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  onBuyYes: () => void;
  onBuyNo: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!opts.enabled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "j": opts.onNext(); break;
        case "k": opts.onPrev(); break;
        case "b": opts.onBuyYes(); break;
        case "n": opts.onBuyNo(); break;
        case "Escape": opts.onCancel(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [opts]);
}
