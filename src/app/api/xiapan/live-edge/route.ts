import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import {
  fetchAllLolEvents,
  fetchEventDetail,
  parseEventSubtitle,
  parseEventTicker,
  pickMatchWinnerMarket,
  teamNameToSlug,
  fpToNumber,
  dollarStrToCents,
} from "@/lib/xiapan/kalshi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function expectedScore(e1: number, e2: number) {
  return 1 / (1 + Math.pow(10, (e2 - e1) / 400));
}

function loadElos(): Record<string, number> {
  // dev mode · 从 .xiapan-probe 读最新 elo-train JSON
  try {
    const dir = path.resolve(process.cwd(), ".xiapan-probe");
    if (!fs.existsSync(dir)) return {};
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("elo-train-") && f.endsWith(".json"))
      .sort();
    if (!files.length) return {};
    const data = JSON.parse(
      fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8")
    );
    return data.finalElos || {};
  } catch {
    return {};
  }
}

async function pMap<T, R>(
  items: T[],
  fn: (x: T) => Promise<R>,
  conc: number
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx]);
      } catch {
        out[idx] = null as unknown as R;
      }
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const hours = Number(url.searchParams.get("hours") || "12");
  const minVol = Number(url.searchParams.get("min_vol") || "100");
  const bankroll = Number(url.searchParams.get("bankroll") || "100");

  try {
    const elos = loadElos();
    const getElo = (slug: string) => (elos[slug] != null ? elos[slug] : 1500);

    const all = await fetchAllLolEvents();
    const now = Date.now();
    const horizon = now + hours * 3600 * 1000;
    const candidates: Array<{
      eventTicker: string;
      scheduledAt: Date;
      slug1: string;
      slug2: string;
      name1: string;
      name2: string;
    }> = [];
    for (const ev of all) {
      const t = parseEventTicker(ev.event_ticker)?.scheduledAt?.getTime();
      if (!t || t < now - 30 * 60 * 1000 || t > horizon) continue;
      const sub = parseEventSubtitle(ev.sub_title || "");
      if (!sub.team1 || !sub.team2) continue;
      const s1 = teamNameToSlug(sub.team1);
      const s2 = teamNameToSlug(sub.team2);
      if (!s1 || !s2) continue;
      candidates.push({
        eventTicker: ev.event_ticker,
        scheduledAt: new Date(t),
        slug1: s1,
        slug2: s2,
        name1: sub.team1,
        name2: sub.team2,
      });
    }

    // 限流 · 取最近 24 个 candidate, 防止 429
    const limited = candidates.slice(0, Math.min(candidates.length, 24));
    const rows: unknown[] = [];
    await pMap(
      limited,
      async (c) => {
        let detail;
        try {
          detail = await fetchEventDetail(c.eventTicker);
        } catch {
          return;
        }
        const main = pickMatchWinnerMarket(detail.markets);
        if (!main) return;
        const yesAskC = dollarStrToCents(main.yes_ask_dollars);
        const yesBidC = dollarStrToCents(main.yes_bid_dollars);
        const vol24 = fpToNumber(main.volume_24h_fp);
        const oi = fpToNumber(main.open_interest_fp);
        const yesSlug = teamNameToSlug(main.yes_sub_title || "");

        const e1 = getElo(c.slug1);
        const e2 = getElo(c.slug2);
        const yesIsTeam1 = yesSlug === c.slug1;
        const modelPYes = yesIsTeam1
          ? expectedScore(e1, e2)
          : expectedScore(e2, e1);
        const impliedP = yesAskC != null ? yesAskC / 100 : null;
        const spread =
          yesAskC != null && yesBidC != null ? yesAskC - yesBidC : null;
        const edgePp = impliedP != null ? (modelPYes - impliedP) * 100 : null;
        const direction = edgePp == null ? null : edgePp >= 0 ? "yes" : "no";
        const myEdgePp = edgePp == null ? null : Math.abs(edgePp);
        const buySide =
          direction === "yes" ? main.yes_sub_title : main.no_sub_title;
        const buyPriceC =
          direction === "yes"
            ? yesAskC
            : yesAskC != null
              ? 100 - yesAskC
              : null;

        let kelly: number | null = null;
        if (buyPriceC != null && myEdgePp != null) {
          const myP = direction === "yes" ? modelPYes : 1 - modelPYes;
          const cost = buyPriceC / 100;
          if (cost > 0 && cost < 1) {
            const raw = (myP - cost) / (1 - cost);
            kelly = Math.max(0, Math.min(0.5, raw)) * 0.25;
          }
        }

        let level: "skip" | "watch" | "strong" = "skip";
        if (myEdgePp == null || vol24 < minVol) {
          level = "skip";
        } else if (myEdgePp >= 5 && (spread == null || spread <= 5)) {
          level = "strong";
        } else if (myEdgePp >= 3) {
          level = "watch";
        }

        // 用 Kalshi 真实开赛时间 · ticker 解析不准
        const realStartTime =
          (main as { expected_expiration_time?: string }).expected_expiration_time ||
          c.scheduledAt.toISOString();
        rows.push({
          ts: realStartTime,
          eventTicker: c.eventTicker,
          marketTicker: main.ticker,
          team1: c.slug1.toUpperCase(),
          team2: c.slug2.toUpperCase(),
          name1: c.name1,
          name2: c.name2,
          elo1: Math.round(e1),
          elo2: Math.round(e2),
          yesSubTitle: main.yes_sub_title,
          noSubTitle: main.no_sub_title,
          modelPYes,
          impliedP,
          edgePp,
          myEdgePp,
          direction,
          buySide,
          buyPriceC,
          yesBidC,
          yesAskC,
          spread,
          vol24,
          oi,
          status: main.status,
          kelly,
          kellySuggestStake: kelly != null ? kelly * bankroll : null,
          level,
        });
      },
      3
    );

    rows.sort((a, b) => {
      const ar = a as { level: string; myEdgePp?: number };
      const br = b as { level: string; myEdgePp?: number };
      const order: Record<string, number> = { strong: 0, watch: 1, skip: 2 };
      const lvl = order[ar.level] - order[br.level];
      if (lvl !== 0) return lvl;
      return (br.myEdgePp || 0) - (ar.myEdgePp || 0);
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      hours,
      minVol,
      bankroll,
      candidates: candidates.length,
      rows,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
