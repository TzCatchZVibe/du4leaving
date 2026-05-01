// 虾盘 · Kalshi API client (read-only · 无需 auth)
//
// 关键发现 · LOL 比赛在 /events?series_ticker=KXLOLGAME 下
// 不在 /markets?status=open 直接出现 (markets 嵌套在 events 内部)
//
// docs · https://trading-api.readme.io/reference/getevents

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

// LOL 相关 series tickers (经过探测确认)
export const LOL_SERIES_TICKERS = [
  "KXLOLGAME", // 主战场 · BO 单场胜负 + game-by-game
];

// 全 Kalshi 赛事 series · 按 sport 分类
// 探测过的 prefix · 后续按需补
export const SPORT_SERIES: Record<
  string,
  { label: string; emoji: string; tickers: string[] }
> = {
  lol: {
    label: "LOL", emoji: "電",
    tickers: ["KXLOLGAME"],
  },
  nba: {
    label: "NBA", emoji: "篮",
    tickers: ["KXNBAGAME", "KXNBASERIES", "KXNBAGAMESPREAD", "KXNBAGAMETOTAL"],
  },
  mlb: {
    label: "MLB", emoji: "棒",
    tickers: ["KXMLBGAME", "KXMLBSERIES", "KXMLBGAMERUNLINE", "KXMLBGAMETOTAL"],
  },
  nfl: {
    label: "NFL", emoji: "球",
    tickers: ["KXNFLGAME", "KXNFLSPREAD", "KXNFLTOTAL"],
  },
  nhl: {
    label: "NHL", emoji: "冰",
    tickers: ["KXNHLGAME", "KXNHLSERIES", "KXNHLPUCKLINE"],
  },
  tennis: {
    label: "Tennis", emoji: "网",
    tickers: ["KXITFWMATCH", "KXITFMMATCH", "KXATPMATCH", "KXWTAMATCH"],
  },
  soccer: {
    label: "Soccer", emoji: "足",
    tickers: ["KXEPLGAME", "KXUCLGAME", "KXMLSGAME", "KXLALIGAGAME", "KXSERIEAGAME"],
  },
  cs: {
    label: "CS2", emoji: "枪",
    tickers: ["KXCSMATCH", "KXCS2MATCH"],
  },
  val: {
    label: "Valorant", emoji: "靶",
    tickers: ["KXVALMATCH", "KXVALORANTMATCH"],
  },
  dota: {
    label: "Dota 2", emoji: "刀",
    tickers: ["KXDOTAMATCH", "KXDOTA2MATCH"],
  },
  ufc: {
    label: "UFC/Boxing", emoji: "拳",
    tickers: ["KXUFCFIGHT", "KXBOXMATCH"],
  },
  golf: {
    label: "Golf", emoji: "杆",
    tickers: ["KXPGAEVENT", "KXLIVGOLF"],
  },
};

export type AllEventRow = {
  sport: string;
  sportLabel: string;
  emoji: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subTitle: string;
  scheduledAt: string | null;
};

// 全 Kalshi 赛事 events (并发拉 · 防 429 · 限制每 series 1 页)
const _allEventsCache: { ts: number; rows: AllEventRow[] } = {
  ts: 0,
  rows: [],
};
const ALL_EVENTS_TTL = 120_000; // 2min cache

// event 详情 cache (拿 occurrence_datetime · 真实开赛时间)
const _eventDetailTimeCache = new Map<string, { ts: number; startUtc: string | null }>();
const DETAIL_TTL = 600_000; // 10min cache

async function fetchEventStartTime(eventTicker: string): Promise<string | null> {
  const cached = _eventDetailTimeCache.get(eventTicker);
  if (cached && Date.now() - cached.ts < DETAIL_TTL) {
    return cached.startUtc;
  }
  try {
    const data = await callKalshi<{
      markets?: Array<{
        expected_expiration_time?: string;
        occurrence_datetime?: string;
      }>;
    }>(`/events/${eventTicker}`);
    const m = data.markets?.[0];
    const startUtc =
      m?.expected_expiration_time || m?.occurrence_datetime || null;
    _eventDetailTimeCache.set(eventTicker, { ts: Date.now(), startUtc });
    return startUtc;
  } catch {
    return null;
  }
}

export async function fetchAllSportsEvents(
  sports?: string[]
): Promise<AllEventRow[]> {
  if (
    Date.now() - _allEventsCache.ts < ALL_EVENTS_TTL &&
    _allEventsCache.rows.length > 0
  ) {
    if (!sports?.length) return _allEventsCache.rows;
    return _allEventsCache.rows.filter((r) => sports.includes(r.sport));
  }
  const targetSports = sports?.length
    ? Object.keys(SPORT_SERIES).filter((s) => sports.includes(s))
    : Object.keys(SPORT_SERIES);

  const out: AllEventRow[] = [];
  // 串行拉 · 防 429 · 每 series 200ms 间隔
  for (const sport of targetSports) {
    const config = SPORT_SERIES[sport];
    for (const ticker of config.tickers) {
      try {
        const q = new URLSearchParams({
          series_ticker: ticker,
          limit: "100",
        });
        const data = await callKalshi<{ events?: KalshiEvent[] }>(
          `/events?${q.toString()}`
        );
        for (const ev of data.events || []) {
          const t = parseEventTickerTime(ev.event_ticker);
          out.push({
            sport,
            sportLabel: config.label,
            emoji: config.emoji,
            eventTicker: ev.event_ticker,
            seriesTicker: ticker,
            title: ev.title || "",
            subTitle: ev.sub_title || "",
            scheduledAt: t ? t.toISOString() : null,
          });
        }
        await new Promise((r) => setTimeout(r, 150));
      } catch {
        // 单 series 失败不阻塞
      }
    }
  }
  // 富化 · 拉每个 event 的真实开赛时间 (前 60 个 · 节流 100ms)
  // ticker 解析时间不准 · occurrence_datetime 才是真实
  const enrichTargets = out.slice(0, 60);
  for (const row of enrichTargets) {
    const realStart = await fetchEventStartTime(row.eventTicker);
    if (realStart) row.scheduledAt = realStart;
    await new Promise((r) => setTimeout(r, 100));
  }

  // 按时间排序 · 未来事件优先
  const now = Date.now();
  out.sort((a, b) => {
    const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
    const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
    const fa = ta < now ? Infinity : ta;
    const fb = tb < now ? Infinity : tb;
    return fa - fb;
  });
  _allEventsCache.ts = Date.now();
  _allEventsCache.rows = out;
  if (sports?.length) return out.filter((r) => sports.includes(r.sport));
  return out;
}

// 通用 ticker 时间解析 (LOL pattern · NBA / MLB 用 different pattern)
// 返回 null = 没识别出
export function parseEventTickerTime(ticker: string): Date | null {
  // LOL: KXLOLGAME-26APR290500JDGNIP
  const lol = ticker.match(/^KX[A-Z]+-(\d{2})([A-Z]{3})(\d{2})(\d{4})/);
  if (lol) {
    const [, yy, mon, dd, hhmm] = lol;
    const M: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    if (M[mon.toUpperCase()] != null) {
      return new Date(
        Date.UTC(2000 + +yy, M[mon.toUpperCase()], +dd, +hhmm.slice(0, 2), +hhmm.slice(2))
      );
    }
  }
  // NBA / MLB / NFL: KXNBAGAME-26APR28PORSAS (没有 HHMM)
  const noTime = ticker.match(/^KX[A-Z]+-(\d{2})([A-Z]{3})(\d{2})/);
  if (noTime) {
    const [, yy, mon, dd] = noTime;
    const M: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    if (M[mon.toUpperCase()] != null) {
      return new Date(Date.UTC(2000 + +yy, M[mon.toUpperCase()], +dd, 12));
    }
  }
  return null;
}

export type KalshiEvent = {
  event_ticker: string;
  series_ticker?: string;
  title?: string;
  sub_title?: string;
  category?: string;
  mutually_exclusive?: boolean;
  available_on_brokers?: boolean;
  product_metadata?: {
    competition?: string;
    competition_scope?: string; // 'Game' | 'Match' | ...
  };
  last_updated_ts?: string;
  markets?: KalshiMarket[]; // 仅 /events/{ticker} 详情时返回
};

// Kalshi v2 字段都是 dollar string ("0.6800") 不是 cent int
export type KalshiMarket = {
  ticker: string;
  event_ticker?: string;
  series_ticker?: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string; // 'active' | 'closed' | 'settled' | 'unopened'
  // 真实开赛时间 (UTC ISO) · 比 ticker 解析准
  // expected_expiration_time / occurrence_datetime 是真实赛事时间
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  volume_fp?: string; // 总成交量 $
  volume_24h_fp?: string;
  open_interest_fp?: string;
  liquidity_dollars?: string;
  open_time?: string;
  close_time?: string;
  expected_expiration_time?: string;
  occurrence_datetime?: string;
  result?: string;
  yes_bid_size_fp?: string;
  yes_ask_size_fp?: string;
};

// dollar string → cents int (统一存储, 与 polymarket 兼容旧 schema)
export function dollarStrToCents(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

// dollar/fp string → number ($)
export function fpToNumber(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export type KalshiOrderbook = {
  yes?: Array<[number, number]>; // [price_cents, size]
  no?: Array<[number, number]>;
};

async function callKalshi<T>(path: string): Promise<T> {
  const r = await fetch(`${KALSHI}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Xiapan/0.1 (catchzvibe.studio)",
    },
    cache: "no-store",
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`kalshi GET ${path} ${r.status}: ${txt.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

// 列 LOL events (跨 LOL_SERIES_TICKERS, 分页)
// 节流: 默认 maxPages=2 (200-400 events) 防 429
// in-memory cache 60s · serverless 实例内有效

let _eventsCache: { ts: number; events: KalshiEvent[] } | null = null;
const EVENTS_CACHE_MS = 60_000;

export async function fetchAllLolEvents(opts?: {
  maxPages?: number;
  forceFresh?: boolean;
}): Promise<KalshiEvent[]> {
  const maxPages = opts?.maxPages ?? 2;
  if (
    !opts?.forceFresh &&
    _eventsCache &&
    Date.now() - _eventsCache.ts < EVENTS_CACHE_MS
  ) {
    return _eventsCache.events;
  }
  const all: KalshiEvent[] = [];
  for (const series of LOL_SERIES_TICKERS) {
    let cursor: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const q = new URLSearchParams();
      q.set("series_ticker", series);
      q.set("limit", "200");
      if (cursor) q.set("cursor", cursor);
      try {
        const data = await callKalshi<{
          events?: KalshiEvent[];
          cursor?: string;
        }>(`/events?${q.toString()}`);
        const events = data.events || [];
        all.push(...events);
        cursor = data.cursor;
        if (!cursor || events.length === 0) break;
      } catch (e) {
        // 429 或其他错 · 用已有缓存(如果有)兜底
        if (_eventsCache && _eventsCache.events.length > 0) {
          return _eventsCache.events;
        }
        throw e;
      }
      // 礼貌等待防 429
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  _eventsCache = { ts: Date.now(), events: all };
  return all;
}

// 单个 event 详情 (含嵌套 markets)
export async function fetchEventDetail(
  eventTicker: string
): Promise<KalshiEvent & { markets: KalshiMarket[] }> {
  const data = await callKalshi<{
    event?: KalshiEvent;
    markets?: KalshiMarket[];
  }>(`/events/${eventTicker}`);
  if (!data.event) throw new Error(`event ${eventTicker} not found`);
  return { ...data.event, markets: data.markets || [] };
}

// 订单簿
export async function fetchOrderbook(
  marketTicker: string
): Promise<KalshiOrderbook> {
  const data = await callKalshi<{ orderbook?: KalshiOrderbook }>(
    `/markets/${marketTicker}/orderbook`
  );
  return data.orderbook || {};
}

// 解析 sub_title (event level)
// 格式 · "T1 vs. HANJIN BRION (May 2)" / "Disguised vs. Team Liquid (May 2)"
export function parseEventSubtitle(sub: string): {
  team1: string | null;
  team2: string | null;
} {
  if (!sub) return { team1: null, team2: null };
  // 砍 (May 2) 等 后缀
  const cleaned = sub.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = cleaned.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (!m) return { team1: null, team2: null };
  return { team1: m[1].trim(), team2: m[2].trim() };
}

// 解析 event_ticker 拿日期 + 时间
// e.g. "KXLOLGAME-26MAY021900DSGTL" → 2026-05-02 19:00 UTC
export function parseEventTicker(ticker: string): {
  scheduledAt: Date | null;
  team1Code: string | null;
  team2Code: string | null;
} {
  // KXLOLGAME-{YY}{MMM}{DD}{HHMM}{TEAM1}{TEAM2}
  const m = ticker.match(
    /^KXLOLGAME-(\d{2})([A-Z]{3})(\d{2})(\d{4})([A-Z]+)$/i
  );
  if (!m) return { scheduledAt: null, team1Code: null, team2Code: null };
  const [, yy, mon, dd, hhmm] = m;
  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const month = monthMap[mon.toUpperCase()];
  if (month == null) return { scheduledAt: null, team1Code: null, team2Code: null };
  const year = 2000 + parseInt(yy, 10);
  const day = parseInt(dd, 10);
  const hour = parseInt(hhmm.slice(0, 2), 10);
  const minute = parseInt(hhmm.slice(2), 10);
  return {
    scheduledAt: new Date(Date.UTC(year, month, day, hour, minute)),
    team1Code: null, // ticker 后缀压缩, 不可靠, 用 sub_title 解析
    team2Code: null,
  };
}

// 找主胜负 market (event 内多个 markets · 取流动性最高 · status=active 优先)
// Kalshi LOL · 一个 event 通常 2 个 markets (yes 押 team1 / yes 押 team2)
// 我们只需要其中一个就够了, 因为 yes/no 价格自动互补
export function pickMatchWinnerMarket(
  markets: KalshiMarket[]
): KalshiMarket | null {
  if (!markets || markets.length === 0) return null;
  // active / open 优先
  const open = markets.filter(
    (m) => m.status === "active" || m.status === "open"
  );
  const candidates = open.length > 0 ? open : markets;
  return candidates.reduce<KalshiMarket | null>((best, m) => {
    if (!best) return m;
    return fpToNumber(m.volume_24h_fp) > fpToNumber(best.volume_24h_fp)
      ? m
      : best;
  }, null);
}

// 战队名 → slug 映射 (Kalshi sub_title 使用全名)
export const TEAM_NAME_ALIASES: Record<string, string> = {
  // LCK
  "t1": "t1",
  "gen.g": "gen", "gen.g esports": "gen", "gen": "gen",
  "hanwha life esports": "hle", "hanwha life": "hle", "hle": "hle",
  "kt rolster": "kt", "kt": "kt",
  "dplus kia": "dk", "dk": "dk",
  "dn soopers": "dns", "dns": "dns",
  "hanjin brion": "bro", "bro": "bro",
  "kwangdong freecs": "kdf", "kdf": "kdf",
  "nongshim red force": "ns", "ns": "ns",
  "bnk fearx": "bfx", "bfx": "bfx",

  // LPL
  "weibo gaming": "wbg", "wbg": "wbg",
  "jd gaming": "jdg", "jdg": "jdg",
  "bilibili gaming": "blg", "blg": "blg",
  "top esports": "tes", "tes": "tes",
  "invictus gaming": "ig", "ig": "ig",
  "anyone's legend": "al", "al": "al",
  "team we": "we", "we": "we",
  "thundertalk gaming": "ttg", "ttg": "ttg",
  "oh my god": "omg", "omg": "omg",
  "ultra prime": "up", "up": "up",
  "lng esports": "lng", "lng": "lng",
  "edward gaming": "edg", "edg": "edg",
  "ninjas in pyjamas": "nip", "nip": "nip",
  "fun plus phoenix": "fpx", "fpx": "fpx",
  "lgd gaming": "lgd", "lgd": "lgd",

  // LEC
  "g2 esports": "g2", "g2": "g2",
  "fnatic": "fnc", "fnc": "fnc",
  "karmine corp": "kc", "kc": "kc",
  "team vitality": "vit", "vit": "vit",
  "team heretics": "th", "th": "th",
  "movistar koi": "mkoi", "mkoi": "mkoi",
  "los ratones": "lyon", "lyon": "lyon",
  "natus vincere": "navi", "navi": "navi",
  "rogue": "rog", "rog": "rog",
  "sk gaming": "sk", "sk": "sk",

  // LCS / Americas
  "team liquid": "tl", "tl": "tl",
  "cloud9": "c9", "c9": "c9",
  "100 thieves": "100t", "100t": "100t",
  "flyquest": "fly", "fly": "fly",
  "dignitas": "dig", "dig": "dig",
  "shopify rebellion": "sr", "sr": "sr",
  "disguised": "dsg", "dsg": "dsg",
  "sentinels": "sen", "sen": "sen",

  // CBLOL / Latin Americas
  "red canids": "red", "red": "red",
  "furia esports": "fur", "fur": "fur", "furia": "fur",
  "pain gaming": "png", "png": "png", "paín gaming": "png",
  "leviatan esports": "lev", "lev": "lev",
  "leviatan": "lev",
  "loud": "loud",
  "isurus": "isg",
  "estral esports": "est",
  "fluxo w7m": "flx",

  // PCS / VCS / GAM 等亚洲新兴
  "deep cross gaming": "dcg",
  "gam esports": "gam", "gam": "gam",
};

export function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
}

export function teamNameToSlug(name: string): string | null {
  const k = normalizeTeamName(name);
  if (TEAM_NAME_ALIASES[k]) return TEAM_NAME_ALIASES[k];
  const stripped = k
    .replace(/\b(esports|gaming|club|team|the|inc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (TEAM_NAME_ALIASES[stripped]) return TEAM_NAME_ALIASES[stripped];
  return null;
}
