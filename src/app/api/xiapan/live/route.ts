// 虾盘 · 真实实时比赛 (lolesports getLive + ESPN scoreboard)
// 故事性语言 + 体育规则解释

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 5; // 5s ISR

const LOL_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";

// LOL · lolesports getLive
async function fetchLolLive() {
  try {
    const r = await fetch(
      "https://esports-api.lolesports.com/persisted/gw/getLive?hl=en-US",
      {
        headers: { "x-api-key": LOL_KEY, Origin: "https://lolesports.com" },
        cache: "no-store",
      }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.data?.schedule?.events || []).filter(
      (e: { state?: string }) => e.state === "inProgress"
    );
  } catch {
    return [];
  }
}

// ESPN · NBA scoreboard
async function fetchEspnScoreboard(sport: string, league: string) {
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json();
    const events = d?.events || [];
    return events.filter((e: { status?: { type?: { state?: string } } }) =>
      ["in", "inProgress"].includes(e.status?.type?.state || "")
    );
  } catch {
    return [];
  }
}

type StoryMatch = {
  sport: string;
  sportLabel: string;
  team1: string;
  team2: string;
  score1: number | string;
  score2: number | string;
  phase: string; // 比赛阶段 (用故事语言)
  story: string; // 一句话故事化解说
  rule: string; // 这个阶段的规则 / 关注点
  lastUpdate: string;
  kalshiHint?: string; // Kalshi 押注提示
};

function lolStory(ev: {
  match?: {
    teams?: Array<{
      code?: string;
      name?: string;
      result?: { gameWins?: number; outcome?: string };
    }>;
    games?: Array<{ state?: string; number?: number }>;
    strategy?: { count?: number };
  };
  startTime?: string;
}): StoryMatch | null {
  const m = ev.match;
  if (!m) return null;
  const t1 = m.teams?.[0];
  const t2 = m.teams?.[1];
  if (!t1?.code || !t2?.code) return null;
  const w1 = t1.result?.gameWins ?? 0;
  const w2 = t2.result?.gameWins ?? 0;
  const bo = m.strategy?.count || 3;
  const target = Math.ceil(bo / 2);
  const totalGames = w1 + w2;
  const currentGame = totalGames + 1;
  let phase = "";
  let story = "";
  let rule = "";
  let kalshiHint = "";
  if (w1 >= target) {
    phase = `${t1.code} 拿下整场`;
    story = `${t1.code} ${w1}比${w2} 干掉 ${t2.code} · BO${bo} 收官`;
    rule = `BO${bo} 五局三胜制 · 先拿 ${target} 局算赢 · 没有平局`;
  } else if (w2 >= target) {
    phase = `${t2.code} 拿下整场`;
    story = `${t2.code} 反过来 ${w2}比${w1} 干掉 ${t1.code} · 全场结束`;
    rule = `BO${bo} 先拿 ${target} 局算赢`;
  } else if (totalGames === 0) {
    phase = `第一局开打`;
    story = `${t1.code} 对 ${t2.code} · BO${bo} 系列首局开始 · 还没分出胜负`;
    rule = `LOL 一局 25-45 分钟 · 推掉对方主水晶就赢 · 中期"大龙"buff 是翻盘关键`;
    kalshiHint = `开局价格摇摆 · 看双方 ban/pick 阵容 · 阵容碾压可考虑反向单`;
  } else {
    phase = `第 ${currentGame} 局正在打 · 当前 ${w1}比${w2}`;
    const lead = w1 > w2 ? t1.code : t2.code;
    const trail = w1 > w2 ? t2.code : t1.code;
    if (Math.abs(w1 - w2) === 0) {
      story = `${t1.code} 和 ${t2.code} 各赢一局 · 来到决胜局 · 谁赢这场谁拿走整个 BO${bo}`;
      rule = `BO${bo} 决胜局 · 双方教练针对性 ban/pick · 心理战 + 阵容博弈`;
      kalshiHint = `决胜局价格剧烈漂移 · 5 分钟内可能从 50 跳 70 再跌回 30 · 等深度再加`;
    } else if (w1 + w2 === target * 2 - 1 && lead) {
      story = `${lead} 领先 · ${trail} 必须连赢这局才能扳回 · 背水一战`;
      rule = `落后方决死局 · 通常拿出最稳阵容 · 心态决定走势`;
      kalshiHint = `${trail} 现价被压低 · 反扑成功 = 反向单大赚`;
    } else {
      story = `${lead} 拿下首局 · ${trail} 必须接下来连赢才有戏`;
      rule = `BO${bo} 输一局还有机会 · 但落后心态压力大`;
      kalshiHint = `${lead} 现价已涨 · 想押 ${lead} 等他爆冷价稍跌再进`;
    }
  }
  return {
    sport: "lol",
    sportLabel: "LOL",
    team1: t1.code,
    team2: t2.code,
    score1: w1,
    score2: w2,
    phase,
    story,
    rule,
    kalshiHint,
    lastUpdate: ev.startTime || new Date().toISOString(),
  };
}

type EspnEvent = {
  shortName?: string;
  status?: {
    displayClock?: string;
    period?: number;
    type?: { state?: string; description?: string; detail?: string };
  };
  competitions?: Array<{
    competitors?: Array<{
      team?: { abbreviation?: string; displayName?: string };
      score?: string;
    }>;
    situation?: {
      balls?: number;
      strikes?: number;
      outs?: number;
      onFirst?: boolean;
      onSecond?: boolean;
      onThird?: boolean;
    };
  }>;
};

function nbaStory(ev: EspnEvent): StoryMatch | null {
  const comp = ev.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;
  const c1 = comp.competitors[0];
  const c2 = comp.competitors[1];
  const t1 = c1?.team?.abbreviation || "?";
  const t2 = c2?.team?.abbreviation || "?";
  const s1 = parseInt(c1?.score || "0", 10);
  const s2 = parseInt(c2?.score || "0", 10);
  const period = ev.status?.period || 1;
  const clock = ev.status?.displayClock || "";
  const lead = s1 > s2 ? t1 : t2;
  const trail = s1 > s2 ? t2 : t1;
  const diff = Math.abs(s1 - s2);
  let phase = "";
  let story = "";
  let rule = "";
  let kalshiHint = "";
  if (period === 1) {
    phase = `第 1 节 · 还剩 ${clock}`;
    story = diff === 0 ? `${t1} 对 ${t2} · 0比0 刚开打 · 各队还在适应` : `${t1} ${s1} - ${s2} ${t2} · 第 1 节双方互探`;
    rule = `NBA 一场 4 节 · 每节 12 分钟 · 平局加时 5 分钟`;
    kalshiHint = `第 1 节差距小于 8 分基本无意义 · 真正大势看半场后`;
  } else if (period === 2) {
    phase = `第 2 节 · 还剩 ${clock}`;
    story = diff === 0 ? `${t1} ${s1}-${s2} ${t2} · 半场前胶着` : `${lead} 领先 ${diff} 分 · 半场快到 · ${trail} 急需止血`;
    rule = `第 2 节末段是球星接管的窗口 · halftime 调整后第 3 节常翻盘`;
    kalshiHint = `半场前 5min 价格通常最便宜 · 等中场 vol 起来再加`;
  } else if (period === 3) {
    phase = `第 3 节 · 还剩 ${clock}`;
    story =
      diff <= 5
        ? `${t1} ${s1} - ${s2} ${t2} · 第 3 节缠斗 · 胜负还看末节`
        : `${lead} 把比分拉到 ${diff} 分 · 第 3 节末段是分水岭`;
    rule = `第 3 节末是 garbage time 还是真打分界 · 领先 15+ 基本锁`;
    kalshiHint = `第 3 节末领先 ≥ 15 · 价格 90¢+ · 这时候追没意义`;
  } else if (period >= 4) {
    phase = `第 4 节决胜 · 还剩 ${clock}`;
    if (diff <= 5) {
      story = `${t1} ${s1} - ${s2} ${t2} · 末节胶着到最后 ${clock} · clutch 时间到`;
      rule = `Clutch time · 球星单挑 · 罚球 · 三分准头决定一切`;
      kalshiHint = `这种局价格 5 分钟内能从 50 飙到 80 再跌回 30 · 谨慎追涨`;
    } else {
      story = `${lead} 第 4 节领先 ${diff} 分 · 比赛基本结束`;
      rule = `第 4 节落后 > 10 分 · 翻盘历史概率 < 5%`;
      kalshiHint = `这阶段 winning 价 95¢+ · 没 edge · 想止损要趁早`;
    }
  } else if (ev.status?.type?.state === "post") {
    phase = `比赛结束`;
    story = `${lead} ${Math.max(s1, s2)}-${Math.min(s1, s2)} 战胜 ${trail} · 全场结束`;
    rule = "已结算";
  }
  return {
    sport: "nba",
    sportLabel: "NBA",
    team1: t1,
    team2: t2,
    score1: s1,
    score2: s2,
    phase,
    story,
    rule,
    kalshiHint,
    lastUpdate: new Date().toISOString(),
  };
}

function nflStory(ev: EspnEvent): StoryMatch | null {
  const base = nbaStory(ev);
  if (!base) return null;
  base.sport = "nfl";
  base.sportLabel = "NFL";
  const period = ev.status?.period || 1;
  const clock = ev.status?.displayClock || "";
  base.phase = period >= 4 ? `第 4 节 · 还剩 ${clock}` : `第 ${period} 节 · ${clock}`;
  base.rule = `NFL 4 节 · 每节 15 分钟 · 4 节平局加时 10 分钟 (季后赛打到分出胜负)`;
  return base;
}

function nhlStory(ev: EspnEvent): StoryMatch | null {
  const base = nbaStory(ev);
  if (!base) return null;
  base.sport = "nhl";
  base.sportLabel = "NHL";
  const period = ev.status?.period || 1;
  const clock = ev.status?.displayClock || "";
  base.phase =
    period === 1
      ? `第 1 局 · ${clock}`
      : period === 2
        ? `第 2 局 · ${clock}`
        : period >= 3
          ? `第 3 局 · ${clock}`
          : `加时`;
  base.rule = `NHL 3 局 · 每局 20 分钟 · 平局加时 5 分钟 sudden death (季后赛全长)`;
  return base;
}

function tennisStory(ev: EspnEvent): StoryMatch | null {
  const comp = ev.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;
  const c1 = comp.competitors[0];
  const c2 = comp.competitors[1];
  const t1 = c1?.team?.displayName || c1?.team?.abbreviation || "?";
  const t2 = c2?.team?.displayName || c2?.team?.abbreviation || "?";
  const s1 = parseInt(c1?.score || "0", 10); // 盘数
  const s2 = parseInt(c2?.score || "0", 10);
  const detail = ev.status?.type?.detail || ev.status?.type?.description || "";
  const lead = s1 > s2 ? t1 : t2;
  const trail = s1 > s2 ? t2 : t1;
  return {
    sport: "tennis",
    sportLabel: "Tennis",
    team1: t1.split(" ").slice(-1)[0],
    team2: t2.split(" ").slice(-1)[0],
    score1: s1,
    score2: s2,
    phase: detail || `第 ${s1 + s2 + 1} 盘`,
    story:
      s1 === s2
        ? `${t1} 和 ${t2} 盘数 ${s1} 平 · 关键盘 · 谁拿这盘几乎拿走比赛`
        : `${lead} 领先 ${Math.abs(s1 - s2)} 盘 · ${trail} 进入关键反扑窗口`,
    rule: `网球 BO3 (常规) 或 BO5 (大满贯) · 一盘先到 6 局 + 净胜 2 局 · 6-6 进抢七`,
    kalshiHint: `网球落后方反扑成功率 ~20% · 反向单赔率高但风险大`,
    lastUpdate: new Date().toISOString(),
  };
}

function soccerStory(ev: EspnEvent): StoryMatch | null {
  const comp = ev.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;
  const c1 = comp.competitors[0];
  const c2 = comp.competitors[1];
  const t1 = c1?.team?.abbreviation || "?";
  const t2 = c2?.team?.abbreviation || "?";
  const s1 = parseInt(c1?.score || "0", 10);
  const s2 = parseInt(c2?.score || "0", 10);
  const clock = ev.status?.displayClock || "";
  const detail = ev.status?.type?.detail || "";
  const minute = parseInt(clock, 10) || 0;
  const lead = s1 > s2 ? t1 : t2;
  const trail = s1 > s2 ? t2 : t1;
  const diff = Math.abs(s1 - s2);
  let story = "";
  let rule = "";
  let kalshiHint = "";
  if (minute < 15) {
    story = `${t1} ${s1}-${s2} ${t2} · 开场试探 · 节奏在熟悉`;
    rule = `足球 90 分钟 · 上下半场各 45 + 伤停补时`;
  } else if (minute < 45) {
    story =
      diff === 0
        ? `${t1} ${s1}-${s2} ${t2} · 上半场胶着 · 谁先破门谁主动`
        : `${lead} 上半场领先 · ${trail} 中场休息找应对`;
    rule = `半场 45 分钟 · 先进球的方在 xG 数据上常更稳`;
  } else if (minute < 75) {
    story =
      diff === 0
        ? `${t1} ${s1}-${s2} ${t2} · 下半场打到一半 · 谁抓机会谁赢`
        : `${lead} 守 ${diff} 球领先 · ${trail} 加压猛攻`;
    rule = `下半场是体能分水岭 · 60-75 分钟换人窗口决定走势`;
    kalshiHint = `落后方平局价格诱人 · 但顶级队 65min 后翻盘率不到 20%`;
  } else {
    story =
      diff === 0
        ? `${t1} ${s1}-${s2} ${t2} · 最后 ${90 - minute} 分钟 · 平局接近确定`
        : `${lead} 锁定胜局 · ${trail} 拼最后一搏`;
    rule = `补时阶段 + 加时 30 分钟 (淘汰赛) · 现在领先方 80% 锁胜`;
    kalshiHint = `读秒阶段价格变 ≥ 5¢ 都是机会 · 看官方计时器`;
  }
  return {
    sport: "soccer",
    sportLabel: "Soccer",
    team1: t1,
    team2: t2,
    score1: s1,
    score2: s2,
    phase: detail || `第 ${minute} 分钟`,
    story,
    rule,
    kalshiHint,
    lastUpdate: new Date().toISOString(),
  };
}

function golfStory(ev: EspnEvent): StoryMatch | null {
  const comp = ev.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;
  const c1 = comp.competitors[0];
  const c2 = comp.competitors[1];
  return {
    sport: "golf",
    sportLabel: "Golf",
    team1: c1?.team?.displayName || c1?.team?.abbreviation || "?",
    team2: c2?.team?.displayName || c2?.team?.abbreviation || "?",
    score1: c1?.score || "0",
    score2: c2?.score || "0",
    phase: ev.status?.type?.detail || "进行中",
    story: `Golf 锦标赛 · 各路球员同时挥杆 · 杆数越低越好`,
    rule: `4 轮 72 洞 · 标准杆 · -1 鸟 / +1 柏忌 · 总杆数最低赢`,
    kalshiHint: `单球员最终名次盘 · 价格与 leaderboard 联动`,
    lastUpdate: new Date().toISOString(),
  };
}

function mlbStory(ev: {
  status?: { displayClock?: string; period?: number; type?: { state?: string; detail?: string } };
  competitions?: Array<{
    competitors?: Array<{
      team?: { abbreviation?: string };
      score?: string;
    }>;
    situation?: {
      balls?: number;
      strikes?: number;
      outs?: number;
      onFirst?: boolean;
      onSecond?: boolean;
      onThird?: boolean;
      pitcher?: { athlete?: { displayName?: string } };
    };
  }>;
}): StoryMatch | null {
  const comp = ev.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;
  const c1 = comp.competitors[0];
  const c2 = comp.competitors[1];
  const t1 = c1?.team?.abbreviation || "?";
  const t2 = c2?.team?.abbreviation || "?";
  const s1 = parseInt(c1?.score || "0", 10);
  const s2 = parseInt(c2?.score || "0", 10);
  const inning = ev.status?.period || 1;
  const detail = ev.status?.type?.detail || "";
  const sit = comp.situation;
  const onBase = [
    sit?.onFirst ? "1垒" : null,
    sit?.onSecond ? "2垒" : null,
    sit?.onThird ? "3垒" : null,
  ]
    .filter(Boolean)
    .join("/");
  const phase = `第 ${inning} 局 · ${detail}`;
  let story = `${t1} ${s1} - ${s2} ${t2}`;
  if (sit) {
    story += ` · ${sit.balls || 0}-${sit.strikes || 0} count · ${sit.outs || 0} 出局`;
    if (onBase) story += ` · ${onBase} 有人`;
  }
  let rule = "MLB 9 局 · 每局上下半 · 3 出局换攻防";
  if (inning <= 5) {
    rule += " · 1-5 局看先发投手 · 看 ERA 决定走势";
  } else if (inning <= 7) {
    rule += " · 6-7 局 setup man 上 · bullpen 起用";
  } else {
    rule += " · 8-9 局 closer 上 · 守胜率最高的人";
  }
  let kalshiHint = "";
  if (inning >= 7 && Math.abs(s1 - s2) <= 1) {
    kalshiHint = `1 分内胶着进入末段 · closer 决定一切 · 价格剧烈漂`;
  } else if (inning <= 3 && Math.abs(s1 - s2) >= 4) {
    kalshiHint = `早早 4+ 分领先 · 投手对决 · 反扑概率低`;
  }
  return {
    sport: "mlb",
    sportLabel: "MLB",
    team1: t1,
    team2: t2,
    score1: s1,
    score2: s2,
    phase,
    story,
    rule,
    kalshiHint,
    lastUpdate: new Date().toISOString(),
  };
}

export async function GET() {
  const stories: StoryMatch[] = [];
  // LOL
  const lolEvents = await fetchLolLive();
  for (const ev of lolEvents) {
    const s = lolStory(ev);
    if (s) stories.push(s);
  }
  // NBA
  const nbaEvents = await fetchEspnScoreboard("basketball", "nba");
  for (const ev of nbaEvents) {
    const s = nbaStory(ev);
    if (s) stories.push(s);
  }
  // MLB
  const mlbEvents = await fetchEspnScoreboard("baseball", "mlb");
  for (const ev of mlbEvents) {
    const s = mlbStory(ev);
    if (s) stories.push(s);
  }
  // NFL
  const nflEvents = await fetchEspnScoreboard("football", "nfl");
  for (const ev of nflEvents) {
    const s = nflStory(ev);
    if (s) stories.push(s);
  }
  // NHL
  const nhlEvents = await fetchEspnScoreboard("hockey", "nhl");
  for (const ev of nhlEvents) {
    const s = nhlStory(ev);
    if (s) stories.push(s);
  }
  // Tennis (ATP / WTA)
  const atpEvents = await fetchEspnScoreboard("tennis", "atp");
  for (const ev of atpEvents) {
    const s = tennisStory(ev);
    if (s) stories.push(s);
  }
  const wtaEvents = await fetchEspnScoreboard("tennis", "wta");
  for (const ev of wtaEvents) {
    const s = tennisStory(ev);
    if (s) stories.push(s);
  }
  // Soccer (EPL / UCL / MLS / La Liga)
  for (const lg of ["eng.1", "uefa.champions", "usa.1", "esp.1", "ita.1"]) {
    const evs = await fetchEspnScoreboard("soccer", lg);
    for (const ev of evs) {
      const s = soccerStory(ev);
      if (s) stories.push(s);
    }
  }
  // Golf (PGA)
  const golfEvents = await fetchEspnScoreboard("golf", "pga");
  for (const ev of golfEvents) {
    const s = golfStory(ev);
    if (s) stories.push(s);
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    count: stories.length,
    stories,
  });
}
