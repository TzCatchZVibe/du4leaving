"use client";

import type { EdgeRow } from "@/lib/xiapan/types";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ProbTools } from "./prob-tools";
import { WatchGrid } from "./watch-grid";
import { NewsCard } from "./news-card";
import { CinemaMode } from "./cinema-mode";
import { SportsBoard } from "./sports-board";
import { MatchContext } from "./match-context";
import { SidebarMode } from "./sidebar-mode";
import { LiveMatchCard } from "./live-match";
import { Btc15mPanel } from "./btc-15m";
import { convexityScore, convictionScore, stopLossSuggest } from "@/lib/xiapan/economics";
import { TrueProbCard } from "./true-prob-card";
import { CryptoCorner } from "./crypto-corner";
import { WealthSection } from "./wealth-section";
import { BudgetSection } from "./budget-section";
import { GuideSection } from "./guide-section";
import {
  SettingsCard,
  loadSettings,
  saveSettings,
  exportToCsv,
  useHotkeys,
  type Settings,
} from "./settings-card";
import { motion, AnimatePresence } from "motion/react";
import {
  computeStrategy,
  checkCashoutTriggers,
  reinvestmentSplit,
} from "@/lib/xiapan/strategy";

// ────────────────── Types ──────────────────

type Position = {
  ticker: string;
  side: "yes" | "no";
  qty: number;
  exposure: number;
  avg_cents: number;
  realized_pnl: number;
  fees: number;
  // 富化
  title?: string;
  yes_sub?: string;
  no_sub?: string;
  current_yes_bid?: number;
  current_yes_ask?: number;
  current_no_bid?: number;
  current_no_ask?: number;
  mark_value?: number;
  unrealized_pnl?: number;
  unrealized_pct?: number;
  starts_at?: string;
  market_status?: string;
};

type Fill = {
  ticker: string;
  side: string;
  action: string;
  count: number;
  price_cents: number;
  fee: number;
  ts: string;
};

type Account = {
  ok: boolean;
  balance: number;
  payout: number;
  positions: Position[];
  totalExposure: number;
  totalPnl: number;
  totalUnrealized?: number;
  totalMarkValue?: number;
  restingOrders: number;
  fills: Fill[];
  error?: string;
};

// EdgeRow → 共享类型 src/lib/xiapan/types.ts (Sprint 4)

// ────────────────── Local persisted state ──────────────────

type LocalState = {
  startBalance: number; // 起始 bankroll
  todayDepositedUsd: number;
  weekDepositedUsd: number;
  monthDepositedUsd: number;
  weekStartBalance: number;
  monthStartBalance: number;
  todayKey: string; // YYYY-MM-DD (local time)
  weekKey: string;
  monthKey: string;
  monthStartDate: string; // YYYY-MM-DD · 用户起算日 · 用于 30d 月窗口
  pnlHistory: { date: string; pnl: number }[]; // last 30 days
  recentResults: ("win" | "loss")[]; // last 10
  // V3 v36.2 · 跨周期累计 · 不会被 resetMonthToToday 重置
  lifetimeDeposit: number;
  cycleHistory: { startDate: string; endDate: string; deposit: number; netPnl: number }[];
};

const TODAY_PROFIT_TARGET = 100;
const DAILY_DEPOSIT_CAP = 20;
const WEEKLY_DEPOSIT_CAP = 100;
const MONTHLY_DEPOSIT_CAP = 300;
const COOLDOWN_LOSS = 15;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function weekKeyOf(d = new Date()) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - x.getUTCDay());
  return x.toISOString().slice(0, 10);
}
function monthKeyOf(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

// 30 天滚动窗口 · 显示成 "M.D-M.D" · "起算日 + 30 天"
function monthWindowLabel(startISO: string): string {
  if (!startISO) return "4.28-5.28";
  try {
    const start = new Date(`${startISO}T00:00:00`);
    if (isNaN(start.getTime())) return "4.28-5.28";
    const end = new Date(start);
    end.setDate(start.getDate() + 30);
    const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
    return `${fmt(start)}-${fmt(end)}`;
  } catch {
    return "4.28-5.28";
  }
}

const DEFAULT_LOCAL: LocalState = {
  startBalance: 0,
  todayDepositedUsd: 0,
  weekDepositedUsd: 0,
  monthDepositedUsd: 0,
  weekStartBalance: 0,
  monthStartBalance: 0,
  todayKey: "",
  weekKey: "",
  monthKey: "",
  monthStartDate: "",
  pnlHistory: [],
  recentResults: [],
  lifetimeDeposit: 0,
  cycleHistory: [],
};

function loadLocal(): LocalState {
  if (typeof window === "undefined") return DEFAULT_LOCAL;
  try {
    const raw = window.localStorage.getItem("xiapan:local");
    if (!raw) throw new Error();
    const parsed = JSON.parse(raw) as LocalState;
    let dirty = false;
    // rotate keys
    const tk = todayKey();
    const wk = weekKeyOf();
    const mk = monthKeyOf();
    if (parsed.todayKey !== tk) {
      parsed.todayKey = tk;
      parsed.todayDepositedUsd = 0;
      dirty = true;
    }
    if (parsed.weekKey !== wk) {
      parsed.weekKey = wk;
      parsed.weekDepositedUsd = 0;
      parsed.weekStartBalance = 0;
      dirty = true;
    }
    if (parsed.monthKey !== mk) {
      parsed.monthKey = mk;
      parsed.monthDepositedUsd = 0;
      parsed.monthStartBalance = 0;
      dirty = true;
    }
    // 旧数据兜底 · 没有 monthStartDate 字段时回填为今天 · 当作 Day 1
    if (!parsed.monthStartDate) {
      parsed.monthStartDate = tk;
      dirty = true;
    }
    // v36.2 · 旧数据兜底 · 累计字段
    if (typeof parsed.lifetimeDeposit !== "number") {
      parsed.lifetimeDeposit = 0;
      dirty = true;
    }
    if (!Array.isArray(parsed.cycleHistory)) {
      parsed.cycleHistory = [];
      dirty = true;
    }
    if (dirty) {
      try {
        window.localStorage.setItem("xiapan:local", JSON.stringify(parsed));
      } catch {}
    }
    return parsed;
  } catch {
    const fresh: LocalState = {
      startBalance: 0,
      todayDepositedUsd: 0,
      weekDepositedUsd: 0,
      monthDepositedUsd: 0,
      weekStartBalance: 0,
      monthStartBalance: 0,
      todayKey: todayKey(),
      weekKey: weekKeyOf(),
      monthKey: monthKeyOf(),
      monthStartDate: todayKey(),
      pnlHistory: [],
      recentResults: [],
      lifetimeDeposit: 0,
      cycleHistory: [],
    };
    try {
      window.localStorage.setItem("xiapan:local", JSON.stringify(fresh));
    } catch {}
    return fresh;
  }
}

function saveLocal(s: LocalState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("xiapan:local", JSON.stringify(s));
}

// ────────────────── Math ──────────────────

function expectedScore(e1: number, e2: number) {
  return 1 / (1 + Math.pow(10, (e2 - e1) / 400));
}

function evPerDollar(modelP: number, costC: number) {
  const cost = costC / 100;
  if (cost <= 0 || cost >= 1) return 0;
  return modelP / cost - 1;
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) {
    const past = -ms;
    if (past < 60_000) return "刚开始";
    if (past < 3600_000) return `${Math.floor(past / 60_000)}min前`;
    return `${Math.floor(past / 3600_000)}h前`;
  }
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s 后`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}min 后`;
  return `${(ms / 3600_000).toFixed(1)}h 后`;
}

// 达拉斯时间 (America/Chicago) · 用户偏好
const DALLAS_TZ = "America/Chicago";
function formatDallas(iso: string): string {
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
function formatDallasTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: DALLAS_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

// ────────────────── Component ──────────────────

export function PlayDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [bankroll, setBankroll] = useState(50);
  const [hours, setHours] = useState(12);
  const [loading, setLoading] = useState(true);
  const [edgeLoading, setEdgeLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [betMsg, setBetMsg] = useState<string | null>(null);
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [edgeErr, setEdgeErr] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalState>(DEFAULT_LOCAL);
  const [watchMode, setWatchMode] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [sidebarMode, setSidebarMode] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    kellyMultiplier: 0.25,
    maxSinglePct: 0.125,
    hotkeysEnabled: true,
  });
  const [focusIdx, setFocusIdx] = useState(0);

  // 加载 localStorage (client-only, 避免 hydration mismatch)
  useEffect(() => {
    setLocal(loadLocal());
    setSettings(loadSettings());
  }, []);

  function updateSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
  }

  // hotkeys
  useHotkeys({
    enabled: settings.hotkeysEnabled,
    onNext: () => setFocusIdx((i) => Math.min(edges.length - 1, i + 1)),
    onPrev: () => setFocusIdx((i) => Math.max(0, i - 1)),
    onBuyYes: () => {
      const r = edges[focusIdx];
      if (r && r.direction === "yes") placeBet(r, 1);
    },
    onBuyNo: () => {
      const r = edges[focusIdx];
      if (r && r.direction === "no") placeBet(r, 1);
    },
    onCancel: () => {},
  });

  // 自动用 account 余额估 bankroll (首次)
  useEffect(() => {
    if (account && local.startBalance === 0 && account.balance > 0) {
      const next = { ...local, startBalance: account.balance };
      next.weekStartBalance = next.weekStartBalance || account.balance;
      next.monthStartBalance = next.monthStartBalance || account.balance;
      saveLocal(next);
      setLocal(next);
    }
  }, [account, local]);

  // bankroll = 当前余额 + exposure (净值)
  const netWorth = account ? account.balance + account.totalExposure : 0;
  const hasBaseline = local.startBalance > 0;
  const todayPnl = hasBaseline
    ? netWorth - local.startBalance - local.todayDepositedUsd
    : 0;
  const targetProgress = Math.max(0, Math.min(1, todayPnl / TODAY_PROFIT_TARGET));

  // 充值额度
  const depositLimit = useMemo(() => {
    if (todayPnl <= -COOLDOWN_LOSS)
      return { allowed: 0, reason: `今日亏损 ≥ $${COOLDOWN_LOSS} · 24h 冷静期` };
    if (local.weekDepositedUsd >= WEEKLY_DEPOSIT_CAP)
      return { allowed: 0, reason: `本周已充满 $${WEEKLY_DEPOSIT_CAP}` };
    if (local.monthDepositedUsd >= MONTHLY_DEPOSIT_CAP)
      return { allowed: 0, reason: `本月已充满 $${MONTHLY_DEPOSIT_CAP}` };
    if ((account?.balance ?? 0) >= 30)
      return { allowed: 0, reason: "余额 ≥ $30 · 不需补水" };
    if ((account?.balance ?? 0) >= 15)
      return {
        allowed: Math.min(10, WEEKLY_DEPOSIT_CAP - local.weekDepositedUsd),
        reason: "余额 $15-30 · 建议 $10",
      };
    return {
      allowed: Math.min(
        DAILY_DEPOSIT_CAP - local.todayDepositedUsd,
        WEEKLY_DEPOSIT_CAP - local.weekDepositedUsd
      ),
      reason: `可充至 $${DAILY_DEPOSIT_CAP - local.todayDepositedUsd}`,
    };
  }, [account, local, todayPnl]);

  const refreshAccount = useCallback(async () => {
    try {
      const r = await fetch("/api/xiapan/account", { cache: "no-store" });
      const d = (await r.json()) as Account;
      if (d.ok) {
        setAccount(d);
        setAccountErr(null);
      } else setAccountErr(d.error || "account 失败");
    } catch (e) {
      setAccountErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEdges = useCallback(async () => {
    setEdgeLoading(true);
    try {
      const r = await fetch(
        `/api/xiapan/live-edge?hours=${hours}&bankroll=${bankroll}`,
        { cache: "no-store" }
      );
      const d = await r.json();
      if (d.ok) {
        setEdges(d.rows || []);
        setEdgeErr(null);
      } else setEdgeErr(d.error || "edge 失败");
    } catch (e) {
      setEdgeErr(String(e));
    } finally {
      setEdgeLoading(false);
    }
  }, [hours, bankroll]);

  useEffect(() => {
    refreshAccount();
    refreshEdges();
    const t1 = setInterval(refreshAccount, 30_000);
    const t2 = setInterval(refreshEdges, 60_000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [refreshAccount, refreshEdges]);

  // 自动用余额作 bankroll
  useEffect(() => {
    if (account && account.balance + account.totalExposure > 0) {
      setBankroll(Math.max(20, account.balance + account.totalExposure));
    }
  }, [account]);

  // V3 S9 · ACH 入账 toast · 监测余额跳变 ≥ $5 → 提示
  // 余额持久化到 localStorage · 跨刷新对比 · 避免组件 mount 时误报
  useEffect(() => {
    if (!account || account.balance <= 0) return;
    const KEY = "xiapan:last-balance";
    let last: number | null = null;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw !== null) last = Number(raw);
    } catch {}
    const cur = account.balance;
    if (last !== null && cur - last >= 5) {
      const delta = cur - last;
      setBetMsg(
        `✓ 检测到余额入账 +$${delta.toFixed(2)} · 当前 $${cur.toFixed(2)} · 可能是 ACH 到账`
      );
      setTimeout(() => setBetMsg(null), 12_000);
    }
    try {
      window.localStorage.setItem(KEY, String(cur));
    } catch {}
  }, [account]);

  async function placeBet(
    row: Pick<
      EdgeRow,
      "team1" | "team2" | "direction" | "buySide" | "buyPriceC" | "marketTicker"
    >,
    count: number
  ) {
    if (
      !confirm(
        `确认下单?\n\n${row.team1} vs ${row.team2}\n买 ${row.direction?.toUpperCase()} (押 ${row.buySide}) @ ${row.buyPriceC}¢ × ${count}\n成本 $${(((row.buyPriceC || 0) * count) / 100).toFixed(2)}`
      )
    )
      return;
    setBetMsg("⏳ 下单中…");
    try {
      const r = await fetch("/api/xiapan/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: row.marketTicker,
          side: row.direction,
          count,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setBetMsg(
          `✓ 下单成功 · ${row.buySide} × ${count} @ ${d.price}¢ · 成本 $${d.cost_dollars.toFixed(2)}`
        );
        // V3 S7 · 复盘日记 · 下单后捕获理由 · 写到 localStorage xiapan:bet-log
        // 不阻塞 · 用 setTimeout 延后 · 用户可以选择填或不填 (取消 = 不记)
        setTimeout(() => {
          const reason = window.prompt(
            `刚下了 ${row.team1} vs ${row.team2} (押 ${row.buySide} × ${count})\n\n为啥下这单? 一句话 · 周末复盘会问你\n(留空 = 跳过)`,
            ""
          );
          if (reason && reason.trim()) {
            try {
              const key = "xiapan:bet-log";
              const existing = JSON.parse(
                window.localStorage.getItem(key) || "[]"
              ) as Array<{
                ts: string;
                ticker: string;
                reason: string;
                tag?: string;
              }>;
              const next = [
                {
                  ts: new Date().toISOString(),
                  ticker: row.marketTicker,
                  reason: reason.trim(),
                },
                ...existing,
              ].slice(0, 100);
              window.localStorage.setItem(key, JSON.stringify(next));
            } catch {}
          }
        }, 600);
        setTimeout(refreshAccount, 1500);
      } else setBetMsg(`❌ ${d.error}`);
    } catch (e) {
      setBetMsg(`❌ ${String(e)}`);
    }
    setTimeout(() => setBetMsg(null), 8000);
  }

  function logDeposit(amount: number) {
    const next = {
      ...local,
      todayDepositedUsd: local.todayDepositedUsd + amount,
      weekDepositedUsd: local.weekDepositedUsd + amount,
      monthDepositedUsd: local.monthDepositedUsd + amount,
      lifetimeDeposit: (local.lifetimeDeposit || 0) + amount,
    };
    setLocal(next);
    saveLocal(next);
  }

  // v36.2 · 历史一次性初始化 · 老用户告诉系统之前充过多少
  function setLifetimeDeposit(amount: number) {
    const next = { ...local, lifetimeDeposit: Math.max(0, amount) };
    setLocal(next);
    saveLocal(next);
  }

  function setStartBalance(bal: number) {
    const next = {
      ...local,
      startBalance: bal,
      weekStartBalance: bal,
      monthStartBalance: bal,
    };
    setLocal(next);
    saveLocal(next);
  }

  // 今天起算 · 把今天定为新月度第一天 · 重置基线 + 同步 PlanBanner
  function resetMonthToToday() {
    const today = todayKey();
    const baseline = netWorth || account?.balance || local.startBalance;
    const next: LocalState = {
      ...local,
      monthStartDate: today,
      startBalance: baseline,
      weekStartBalance: baseline,
      monthStartBalance: baseline,
      todayDepositedUsd: 0,
      weekDepositedUsd: 0,
      monthDepositedUsd: 0,
    };
    setLocal(next);
    saveLocal(next);
    // 同步 PlanBanner monthTarget 字符串
    try {
      const plan = loadPlan();
      plan.monthTarget = `${monthWindowLabel(today)} · 利润 $300-600 · 充值上限 $300 · 守纪律 30 天 · 不情绪盘`;
      plan.updatedAt = new Date().toISOString();
      savePlan(plan);
    } catch {}
  }

  const strong = edges.filter((e) => e.level === "strong");
  const watch = edges.filter((e) => e.level === "watch");
  const skip = edges.filter((e) => e.level === "skip");

  if (cinemaMode) {
    return (
      <CinemaMode
        edges={edges}
        positions={account?.positions || []}
        onBet={(r, c) => placeBet(r, c)}
        onExit={() => setCinemaMode(false)}
      />
    );
  }
  if (sidebarMode) {
    return (
      <SidebarMode
        account={account}
        edges={edges}
        onBet={(r, c) => placeBet(r, c)}
        onSell={async (p) => {
          if (!confirm(`卖出 ${p.qty.toFixed(0)} 张?`)) return;
          await fetch("/api/xiapan/bet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticker: p.ticker,
              side: p.side,
              count: Math.floor(p.qty),
              action: "sell",
            }),
          });
          setTimeout(refreshAccount, 1500);
        }}
        onExit={() => setSidebarMode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-cjk">
      <div className="max-w-[1500px] mx-auto px-4 py-4 lg:px-6 lg:py-5">
        <Header
          onRefresh={() => {
            refreshAccount();
            refreshEdges();
          }}
          watchMode={watchMode}
          toggleWatch={() => setWatchMode(!watchMode)}
          watchCount={account?.positions?.length || 0}
          cinemaMode={cinemaMode}
          toggleCinema={() => setCinemaMode(!cinemaMode)}
          toggleSidebar={() => setSidebarMode(true)}
        />
        {watchMode && (
          <div className="mb-4">
            <WatchGrid positions={account?.positions || []} />
          </div>
        )}
        {betMsg && (
          <div className="mb-3 px-4 py-2.5 rounded-md bg-paper-bright border border-ink/15 text-sm font-mono">
            {betMsg}
          </div>
        )}

        {/* 投资计划 · 永远可见 · 提醒纪律 */}
        <PlanBanner
          todayDeposited={local.todayDepositedUsd}
          weekDeposited={local.weekDepositedUsd}
          monthDeposited={local.monthDepositedUsd}
          monthStartDate={local.monthStartDate}
        />

        {/* V3 · 钱本位动线 · 金 → 势 → 额度 → 单 → 问 */}

        {/* 【钱】 财报 + PnL 曲线 + 月进度 */}
        {account && !accountErr && (
          <div className="mb-3">
            <WealthSection
              netWorth={netWorth}
              cash={account.balance}
              exposure={account.totalExposure}
              unrealized={account.totalUnrealized ?? 0}
              todayPnl={todayPnl}
              startBalance={local.startBalance || netWorth || 16}
              monthTarget={400}
              monthWindow={monthWindowLabel(local.monthStartDate)}
            />
          </div>
        )}

        {/* 【额度】 今天能花多少 + 充值/提现 + 抽水 */}
        {account && !accountErr && (
          <div className="mb-3">
            <BudgetSection
              cash={account.balance}
              todayDeposited={local.todayDepositedUsd}
              weekDeposited={local.weekDepositedUsd}
              monthDeposited={local.monthDepositedUsd}
              todayPnl={todayPnl}
              fills={account.fills || []}
              positions={(account.positions || []).map((p) => ({
                exposure: p.exposure,
                ticker: p.ticker,
              }))}
              pnlHistory={(() => {
                if (typeof window === "undefined") return [];
                try {
                  return JSON.parse(
                    window.localStorage.getItem("xiapan:pnl-history") || "[]"
                  );
                } catch {
                  return [];
                }
              })()}
              onDeposit={() =>
                window.open("https://kalshi.com/account/deposit", "_blank")
              }
              onCashout={() =>
                window.open("https://kalshi.com/account/withdraw", "_blank")
              }
            />
          </div>
        )}

        {/* 老的目标 + 账户行 (保留 · 但移到下方做参考) */}
        <DailyTargetBar
          todayPnl={todayPnl}
          netWorth={netWorth}
          startBalance={local.startBalance}
          todayDeposited={local.todayDepositedUsd}
          weekDeposited={local.weekDepositedUsd}
          depositLimit={depositLimit}
          monthWindow={monthWindowLabel(local.monthStartDate)}
          monthStartDate={local.monthStartDate}
          onResetMonth={resetMonthToToday}
        />

        <AccountStrip
          account={account}
          loading={loading}
          err={accountErr}
          netWorth={netWorth}
          todayPnl={todayPnl}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 mt-5">
          <div>
            <Controls
              bankroll={bankroll}
              hours={hours}
              setBankroll={setBankroll}
              setHours={setHours}
              onRefresh={refreshEdges}
              loading={edgeLoading}
            />

            {edgeErr && (
              <div className="mt-3 px-4 py-3 rounded-md bg-red/10 border border-red/30 text-red-deep text-sm">
                △ {edgeErr}
              </div>
            )}

            {/* 9 种 crypto 15min · 一站式 · 4s 刷 */}
            <section className="mt-4">
              <CryptoCorner />
            </section>

            {/* 实时比赛 · 故事性 · 8 sport · 8s 自刷 */}
            <section className="mt-4 bg-paper-bright border border-ink/10 rounded-md p-3.5">
              <LiveMatchCard />
            </section>

            {/* 【问】 5 种引导提问轮播 · V3 新加 */}
            <div className="mt-4">
              <GuideSection
                cash={account?.balance || 0}
                todayPnl={todayPnl}
                monthPct={
                  local.startBalance > 0
                    ? Math.max(0, (netWorth - local.startBalance) / 400)
                    : 0
                }
                edges={edges}
                positions={(account?.positions || []) as unknown as Parameters<typeof GuideSection>[0]["positions"]}
                fills={(account?.fills || []) as unknown as Parameters<typeof GuideSection>[0]["fills"]}
                liveStories={[]}
                onPlaceBet={(r, c) => placeBet(r, c)}
              />
            </div>

            {strong.length > 0 && (
              <Section title="★ 今晚值得下" hint="模型说 Kalshi 卖便宜了 · 流动性够 · 价差小">
                {strong.map((r) => (
                  <EdgeCard
                    key={r.marketTicker}
                    row={r}
                    bankroll={bankroll}
                    expanded={expanded === r.marketTicker}
                    onExpand={() =>
                      setExpanded(
                        expanded === r.marketTicker ? null : r.marketTicker
                      )
                    }
                    onBet={(c) => placeBet(r, c)}
                  />
                ))}
              </Section>
            )}
            {watch.length > 0 && (
              <Section title="☉ 再看一眼" hint="便宜没那么大 · 押也行不押也行 · 仓位减半">
                {watch.map((r) => (
                  <EdgeCard
                    key={r.marketTicker}
                    row={r}
                    bankroll={bankroll}
                    expanded={expanded === r.marketTicker}
                    onExpand={() =>
                      setExpanded(
                        expanded === r.marketTicker ? null : r.marketTicker
                      )
                    }
                    onBet={(c) => placeBet(r, c)}
                  />
                ))}
              </Section>
            )}

            {strong.length === 0 && watch.length === 0 && !edgeLoading && (
              <div className="mt-6 p-8 bg-paper-bright border border-ink/10 rounded-md text-center">
                <div className="text-3xl mb-2 font-mono">∅</div>
                <div className="text-lg font-bold">这会儿没啥便宜单</div>
                <div className="text-sm text-ink-dim mt-2">
                  把时间窗调大点 · 或者等下一波比赛 · 不急
                </div>
              </div>
            )}

            {skip.length > 0 && <SkipBucket rows={skip} />}
            <div className="mt-6">
              <SportsBoard />
            </div>
            <FillsRecent fills={account?.fills || []} />
          </div>

          <aside className="space-y-3">
            <PositionsCard
              positions={account?.positions || []}
              onSell={async (p) => {
                if (
                  !confirm(
                    `立刻卖出?\n\n${p.title || p.ticker}\n${p.qty.toFixed(0)} 张 ${p.side.toUpperCase()}\n现价能拿 $${(p.mark_value || 0).toFixed(2)}\n浮动 ${(p.unrealized_pnl || 0) >= 0 ? "+" : ""}$${(p.unrealized_pnl || 0).toFixed(2)}`
                  )
                )
                  return;
                setBetMsg("卖出中…");
                try {
                  const r = await fetch("/api/xiapan/bet", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ticker: p.ticker,
                      side: p.side,
                      count: Math.floor(p.qty),
                      action: "sell",
                    }),
                  });
                  const d = await r.json();
                  if (d.ok) {
                    setBetMsg(`✓ 已卖出 ${p.qty.toFixed(0)} 张 · 锁定`);
                    setTimeout(refreshAccount, 1500);
                  } else setBetMsg(`✕ 卖出失败 · ${d.error}`);
                } catch (e) {
                  setBetMsg(`✕ ${String(e)}`);
                }
                setTimeout(() => setBetMsg(null), 8000);
              }}
            />
            <StrategyCard
              dailyResults={local.pnlHistory.map((h) => ({
                date: h.date,
                pnl: h.pnl,
                turnover: 0,
                trades: 0,
                wins: 0,
                losses: 0,
              }))}
              recentResults={local.recentResults}
              currentBankroll={netWorth}
            />
            <AutoCashoutCard
              balance={account?.balance ?? 0}
              weekStart={local.weekStartBalance}
              monthStart={local.monthStartBalance}
            />
            <DepositCard
              limit={depositLimit}
              todayDeposited={local.todayDepositedUsd}
              weekDeposited={local.weekDepositedUsd}
              onLog={logDeposit}
            />
            <ReservoirCard />
            <BankrollSetup
              startBalance={local.startBalance}
              currentBalance={netWorth}
              onSet={setStartBalance}
            />
            <SettingsCard
              settings={settings}
              onChange={updateSettings}
              onExport={() =>
                exportToCsv({
                  positions: (account?.positions || []) as unknown as Array<
                    Record<string, unknown>
                  >,
                  fills: (account?.fills || []) as unknown as Array<
                    Record<string, unknown>
                  >,
                  edges: edges as unknown as Array<Record<string, unknown>>,
                })
              }
            />
            <NewsCard />
            <ProbTools />
            <LearnCard />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ────────────────── Header ──────────────────

function Header({
  onRefresh,
  watchMode,
  toggleWatch,
  watchCount,
  cinemaMode,
  toggleCinema,
  toggleSidebar,
}: {
  onRefresh: () => void;
  watchMode: boolean;
  toggleWatch: () => void;
  watchCount: number;
  cinemaMode: boolean;
  toggleCinema: () => void;
  toggleSidebar: () => void;
}) {
  return (
    <header className="mb-3 flex items-baseline justify-between flex-wrap gap-2">
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">DU4LEAVING</h1>
          <span className="text-xs font-mono text-ink-dim uppercase tracking-widest">
            在 kalshi 上 · 找点便宜单 · 看比赛 · 不急
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 w-12 bar-red" />
          <div className="h-1 w-3 bar-ink" />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={toggleSidebar}
          title="副屏模式 · 主屏看比赛 · 这屏一半资讯一半下注"
          className="text-xs font-mono px-3 py-1.5 border border-ink/20 rounded hover:bg-paper-deep transition-all hover:scale-105"
        >
          ▥ 副屏
        </button>
        <button
          onClick={toggleCinema}
          className="text-xs font-mono px-3 py-1.5 border border-ink/20 rounded hover:bg-paper-deep transition-all hover:scale-105"
        >
          ▣ 影院
        </button>
        <button
          onClick={() =>
            window.open(
              "/xiapan/overlay",
              "xiapan_overlay",
              "popup,width=400,height=520,top=100,right=100,alwaysOnTop"
            )
          }
          title="弹小窗口浮在 YouTube TV 上"
          className="text-xs font-mono px-3 py-1.5 border border-ink/20 rounded hover:bg-paper-deep transition-all hover:scale-105"
        >
          ◰ 浮窗
        </button>
        <button
          onClick={toggleWatch}
          className={`text-xs font-mono px-3 py-1.5 border rounded transition-all hover:scale-105 ${
            watchMode
              ? "bg-red text-paper border-red"
              : "border-ink/20 hover:bg-paper-deep"
          }`}
        >
          ▷ 観戦 {watchCount > 0 && `(${watchCount})`}
        </button>
        <button
          onClick={onRefresh}
          className="text-xs font-mono px-3 py-1.5 border border-ink/20 rounded hover:bg-paper-deep transition-all hover:scale-105"
        >
          ⟲ 刷
        </button>
      </div>
    </header>
  );
}

// ────────────────── Daily Target Bar ──────────────────

/* 小白化文案 替换:
 * "edge" → "便宜分" (我们觉得 Kalshi 价偏便宜的程度)
 * "Kelly" → "建议押多少"
 * "exposure" → "压在比赛里的钱"
 * "implied probability" → "市场觉得的胜率"
 */
function DailyTargetBar({
  todayPnl,
  netWorth,
  startBalance,
  todayDeposited,
  weekDeposited,
  depositLimit,
  monthWindow,
  monthStartDate,
  onResetMonth,
}: {
  todayPnl: number;
  netWorth: number;
  startBalance: number;
  todayDeposited: number;
  weekDeposited: number;
  depositLimit: { allowed: number; reason: string };
  monthWindow: string;
  monthStartDate: string;
  onResetMonth: () => void;
}) {
  const target = TODAY_PROFIT_TARGET;
  const hasBaseline = startBalance > 0;
  const pct = hasBaseline ? Math.max(0, Math.min(1, todayPnl / target)) : 0;
  const positive = todayPnl >= 0;
  const isToday = monthStartDate === todayKey();

  return (
    <div className="mb-3 bg-paper-bright border-2 border-ink/15 rounded-lg p-4 lg:p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-ink-dim flex items-center gap-2 flex-wrap">
            <span>这个月 ({monthWindow}) 想赚 $400</span>
            {isToday ? (
              <span className="text-[10px] font-bold text-sage normal-case tracking-normal">
                · Day 1 起算
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `把今天 (${todayKey()}) 设为新一轮 Day 1?\n\n会重置 · 起始 bankroll = 当前净值\n会重置 · 今/周/月已充值 = 0\n会同步 · 计划面板月度文案`
                    )
                  ) {
                    onResetMonth();
                  }
                }}
                className="text-[10px] font-mono normal-case tracking-normal px-1.5 py-0.5 bg-amber/20 hover:bg-amber/40 rounded text-ink"
                title="把今天设为新月度第一天 · 重置 startBalance 到当前净值"
              >
                ↺ 今天起算
              </button>
            )}
          </div>
          <div className="flex items-baseline gap-3 mt-0.5">
            {hasBaseline ? (
              <>
                <span
                  className={`text-3xl lg:text-4xl font-bold tabular-nums ${positive ? "text-sage" : "text-red"}`}
                >
                  {positive ? "+" : ""}${todayPnl.toFixed(2)}
                </span>
                <span className="text-sm text-ink-dim">
                  / ${target}  ·  {Math.round(pct * 100)}%
                </span>
              </>
            ) : (
              <span className="text-sm text-ink-dim">
                设起始本金后开始追踪 (右侧侧栏)
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="text-ink-dim">本月净值</div>
          <div className="text-lg font-mono tabular-nums">
            ${netWorth.toFixed(2)}
          </div>
          {startBalance > 0 && (
            <div className="text-ink-dim">起 ${startBalance.toFixed(0)}</div>
          )}
        </div>
      </div>
      <div className="h-2 bg-paper-deep rounded overflow-hidden">
        <div
          className={`h-full transition-all ${positive ? "bg-sage" : "bg-red"}`}
          style={{ width: `${Math.max(2, pct * 100)}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <span className="text-ink-dim">今日已充</span>{" "}
          <span className="font-bold">${todayDeposited.toFixed(0)}</span>
          <span className="text-ink-dim"> / $20</span>
        </div>
        <div>
          <span className="text-ink-dim">本周已充</span>{" "}
          <span className="font-bold">${weekDeposited.toFixed(0)}</span>
          <span className="text-ink-dim"> / $100</span>
        </div>
        <div>
          <span className="text-ink-dim">现在可充</span>{" "}
          <span
            className={`font-bold ${depositLimit.allowed === 0 ? "text-red" : "text-sage"}`}
          >
            ${depositLimit.allowed.toFixed(0)}
          </span>
        </div>
        <div className="text-ink-dim truncate" title={depositLimit.reason}>
          {depositLimit.reason}
        </div>
      </div>
    </div>
  );
}

// ────────────────── Account Strip ──────────────────

function AccountStrip({
  account,
  loading,
  err,
  netWorth,
  todayPnl,
}: {
  account: Account | null;
  loading: boolean;
  err: string | null;
  netWorth: number;
  todayPnl: number;
}) {
  if (err)
    return (
      <div className="p-4 bg-red/10 border border-red/30 rounded-md text-red-deep text-sm">
        △ {err}
        <div className="mt-1 text-xs text-ink-dim">
          .env.local 缺 KALSHI_API_KEY_ID + KALSHI_PRIVATE_KEY_FILE
        </div>
      </div>
    );
  if (loading || !account)
    return (
      <div className="p-6 bg-paper-bright border border-ink/10 rounded-md text-sm font-mono text-ink-dim">
        加载账户中…
      </div>
    );
  const upnl = account.totalUnrealized ?? 0;
  return (
    <div className="bg-paper-bright border border-ink/10 rounded-lg overflow-hidden">
      {/* 主三大卡 · 大字号 · Frida 美感 */}
      <div className="grid grid-cols-3 divide-x divide-ink/8">
        <PrimaryStat
          label="净值"
          value={`$${netWorth.toFixed(2)}`}
          hint="所有钱总和"
        />
        <PrimaryStat
          label="比赛中浮动"
          value={`${upnl >= 0 ? "+" : ""}$${upnl.toFixed(2)}`}
          hint="现在全卖能赚多少"
          color={upnl >= 0 ? "sage" : "red"}
        />
        <PrimaryStat
          label="现金"
          value={`$${account.balance.toFixed(2)}`}
          hint="马上能下单的"
        />
      </div>
      {/* secondary · 4 项小字 · 一行 */}
      <div className="border-t border-ink/8 px-5 py-2.5 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <SecondaryStat
          label="压在比赛里"
          value={`$${account.totalExposure.toFixed(2)} · ${account.positions.length} 单`}
        />
        <SecondaryStat
          label="今日盈亏"
          value={`${todayPnl >= 0 ? "+" : ""}$${todayPnl.toFixed(2)}`}
          color={todayPnl >= 0 ? "sage" : "red"}
        />
        <SecondaryStat label="挂单" value={`${account.restingOrders} 单`} />
        <SecondaryStat
          label="今日已充"
          value={`$${(typeof window !== "undefined" ? Number(window.localStorage?.getItem("xiapan:local") ? JSON.parse(window.localStorage.getItem("xiapan:local")!).todayDepositedUsd : 0) : 0)} / $20`}
        />
      </div>
    </div>
  );
}

function PrimaryStat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color?: "sage" | "red";
}) {
  const valColor =
    color === "sage" ? "text-sage" : color === "red" ? "text-red" : "text-ink";
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
        {label}
      </div>
      <div className={`text-2xl lg:text-3xl font-bold mt-1 tabular-nums ${valColor}`}>
        {value}
      </div>
      <div className="text-[10px] text-ink-dim mt-0.5">{hint}</div>
    </div>
  );
}

function SecondaryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "sage" | "red";
}) {
  const valColor =
    color === "sage" ? "text-sage" : color === "red" ? "text-red" : "text-ink-soft";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ink-dim">{label}</span>
      <span className={`font-bold tabular-nums ${valColor}`}>{value}</span>
    </div>
  );
}

function BigStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "red" | "amber" | "sage" | "ink";
}) {
  const bar = {
    red: "bg-red",
    amber: "bg-amber",
    sage: "bg-sage",
    ink: "bg-ink",
  }[accent];
  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md p-3 relative overflow-hidden">
      <div className={`absolute top-0 left-0 h-0.5 w-full ${bar}`} />
      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-dim">
        {label}
      </div>
      <div className="text-xl lg:text-2xl font-bold mt-0.5 tabular-nums">
        {value}
      </div>
      {hint && <div className="text-[10px] text-ink-dim">{hint}</div>}
    </div>
  );
}

// ────────────────── Controls ──────────────────

function Controls({
  bankroll,
  hours,
  setBankroll,
  setHours,
  onRefresh,
  loading,
}: {
  bankroll: number;
  hours: number;
  setBankroll: (n: number) => void;
  setHours: (n: number) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md p-3 flex flex-wrap items-center gap-3 mb-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-mono text-ink-dim">本金 $</span>
        <input
          type="number"
          value={bankroll}
          onChange={(e) => setBankroll(Number(e.target.value))}
          className="w-20 px-2 py-1 bg-paper border border-ink/20 rounded text-sm font-mono"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="font-mono text-ink-dim">未来</span>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="px-2 py-1 bg-paper border border-ink/20 rounded text-sm font-mono"
        >
          <option value={4}>4h</option>
          <option value={8}>8h</option>
          <option value={12}>12h</option>
          <option value={24}>24h</option>
          <option value={48}>48h</option>
        </select>
      </label>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="px-4 py-1.5 bg-ink text-paper text-sm font-mono rounded disabled:opacity-50 ml-auto"
      >
        {loading ? "扫描…" : "↻ 重扫"}
      </button>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-xs text-ink-dim">{hint}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

// ────────────────── Edge Card ──────────────────

function EdgeCard({
  row: r,
  bankroll,
  expanded,
  onExpand,
  onBet,
}: {
  row: EdgeRow;
  bankroll: number;
  expanded: boolean;
  onExpand: () => void;
  onBet: (count: number) => void;
}) {
  const [count, setCount] = useState(() => {
    const k = r.kellySuggestStake;
    const p = r.buyPriceC;
    if (!k || !p) return 1;
    return Math.max(1, Math.round((k * 100) / p));
  });
  const isStrong = r.level === "strong";
  const isReverse = r.edgePp != null && r.edgePp < 0;
  const dateStr = formatDallas(r.ts);
  const cost = ((r.buyPriceC || 0) * count) / 100;
  const maxWin = ((100 - (r.buyPriceC || 0)) * count) / 100;
  const myP =
    r.direction === "yes" ? r.modelPYes : 1 - r.modelPYes;
  const evPerStake = r.buyPriceC
    ? evPerDollar(myP, r.buyPriceC)
    : 0;
  const evDollar = cost * evPerStake;
  const limitAdvice =
    r.yesAskC != null && r.yesBidC != null && r.yesAskC - r.yesBidC >= 3
      ? `挂 ${(r.direction === "yes" ? r.yesAskC : 100 - r.yesAskC) - 1}¢ · spread 大,可以等深度`
      : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      whileHover={{ y: -2 }}
      className={`bg-paper-bright border rounded-md overflow-hidden ${
        isStrong ? "border-red/40 shadow-sm" : "border-ink/10"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight">{r.team1}</span>
              <span className="text-ink-dim text-base">vs</span>
              <span className="text-2xl font-bold tracking-tight">{r.team2}</span>
              <span className="ml-2 text-xs font-mono text-ink-dim">
                {dateStr} CT · {timeUntil(r.ts)}
              </span>
              {isReverse && (
                <span className="text-xs font-mono px-2 py-0.5 bg-amber/20 rounded">
                  和大盘对着干
                </span>
              )}
            </div>
            <div className="text-sm text-ink-soft">
              {r.name1} vs {r.name2}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-mono uppercase text-ink-dim">edge</div>
            <div
              className={`text-2xl font-bold tabular-nums ${
                (r.myEdgePp || 0) >= 5 ? "text-red" : "text-amber"
              }`}
            >
              {r.myEdgePp?.toFixed(1)}pp
            </div>
            <div className="text-[10px] text-ink-dim">
              EV {evPerStake >= 0 ? "+" : ""}
              {(evPerStake * 100).toFixed(1)}%
            </div>
            {/* 凸/凹 + 信心评分 (V4) */}
            {r.buyPriceC && (() => {
              const cvx = convexityScore(r.buyPriceC);
              const conv = convictionScore({
                edgePp: r.myEdgePp || 0,
                vol24Usd: r.vol24,
                spreadCents: r.spread,
                isReverse,
                modelBrier: 0.196,
              });
              return (
                <div className="mt-1 flex items-center gap-1 justify-end">
                  <span
                    className="text-[9px] font-mono px-1 rounded bg-paper-deep"
                    title={cvx.description}
                  >
                    {cvx.type === "convex" ? "凸" : cvx.type === "concave" ? "凹" : "中"}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1 rounded ${
                      conv.tier === "max"
                        ? "bg-red text-paper"
                        : conv.tier === "high"
                          ? "bg-sage/30"
                          : conv.tier === "med"
                            ? "bg-amber/30"
                            : "bg-paper-deep text-ink-dim"
                    }`}
                    title={conv.reasons.join(" · ")}
                  >
                    信心 {conv.score}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <Field label="模型胜率" value={`${Math.round(myP * 100)}%`} />
          <Field
            label="Kalshi 价"
            value={`${r.buyPriceC}¢`}
            hint="买这边的成本"
          />
          <Field
            label="vol24"
            value={`$${r.vol24.toFixed(0)}`}
            hint="24h 成交"
          />
          <Field
            label="spread"
            value={r.spread != null ? `${r.spread}¢` : "—"}
            hint="买卖价差"
          />
        </div>

        <div className="mt-3 p-3 bg-paper rounded border border-ink/10">
          <div className="text-base">
            {isReverse ? (
              <>
                △ 大盘押 <b>{r.yesSubTitle}</b> 赢 (Kalshi 给 {r.yesAskC}¢) · 但我们模型觉得他会输 ·{" "}
                <span className="font-bold text-amber">
                  和大盘对着干 · 押 {r.yesSubTitle} 输 (= 买 NO @ {r.buyPriceC}¢)
                </span>
              </>
            ) : (
              <>
                <b className="text-red">{r.buySide}</b> 这场比较稳 ·{" "}
                <span className="font-bold">
                  押他赢 @ {r.buyPriceC}¢
                </span>
              </>
            )}
          </div>
          {limitAdvice && (
            <div className="mt-1 text-xs text-amber">💡 {limitAdvice}</div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2.5 items-end">
          <div className="grid grid-cols-4 gap-2 items-end">
            <label className="block">
              <span className="text-[10px] text-ink-dim">数量</span>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                className="w-full mt-0.5 px-2 py-1.5 bg-paper border border-ink/20 rounded text-base font-mono tabular-nums"
              />
            </label>
            <div>
              <span className="text-[10px] text-ink-dim">成本</span>
              <div className="mt-0.5 px-2 py-1.5 bg-paper-deep rounded text-base font-mono tabular-nums">
                ${cost.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-ink-dim">赢拿</span>
              <div className="mt-0.5 px-2 py-1.5 bg-sage/10 text-sage rounded text-base font-mono tabular-nums font-bold">
                ${maxWin.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-ink-dim">EV (期望)</span>
              <div
                className={`mt-0.5 px-2 py-1.5 rounded text-base font-mono tabular-nums font-bold ${evDollar >= 0 ? "bg-amber/10 text-amber" : "bg-red/10 text-red"}`}
              >
                {evDollar >= 0 ? "+" : ""}${evDollar.toFixed(2)}
              </div>
            </div>
          </div>
          <button
            onClick={() => onBet(count)}
            className={`px-5 py-2.5 rounded text-sm font-bold ${isStrong ? "bg-red text-paper hover:bg-red-deep" : "bg-ink text-paper hover:bg-ink-soft"}`}
          >
            {isReverse ? "和大盘对着干 · 押" : "押"} {count} 张
          </button>
        </div>

        {r.kellySuggestStake != null && r.kellySuggestStake > 0 && (
          <div className="mt-1.5 text-[11px] text-ink-dim">
            算下来该押 ${r.kellySuggestStake.toFixed(2)} ≈{" "}
            {Math.max(
              1,
              Math.round(
                (r.kellySuggestStake * 100) / (r.buyPriceC || 1)
              )
            )}{" "}
            张 · 单笔 max 12.5% bankroll
          </div>
        )}

        <button
          onClick={onExpand}
          className="mt-2 text-[11px] font-mono text-ink-dim hover:text-ink"
        >
          {expanded ? "▴ 收起" : "▾ 怎么算的?"}
        </button>
        {expanded && (
          <div className="mt-2">
            <TrueProbCard
              marketP={r.impliedP || 0}
              modelP={myP}
              story={`基于 Elo ${r.elo1} vs ${r.elo2} · 历史 1235 场训练`}
              confidence={0.7}
              buySide={r.buySide}
              team1={r.team1}
              team2={r.team2}
            />
          </div>
        )}
        {expanded && <EdgeExplain row={r} myP={myP} />}
        {expanded && <MatchContext ticker={r.marketTicker} />}
      </div>
    </motion.div>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-paper rounded p-2 border border-ink/5">
      <div className="text-[10px] font-mono uppercase text-ink-dim" title={hint}>
        {label}
      </div>
      <div className="text-sm font-mono font-bold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function EdgeExplain({ row: r, myP }: { row: EdgeRow; myP: number }) {
  return (
    <div className="mt-2 p-3 bg-paper-deep/40 border-l-2 border-ink rounded-r text-xs space-y-2">
      <div>
        <span className="font-bold">① 模型 ·</span> Elo {r.elo1} vs {r.elo2} →{" "}
        {r.team1} 胜率{" "}
        <b>{Math.round(expectedScore(r.elo1, r.elo2) * 100)}%</b>
        {" · "}基于 1235 场历史训练 · Brier 0.196
      </div>
      <div>
        <span className="font-bold">② Kalshi ·</span> yes ({r.yesSubTitle}) ask{" "}
        {r.yesAskC}¢ → 市场觉得{" "}
        <b>{r.yesAskC}%</b> 概率赢 · 赢拿 $1.00 输全亏
      </div>
      <div>
        <span className="font-bold">③ 决策 ·</span> 模型 {Math.round(myP * 100)}%{" "}
        vs Kalshi {r.buyPriceC}% · 差 {Math.abs(r.edgePp || 0).toFixed(1)}pp
        →{" "}
        <b>
          买 {r.direction?.toUpperCase()} ({r.buySide})
        </b>
      </div>
      <div>
        <span className="font-bold">④ Kelly ·</span> {(r.kelly || 0) * 100 < 0.01
          ? "无信号"
          : `仓位 ${((r.kelly || 0) * 100).toFixed(2)}% bankroll · 0.25 缩放防过激`}
      </div>
      <MarketDeep ticker={r.marketTicker} />
      <div className="text-ink-dim font-mono">{r.marketTicker}</div>
    </div>
  );
}

// ────────── Market Deep · orderbook + sibling markets + recent trades ──────────

function MarketDeep({ ticker }: { ticker: string }) {
  type Sibling = {
    ticker: string;
    title?: string;
    yes_sub_title?: string;
    yes_bid_dollars?: string;
    yes_ask_dollars?: string;
    no_bid_dollars?: string;
    no_ask_dollars?: string;
    volume_24h_fp?: string;
    open_interest_fp?: string;
    status?: string;
  };
  type Deep = {
    ok: boolean;
    sibling_markets: Sibling[];
    orderbook: { yes: [number, number][]; no: [number, number][] } | null;
    trades: Array<{
      yes_price: number;
      count: number;
      created_time: string;
    }>;
  };
  const [data, setData] = useState<Deep | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch(`/api/xiapan/market/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ticker]);
  if (loading) return <div className="text-ink-dim text-[11px]">加载深度…</div>;
  if (!data || !data.ok) return null;
  const fp = (s?: string) => parseFloat(s || "0");
  const dolToC = (s?: string) => Math.round(fp(s) * 100);
  return (
    <div className="space-y-2">
      {data.orderbook && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-dim mb-1">
            订单簿深度 · 5档
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="bg-sage/10 rounded p-1.5">
              <div className="text-[10px] text-sage">YES bids (买 yes 排队)</div>
              {(data.orderbook.yes || [])
                .slice(-5)
                .reverse()
                .map(([p, s], i) => (
                  <div key={i} className="flex justify-between">
                    <span>{p}¢</span>
                    <span className="text-ink-dim">{s.toFixed(0)}</span>
                  </div>
                ))}
              {(data.orderbook.yes || []).length === 0 && (
                <div className="text-ink-dim">无</div>
              )}
            </div>
            <div className="bg-red/10 rounded p-1.5">
              <div className="text-[10px] text-red">NO bids (买 no 排队)</div>
              {(data.orderbook.no || [])
                .slice(-5)
                .reverse()
                .map(([p, s], i) => (
                  <div key={i} className="flex justify-between">
                    <span>{p}¢</span>
                    <span className="text-ink-dim">{s.toFixed(0)}</span>
                  </div>
                ))}
              {(data.orderbook.no || []).length === 0 && (
                <div className="text-ink-dim">无</div>
              )}
            </div>
          </div>
        </div>
      )}

      {data.sibling_markets && data.sibling_markets.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-dim mb-1">
            同 event 其他 markets · 套利空间
          </div>
          <ul className="space-y-1 font-mono text-[11px]">
            {data.sibling_markets.slice(0, 6).map((s) => (
              <li
                key={s.ticker}
                className="flex justify-between items-baseline gap-2 bg-paper-deep/30 rounded px-1.5 py-1"
              >
                <span className="truncate flex-1" title={s.title}>
                  {s.title?.slice(0, 50)}
                </span>
                <span className="tabular-nums">
                  {dolToC(s.yes_ask_dollars) || "—"}¢
                </span>
                <span className="text-ink-dim tabular-nums">
                  ${(fp(s.volume_24h_fp) || 0).toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.trades && data.trades.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-dim mb-1">
            最近成交 (实时)
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            {data.trades.slice(0, 8).map((t, i) => (
              <div
                key={i}
                className="flex justify-between bg-paper-deep/20 rounded px-1.5 py-0.5"
              >
                <span>{t.yes_price}¢</span>
                <span className="text-ink-dim">×{t.count.toFixed(0)}</span>
                <span className="text-ink-dim">
                  {(t.created_time || "").slice(11, 16)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────── Skip Bucket ──────────────────

function SkipBucket({ rows }: { rows: EdgeRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-mono text-ink-dim hover:text-ink"
      >
        {open ? "▴" : "▾"} {rows.length} 场不值得下 · 看看就好
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {rows.map((r) => (
            <div
              key={r.marketTicker}
              className="bg-paper-bright border border-ink/5 rounded p-2 text-xs"
            >
              <div className="font-mono">
                {r.team1} vs {r.team2}
              </div>
              <div className="text-ink-dim">
                edge {r.myEdgePp?.toFixed(1)}pp · vol {r.vol24.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────── Positions ──────────────────

function PositionsCard({
  positions,
  onSell,
}: {
  positions: Position[];
  onSell: (p: Position) => void;
}) {
  if (positions.length === 0)
    return (
      <SideCard title="正在压的单" hint="还没下">
        <div className="text-xs text-ink-dim">还没下单 · 去 ★ 区找一个</div>
      </SideCard>
    );
  return (
    <SideCard title={`正在压的单 (${positions.length})`} hint="实时报价 · 30s 刷">
      <ul className="space-y-3 text-xs">
        {positions.map((p) => {
          // 比赛标题: title 替代 ticker
          const matchTitle = p.title?.replace(
            /^Will (.+?) win the (.+?) (League of Legends|NBA|MLB|NFL|NHL|tennis|soccer|UFC).+$/i,
            "$2"
          );
          const compactTitle =
            matchTitle ||
            (p.title || "")
              .replace(/^Will /, "")
              .replace(/\?$/, "")
              .slice(0, 50);
          const winText = p.side === "yes" ? p.yes_sub : p.no_sub;
          const sellPriceC =
            p.side === "yes" ? p.current_yes_bid : p.current_no_bid;
          const upnl = p.unrealized_pnl ?? 0;
          const upct = p.unrealized_pct ?? 0;
          // 倒计时
          const startMs = p.starts_at
            ? new Date(p.starts_at).getTime() - Date.now()
            : 0;
          let countdown = "";
          if (p.starts_at) {
            if (startMs > 0) {
              if (startMs < 60_000) countdown = "马上开";
              else if (startMs < 3600_000) countdown = `${Math.floor(startMs / 60_000)}min 后开`;
              else if (startMs < 86400_000) countdown = `${(startMs / 3600_000).toFixed(1)}h 后开`;
              else countdown = `${Math.floor(startMs / 86400_000)}d 后开`;
            } else {
              countdown = "比赛已开 · 等结算";
            }
          }
          return (
            <li
              key={p.ticker}
              className="bg-paper rounded p-2.5 border border-ink/5"
            >
              {/* 比赛标题 */}
              <div className="font-bold leading-tight" title={p.title}>
                {compactTitle}
              </div>
              {/* 押的方向 */}
              <div className="mt-1 text-[11px] text-ink-soft">
                押 <b>{winText}</b> 赢 · {p.qty.toFixed(0)} 张 @ 入场 {p.avg_cents}¢
              </div>
              {/* 倒计时 */}
              {countdown && (
                <div className="text-[10px] text-ink-dim mt-0.5">
                  {countdown}{" "}
                  {p.starts_at && (
                    <span className="font-mono">
                      ·{" "}
                      {new Intl.DateTimeFormat("zh-CN", {
                        timeZone: "America/Chicago",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }).format(new Date(p.starts_at))}{" "}
                      CT
                    </span>
                  )}
                </div>
              )}

              {/* 当前盘口 */}
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-paper-deep/30 rounded px-1.5 py-1">
                  <div className="text-[9px] text-ink-dim uppercase">现价 (sell)</div>
                  <div className="font-bold tabular-nums">
                    {sellPriceC ?? "—"}¢
                  </div>
                </div>
                <div className="bg-paper-deep/30 rounded px-1.5 py-1">
                  <div className="text-[9px] text-ink-dim uppercase">vs 入场</div>
                  <div
                    className={`font-bold tabular-nums ${(sellPriceC ?? 0) >= p.avg_cents ? "text-sage" : "text-red"}`}
                  >
                    {sellPriceC != null
                      ? `${sellPriceC - p.avg_cents >= 0 ? "+" : ""}${sellPriceC - p.avg_cents}¢`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* 浮动盈亏 */}
              <div className="mt-2 flex items-baseline justify-between text-[11px]">
                <span className="text-ink-dim">现在卖能拿</span>
                <span className="font-mono tabular-nums">
                  ${(p.mark_value ?? p.exposure).toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-ink-dim">如果现在卖 · 浮动</span>
                <span
                  className={`font-mono font-bold tabular-nums ${upnl >= 0 ? "text-sage" : "text-red"}`}
                >
                  {upnl >= 0 ? "+" : ""}${upnl.toFixed(2)} ({upnl >= 0 ? "+" : ""}
                  {upct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-baseline justify-between text-[10px] text-ink-dim">
                <span>赢满拿 (赌赢)</span>
                <span className="font-mono">${p.qty.toFixed(2)}</span>
              </div>
              <div className="flex items-baseline justify-between text-[10px] text-ink-dim">
                <span>输全亏 (赌输)</span>
                <span className="font-mono">-${p.exposure.toFixed(2)}</span>
              </div>

              {/* Stop-loss 建议 (V4) */}
              {(() => {
                const sl = stopLossSuggest({
                  unrealizedPnl: upnl,
                  exposure: p.exposure,
                });
                if (sl.severity === "info") return null;
                return (
                  <div
                    className={`mt-1.5 px-2 py-1 rounded text-[10px] font-mono ${
                      sl.severity === "critical"
                        ? "bg-red text-paper"
                        : "bg-amber/20"
                    }`}
                  >
                    △ {sl.reason}
                  </div>
                );
              })()}

              {/* 操作按钮 */}
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => onSell(p)}
                  className="flex-1 px-2 py-1 bg-ink text-paper text-[11px] font-mono rounded hover:bg-ink-soft"
                >
                  立刻卖出锁定 (${(p.mark_value ?? 0).toFixed(2)})
                </button>
                <a
                  href={`https://kalshi.com/markets/${p.ticker}`}
                  target="_blank"
                  rel="noopener"
                  className="px-2 py-1 border border-ink/20 text-[11px] font-mono rounded hover:bg-paper-deep"
                  title="Kalshi 页面"
                >
                  ↗
                </a>
              </div>
              <div className="text-[9px] text-ink-dim font-mono mt-1.5 truncate">
                {p.ticker}
              </div>
            </li>
          );
        })}
      </ul>
    </SideCard>
  );
}

// ────────────────── Strategy Card · 自适应 ──────────────────

function StrategyCard({
  dailyResults,
  recentResults,
  currentBankroll,
}: {
  dailyResults: { date: string; pnl: number; turnover: number; trades: number; wins: number; losses: number }[];
  recentResults: ("win" | "loss")[];
  currentBankroll: number;
}) {
  const s = computeStrategy({
    dailyResults,
    recentTrades: recentResults,
    currentBankroll,
  });
  const tone =
    s.recommendedAction === "play"
      ? "text-sage"
      : s.recommendedAction === "play_reduced"
        ? "text-amber"
        : s.recommendedAction === "watch_only"
          ? "text-ink-dim"
          : "text-red";
  const label = {
    play: "🟢 满仓干",
    play_reduced: "🟡 减半干",
    watch_only: "👀 只观察",
    cooldown: "🔴 冷静期",
  }[s.recommendedAction];
  return (
    <SideCard title="◉ 今天怎么玩" hint="自动调 · 钱生钱">
      <div className={`text-base font-bold ${tone}`}>{label}</div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-paper rounded p-1.5 border border-ink/5">
          <div className="text-[10px] text-ink-dim">Kelly 系数</div>
          <div className="font-bold tabular-nums">
            {s.kellyMultiplier.toFixed(2)}
          </div>
        </div>
        <div className="bg-paper rounded p-1.5 border border-ink/5">
          <div className="text-[10px] text-ink-dim">edge 阈值</div>
          <div className="font-bold tabular-nums">≥{s.edgeThresholdStrong}pp</div>
        </div>
        <div className="bg-paper rounded p-1.5 border border-ink/5">
          <div className="text-[10px] text-ink-dim">单笔上限</div>
          <div className="font-bold tabular-nums">
            {(s.maxSinglePositionPctBankroll * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-paper rounded p-1.5 border border-ink/5">
          <div className="text-[10px] text-ink-dim">7d ROI</div>
          <div
            className={`font-bold tabular-nums ${s.sevenDayRoi >= 0 ? "text-sage" : "text-red"}`}
          >
            {s.sevenDayRoi >= 0 ? "+" : ""}
            {s.sevenDayRoi.toFixed(1)}%
          </div>
        </div>
      </div>
      <ul className="mt-2 text-[11px] text-ink-soft space-y-0.5">
        {s.reasoning.slice(0, 3).map((r, i) => (
          <li key={i}>· {r}</li>
        ))}
      </ul>
    </SideCard>
  );
}

// ────────────────── Auto Cashout Card ──────────────────

function AutoCashoutCard({
  balance,
  weekStart,
  monthStart,
}: {
  balance: number;
  weekStart: number;
  monthStart: number;
}) {
  const sigs = checkCashoutTriggers({
    balanceUsd: balance,
    weekStartBalanceUsd: weekStart,
    monthStartBalanceUsd: monthStart,
    workingFundCap: 200,
  });
  if (sigs.length === 0) {
    return (
      <SideCard title="◀ 钱什么时候拿" hint="赢钱才提">
        <div className="text-xs text-ink-dim">继续工作 · 复利再投</div>
      </SideCard>
    );
  }
  const top = sigs[0];
  const split = reinvestmentSplit(top.amount);
  return (
    <SideCard
      title="◀ 该把钱拿回来了"
      hint={top.priority === "high" ? "高优先" : "建议"}
    >
      <div className={`text-2xl font-bold tabular-nums ${top.priority === "high" ? "text-red" : "text-sage"}`}>
        ${top.amount}
      </div>
      <div className="text-xs text-ink-dim mb-2">{top.reason}</div>
      <div className="text-[11px] bg-paper rounded p-1.5 border border-ink/5 mb-2">
        ◆ 钱生钱拆分建议
        <div className="mt-0.5">
          复利留场 <b>${split.reinvest.toFixed(0)}</b> · cashout <b>${split.cashout.toFixed(0)}</b>
        </div>
      </div>
      <a
        href="https://kalshi.com/account/withdraw"
        target="_blank"
        rel="noopener"
        className={`inline-block text-xs font-mono px-3 py-1.5 rounded ${top.priority === "high" ? "bg-red text-paper" : "bg-ink text-paper"}`}
      >
        去 Kalshi 提现 →
      </a>
    </SideCard>
  );
}

// ────────────────── Deposit Card ──────────────────

function DepositCard({
  limit,
  todayDeposited,
  weekDeposited,
  onLog,
}: {
  limit: { allowed: number; reason: string };
  todayDeposited: number;
  weekDeposited: number;
  onLog: (n: number) => void;
}) {
  const [amount, setAmount] = useState(limit.allowed || 10);
  return (
    <SideCard title="▶ 今天还能充多少" hint={`今日 $${todayDeposited} · 本周 $${weekDeposited}`}>
      <div className="text-xl font-bold tabular-nums text-amber">
        最多 ${limit.allowed}
      </div>
      <div className="text-xs text-ink-dim mb-2">{limit.reason}</div>
      {limit.allowed > 0 && (
        <>
          <div className="flex gap-2 items-end mb-2">
            <input
              type="number"
              value={amount}
              max={limit.allowed}
              min={5}
              onChange={(e) => setAmount(Math.min(limit.allowed, Number(e.target.value)))}
              className="flex-1 px-2 py-1 bg-paper border border-ink/20 rounded text-sm font-mono"
            />
            <button
              onClick={() => onLog(amount)}
              className="px-3 py-1 bg-ink text-paper text-xs font-mono rounded"
            >
              已充
            </button>
          </div>
          <a
            href="https://kalshi.com/account/deposit"
            target="_blank"
            rel="noopener"
            className="block text-xs font-mono text-center px-3 py-1.5 bg-amber/20 rounded hover:bg-amber/30"
          >
            去 Kalshi 充值 →
          </a>
        </>
      )}
    </SideCard>
  );
}

// ────────────────── Reservoir Card (蓄水池) ──────────────────

function ReservoirCard() {
  return (
    <SideCard title="你的钱在哪" hint="3 层资金分隔">
      <pre className="text-[10px] leading-tight font-mono whitespace-pre">{`
主银行 (Wells/Chase)
   │ 月推 max $300
   ▼
Capital One Checking ◄─── cashout (赢)
   │ 日推 max $20
   ▼
Kalshi (战场)`}</pre>
      <div className="mt-2 text-[11px] text-ink-dim space-y-0.5">
        <div>· 一进 Kalshi 不再算钱 · 心理隔离</div>
        <div>· 每月只看 Capital One 净值</div>
        <div>· 输了不情绪追充 · 24h 冷静期</div>
      </div>
    </SideCard>
  );
}

// ────────────────── Bankroll Setup ──────────────────

function BankrollSetup({
  startBalance,
  currentBalance,
  onSet,
}: {
  startBalance: number;
  currentBalance: number;
  onSet: (n: number) => void;
}) {
  const [val, setVal] = useState(startBalance || currentBalance);
  if (startBalance > 0) {
    const diff = currentBalance - startBalance;
    const pct = startBalance > 0 ? (diff / startBalance) * 100 : 0;
    return (
      <SideCard title="累计赚了多少" hint={`起始 $${startBalance.toFixed(0)}`}>
        <div className="text-xl font-bold tabular-nums">
          {diff >= 0 ? "+" : ""}${diff.toFixed(2)}
        </div>
        <div
          className={`text-xs font-mono ${diff >= 0 ? "text-sage" : "text-red"}`}
        >
          {diff >= 0 ? "+" : ""}
          {pct.toFixed(1)}% ROI
        </div>
        <button
          onClick={() => {
            if (confirm("重置起始本金 = 当前余额?")) onSet(currentBalance);
          }}
          className="mt-2 text-[11px] text-ink-dim hover:text-ink underline"
        >
          重置基准
        </button>
      </SideCard>
    );
  }
  return (
    <SideCard title="先填本金" hint="算 ROI 用">
      <div className="flex gap-2 items-end">
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="flex-1 px-2 py-1 bg-paper border border-ink/20 rounded text-sm font-mono"
        />
        <button
          onClick={() => onSet(val)}
          className="px-3 py-1 bg-ink text-paper text-xs font-mono rounded"
        >
          设
        </button>
      </div>
    </SideCard>
  );
}

// ────────────────── Side Card Wrapper ──────────────────

function SideCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md p-3.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-sm font-bold">{title}</div>
        {hint && <div className="text-[10px] text-ink-dim">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

// ────────────────── Recent Fills ──────────────────

function FillsRecent({ fills }: { fills: Fill[] }) {
  if (fills.length === 0) return null;
  return (
    <div className="mt-4 bg-paper-bright border border-ink/10 rounded-md p-3.5">
      <div className="text-sm font-bold mb-2">最近成交</div>
      <ul className="space-y-1 text-[11px] font-mono">
        {fills.slice(0, 10).map((f, i) => {
          const t = formatDallas(f.ts || "");
          return (
            <li key={i} className="flex gap-2 items-baseline justify-between">
              <span className="text-ink-dim">{t}</span>
              <span className="w-14">
                {f.action.toUpperCase()} {f.side.toUpperCase()}
              </span>
              <span className="tabular-nums w-12 text-right">
                {f.count.toFixed(0)}
              </span>
              <span className="tabular-nums w-12 text-right">@ {f.price_cents}¢</span>
              <span className="text-ink-dim w-14 text-right">
                fee ${f.fee.toFixed(2)}
              </span>
              <span className="text-ink-dim flex-1 truncate text-right">
                {f.ticker}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ────────────────── Learn Card · 趣味简洁 ──────────────────

function LearnCard() {
  const [open, setOpen] = useState<string | null>("kalshi");
  const sections: { key: string; title: string; body: React.ReactNode }[] = [
    {
      key: "kalshi",
      title: "◎ Kalshi · 30 秒入门",
      body: (
        <div className="space-y-1.5">
          <p>
            <b>二元市场</b> · 每场只有 yes/no 两个结果
          </p>
          <p>
            yes @ 79¢ → yes 中, 拿 $1.00 (赚 21¢)
            <br />
            yes @ 79¢ → no 中, 全亏 $0.79
          </p>
          <p className="text-ink-dim">
            yes + no ≈ $1.00 · spread 越小越好
          </p>
        </div>
      ),
    },
    {
      key: "edge",
      title: "💡 edge · 一句话",
      body: (
        <div className="space-y-1.5">
          <p>
            <b>edge = 我的胜率 - 市场价</b>
          </p>
          <p>
            +5pp = 市场低估 5%, 我买便宜了 → 长期赚
          </p>
          <p className="text-ink-dim">
            类比 · 商场打折 25¢ 的可乐 (其实值 30¢)
          </p>
        </div>
      ),
    },
    {
      key: "kelly",
      title: "📐 Kelly · 押多少",
      body: (
        <div className="space-y-1.5">
          <p>
            <b>Kelly = 长期最大化资金的最优仓位</b>
          </p>
          <p>
            edge 大 → 押多 · edge 小 → 押少
          </p>
          <p className="text-ink-dim">
            类比 · 健身 60% 强度最有效 (不要满负荷)
          </p>
        </div>
      ),
    },
    {
      key: "lol",
      title: "🎮 LOL 五条",
      body: (
        <ul className="list-disc list-inside space-y-1">
          <li>BO3/BO5 比 BO1 模型准</li>
          <li>新 patch 第一周不确定 +20%</li>
          <li>主场 (LCK 本土) +1-3%</li>
          <li>国际赛 (MSI/Worlds) 最难</li>
          <li>选手出工 / 教练换 → Elo 不知道, 看 X</li>
        </ul>
      ),
    },
    {
      key: "nba",
      title: "🏀 NBA 五条",
      body: (
        <ul className="list-disc list-inside space-y-1">
          <li>主场胜率 ~58% · back-to-back 累 -3%</li>
          <li>末节方差大 (back-door cover)</li>
          <li>核心球员 doubtful → 立刻刷新</li>
          <li>常规赛盘比季后赛好打 (sharp 少)</li>
          <li>spread ±1.5 比 ML 平均 ROI 高</li>
        </ul>
      ),
    },
    {
      key: "mlb",
      title: "⚾ MLB 五条",
      body: (
        <ul className="list-disc list-inside space-y-1">
          <li>投手 (starter) 决定一切, 看 WAR</li>
          <li>Run line ±1.5 比 ML 稳</li>
          <li>风向 / 球场 / 天气大影响</li>
          <li>1st 5 innings = 投手对决, 隔离 bullpen</li>
          <li>同 division 第三次以上交手, 信息饱和</li>
        </ul>
      ),
    },
    {
      key: "tennis",
      title: "🎾 Tennis 三条",
      body: (
        <ul className="list-disc list-inside space-y-1">
          <li>BO3 (常规) vs BO5 (Slam) 数学差大</li>
          <li>草地/红土/硬地 风格偏好</li>
          <li>H2H 历史 + retirement 风险</li>
        </ul>
      ),
    },
    {
      key: "soccer",
      title: "⚽ Soccer 三条",
      body: (
        <ul className="list-disc list-inside space-y-1">
          <li>xG 比比分更准 · 看 understat.com</li>
          <li>主场优势 +5-7% (UCL 弱队反弹更大)</li>
          <li>抢分赛 (赛季末) 平局价值高</li>
        </ul>
      ),
    },
    {
      key: "rules",
      title: "🛡 纪律 · 防情绪盘",
      body: (
        <ol className="list-decimal list-inside space-y-1">
          <li>输了不加注 · 永远 Kelly</li>
          <li>vol24 &lt; $200 不下 (流动性陷阱)</li>
          <li>spread &gt; 5¢ 不下 (你被夹)</li>
          <li>反向单 ≤ 总仓 30% (大盘多陷阱)</li>
          <li>凌晨 2 点后停手 (生理决策力↓)</li>
          <li>连输 3 单 → 强制 30min 暂停</li>
          <li>每周日复盘哪类单赢得多</li>
        </ol>
      ),
    },
    {
      key: "pro",
      title: "▲ 进阶 · 套利",
      body: (
        <div className="space-y-1.5">
          <p>
            同一 LOL event 有 BO3 winner / Map count / 单局 winner
          </p>
          <p>
            如 · BO3 winner T1 0.79 + Map 2-0 T1 0.55 + Map 2-1 T1 0.24
            <br />
            → 0.55 + 0.24 = 0.79 (理论一致)
          </p>
          <p className="text-ink-dim">
            偶尔不一致 = 套利空间 · 同时下两边锁定
          </p>
        </div>
      ),
    },
  ];
  return (
    <div className="bg-paper-bright border border-ink/10 rounded-md overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-ink/10">
        <div className="text-sm font-bold">📚 学习中心</div>
        <div className="text-[10px] text-ink-dim mt-0.5">越玩越懂 · 点开看</div>
      </div>
      <ul className="divide-y divide-ink/5">
        {sections.map((s) => (
          <li key={s.key}>
            <button
              onClick={() => setOpen(open === s.key ? null : s.key)}
              className="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-paper-deep/30"
            >
              <span>{s.title}</span>
              <span className="text-ink-dim">{open === s.key ? "−" : "+"}</span>
            </button>
            {open === s.key && (
              <div className="px-3.5 pb-2.5 text-[11px] leading-relaxed text-ink-soft">
                {s.body}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ────────────────── PlanBanner · 永远可见 · 多颗粒度 ──────────────────

type Plan = {
  updatedAt: string;
  yearTarget: string;
  quarterMilestone: string;
  monthTarget: string;
  weekTask: string;
  todayAction: string;
  rules: string;
};

function buildDefaultPlan(monthStartDate?: string): Plan {
  const startISO = monthStartDate || todayKey();
  return {
    updatedAt: new Date().toISOString(),
    yearTarget:
      "12 个月 · bankroll $200 → $1500 · 累计 cashout ≥ $800 · ROI 复利 30%/月",
    quarterMilestone:
      "Q2 (4-6 月) · bankroll 目标 $400 · 第 1 次 cashout ≥ $100 · 单赛季完整跑通",
    monthTarget: `${monthWindowLabel(startISO)} · 利润 $300-600 · 充值上限 $300 · 守纪律 30 天 · 不情绪盘`,
    weekTask:
      "本周 · LCK/LEC 季后赛重点 · 反向单 ≤ 总仓 30% · 周末 cashout 50% 利润",
    todayAction:
      "今天 · 跑 ▲ 锐 · Kelly ≤ 12.5% · 输 $15 强制 24h 冷静期 · 02:00 后停手",
    rules:
      "1. 单笔 max 12.5% bankroll  ·  2. 输 $15 冷静 24h  ·  3. vol24<$200 不下  ·  4. spread>5¢ 不下  ·  5. 反向单 ≤ 30% 总仓  ·  6. 凌晨 2 点后停手  ·  7. 周日复盘",
  };
}

const DEFAULT_PLAN: Plan = buildDefaultPlan();

const PLAN_KEY = "xiapan:plan";

function loadPlan(monthStartDate?: string): Plan {
  const fallback = buildDefaultPlan(monthStartDate);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function savePlan(p: Plan) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAN_KEY, JSON.stringify(p));
}

function PlanBanner({
  todayDeposited,
  weekDeposited,
  monthDeposited,
  monthStartDate,
}: {
  todayDeposited: number;
  weekDeposited: number;
  monthDeposited: number;
  monthStartDate?: string;
}) {
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPlan(loadPlan(monthStartDate));
    setMounted(true);
  }, [monthStartDate]);

  const updatedAgo = (() => {
    if (!mounted) return "";
    if (!plan.updatedAt) return "未更新";
    const ms = Date.now() - new Date(plan.updatedAt).getTime();
    if (ms < 60_000) return "刚更新";
    if (ms < 3600_000) return `${Math.floor(ms / 60_000)}min 前更`;
    if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h 前更`;
    return `${Math.floor(ms / 86400_000)}d 前更`;
  })();

  function update<K extends keyof Plan>(field: K, val: Plan[K]) {
    const next = { ...plan, [field]: val, updatedAt: new Date().toISOString() };
    setPlan(next);
    savePlan(next);
  }

  return (
    <motion.div
      layout
      className="mb-3 bg-paper-bright border-2 border-ink rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 flex items-center justify-between gap-2 hover:bg-paper-deep/30 transition"
      >
        <div className="flex items-baseline gap-3 min-w-0 flex-1">
          <span className="text-xs font-mono uppercase tracking-widest text-ink-dim shrink-0">
            ▣ 投资计划
          </span>
          <span className="text-xs text-ink-soft truncate text-left">
            {open ? "" : plan.todayAction}
          </span>
        </div>
        <span className="text-[10px] font-mono text-ink-dim shrink-0">
          {updatedAgo} · {open ? "▴ 折叠" : "▾ 展开"}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-ink/10"
          >
            <div className="p-4 space-y-2 text-sm">
              <PlanRow
                level="L1"
                label="年度"
                value={plan.yearTarget}
                editing={editing}
                onChange={(v) => update("yearTarget", v)}
              />
              <PlanRow
                level="L2"
                label="季度"
                value={plan.quarterMilestone}
                editing={editing}
                onChange={(v) => update("quarterMilestone", v)}
              />
              <PlanRow
                level="L3"
                label="月度"
                value={plan.monthTarget}
                editing={editing}
                onChange={(v) => update("monthTarget", v)}
                progress={`本月已充 $${monthDeposited} / $300`}
              />
              <PlanRow
                level="L4"
                label="本周"
                value={plan.weekTask}
                editing={editing}
                onChange={(v) => update("weekTask", v)}
                progress={`本周已充 $${weekDeposited} / $100`}
              />
              <PlanRow
                level="L5"
                label="今日"
                value={plan.todayAction}
                editing={editing}
                onChange={(v) => update("todayAction", v)}
                progress={`今日已充 $${todayDeposited} / $20`}
                accent
              />
              <PlanRow
                level="‖"
                label="纪律"
                value={plan.rules}
                editing={editing}
                onChange={(v) => update("rules", v)}
                multiline
              />

              <div className="pt-2 flex items-center justify-between gap-2 text-xs border-t border-ink/5">
                <button
                  onClick={() => setEditing(!editing)}
                  className="px-3 py-1 bg-ink text-paper font-mono rounded hover:scale-105 transition"
                >
                  {editing ? "✓ 完成编辑" : "✎ 编辑计划"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("重置为默认计划?")) {
                      setPlan(DEFAULT_PLAN);
                      savePlan(DEFAULT_PLAN);
                    }
                  }}
                  className="text-ink-dim font-mono hover:text-ink"
                >
                  重置默认
                </button>
                <span className="text-[10px] text-ink-dim font-mono">
                  自动存 · localStorage · {updatedAgo}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PlanRow({
  level,
  label,
  value,
  editing,
  onChange,
  progress,
  accent,
  multiline,
}: {
  level: string;
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  progress?: string;
  accent?: boolean;
  multiline?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[3rem_3rem_1fr] items-start gap-2 ${accent ? "bg-paper-deep/30 -mx-4 px-4 py-1.5 rounded" : ""}`}
    >
      <div className="text-[10px] font-mono text-ink-dim pt-0.5">{level}</div>
      <div className="text-xs font-bold pt-0.5">{label}</div>
      <div>
        {editing ? (
          multiline ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              className="w-full px-2 py-1 bg-paper border border-ink/20 rounded text-xs font-mono leading-relaxed"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-2 py-1 bg-paper border border-ink/20 rounded text-xs"
            />
          )
        ) : (
          <div className="text-xs leading-relaxed text-ink-soft">{value}</div>
        )}
        {progress && (
          <div className="text-[10px] text-ink-dim font-mono mt-0.5">
            {progress}
          </div>
        )}
      </div>
    </div>
  );
}
