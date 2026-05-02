// 百川/weather.ts · 天气信号库
// V0.72 · NWS + Open-Meteo 双源 · 独立模型 · 满足 n_active ≥ 2
//
// 数据源 ·
//   NWS · api.weather.gov (美国政府 · 高分辨率 · 免费)
//   Open-Meteo · open-meteo.com (欧洲 ECMWF/ICON · 免费 · 独立模型)
//
// Kalshi ticker 格式 ·
//   KXHIGHNYC-26MAY02-T75   NYC 5月2日 最高温 ≥ 75°F
//   KXHIGHLAX-26MAY02-T80   LAX
//   KXLOWMIA-...            最低温
//   KXPRECIP...             降水

import { normalCDF } from "./options-pricing";

// 主要美国城市 lat/lng (Kalshi 当前覆盖)
export const KALSHI_CITY_MAP: Record<string, { lat: number; lng: number; name: string }> = {
  NYC: { lat: 40.7766, lng: -73.8740, name: "New York LaGuardia" },     // KLGA
  LAX: { lat: 33.9425, lng: -118.4081, name: "Los Angeles Intl" },     // KLAX
  CHI: { lat: 41.9786, lng: -87.9048, name: "Chicago O'Hare" },        // KORD
  MIA: { lat: 25.7959, lng: -80.2870, name: "Miami Intl" },            // KMIA
  DEN: { lat: 39.8561, lng: -104.6737, name: "Denver Intl" },          // KDEN
  PHX: { lat: 33.4373, lng: -112.0078, name: "Phoenix Sky Harbor" },   // KPHX
  AUS: { lat: 30.1945, lng: -97.6699, name: "Austin-Bergstrom" },      // KAUS
  ATL: { lat: 33.6407, lng: -84.4277, name: "Atlanta Hartsfield" },    // KATL
  PHL: { lat: 39.8729, lng: -75.2437, name: "Philadelphia Intl" },     // KPHL
};

const NWS_BASE = "https://api.weather.gov";
const OPENMETEO_BASE = "https://api.open-meteo.com/v1/forecast";

// ─────────────── ticker 解析 ───────────────

export interface KalshiWeatherTicker {
  type: "high" | "low" | "precip";
  city: string;             // NYC/LAX/...
  date: string;             // ISO YYYY-MM-DD
  threshold: number;        // °F or inches
  raw: string;
}

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseKalshiDate(s: string): string | null {
  // "26MAY02" → "2026-05-02"
  const m = s.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const yy = parseInt(m[1]);
  const mm = MONTH_MAP[m[2]];
  const dd = parseInt(m[3]);
  if (mm === undefined) return null;
  const year = 2000 + yy;
  return `${year}-${String(mm + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parseWeatherTicker(ticker: string): KalshiWeatherTicker | null {
  // KXHIGHNYC-26MAY02-T75  /  KXLOWMIA-...  /  KXPRECIPDEN-...
  const m = ticker.match(/^KX(HIGH|LOW|PRECIP)([A-Z]{3})-(\d{2}[A-Z]{3}\d{2})-T(\d+)$/);
  if (!m) return null;
  const type = m[1].toLowerCase() as "high" | "low" | "precip";
  const city = m[2];
  if (!KALSHI_CITY_MAP[city]) return null;
  const date = parseKalshiDate(m[3]);
  if (!date) return null;
  return { type, city, date, threshold: parseInt(m[4]), raw: ticker };
}

// ─────────────── NWS forecast ───────────────

interface NWSForecastPeriod {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: string;
  isDaytime: boolean;
  probabilityOfPrecipitation?: { value: number | null };
}

let nwsPointCache = new Map<string, { url: string; ts: number }>();

async function getNWSForecastUrl(lat: number, lng: number): Promise<string | null> {
  const key = `${lat},${lng}`;
  const cached = nwsPointCache.get(key);
  if (cached && Date.now() - cached.ts < 86400_000) return cached.url;
  try {
    const r = await fetch(`${NWS_BASE}/points/${lat},${lng}`, {
      headers: { "User-Agent": "du4leaving/0.72" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const url = d?.properties?.forecast as string;
    if (!url) return null;
    nwsPointCache.set(key, { url, ts: Date.now() });
    return url;
  } catch {
    return null;
  }
}

export async function fetchNWSForecast(lat: number, lng: number): Promise<NWSForecastPeriod[]> {
  const url = await getNWSForecastUrl(lat, lng);
  if (!url) return [];
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "du4leaving/0.72" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.properties?.periods ?? []) as NWSForecastPeriod[];
  } catch {
    return [];
  }
}

// ─────────────── Open-Meteo forecast (独立第二源) ───────────────

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
}

export async function fetchOpenMeteoDaily(lat: number, lng: number, days = 14): Promise<OpenMeteoDaily | null> {
  try {
    const url = `${OPENMETEO_BASE}?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America/New_York&forecast_days=${days}`;
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.daily as OpenMeteoDaily;
  } catch {
    return null;
  }
}

// ─────────────── 公允价 ───────────────

export interface WeatherFairResult {
  source: "nws" | "open-meteo";
  forecast_value: number | null;       // forecast 值 (°F 或 inches)
  P_yes: number;                       // P(actual >= threshold)
  sigma: number;                       // 标准差
  days_out: number;
  raw_data?: unknown;
}

/// 计算从某 forecast 出发的 P_yes
export function fairPFromForecast(opts: {
  forecast_value: number;
  threshold: number;
  type: "high" | "low" | "precip";
  days_out: number;
}): { P_yes: number; sigma: number } {
  const { forecast_value, threshold, type, days_out } = opts;
  // sigma 估计 · 距 to 期 days 决定不确定性
  // 1d=0.9 / 3d=2.1 / 7d=3.3 / 14d=4.5 (经验 °F)
  const sigma = type === "precip"
    ? Math.max(0.05, 0.05 + 0.1 * days_out)        // inches
    : Math.max(0.5, 0.5 + 0.4 * days_out);          // °F
  // P(actual ≥ threshold) = 1 - Φ((threshold - forecast) / σ)
  const z = (threshold - forecast_value) / sigma;
  const P_yes = 1 - normalCDF(z);
  return { P_yes, sigma };
}

/// 从 NWS 拿目标日 forecast
export async function fairPFromNWS(t: KalshiWeatherTicker): Promise<WeatherFairResult | null> {
  const city = KALSHI_CITY_MAP[t.city];
  if (!city) return null;
  const periods = await fetchNWSForecast(city.lat, city.lng);
  if (periods.length === 0) return null;

  // 找目标日的所有 period
  const dayPeriods = periods.filter((p) => p.startTime.startsWith(t.date));
  if (dayPeriods.length === 0) return null;

  let forecast_value: number | null = null;
  if (t.type === "high") {
    const dayOnly = dayPeriods.filter((p) => p.isDaytime);
    forecast_value = dayOnly.length > 0
      ? Math.max(...dayOnly.map((p) => p.temperature))
      : Math.max(...dayPeriods.map((p) => p.temperature));
  } else if (t.type === "low") {
    const nightOnly = dayPeriods.filter((p) => !p.isDaytime);
    forecast_value = nightOnly.length > 0
      ? Math.min(...nightOnly.map((p) => p.temperature))
      : Math.min(...dayPeriods.map((p) => p.temperature));
  } else if (t.type === "precip") {
    const probs = dayPeriods
      .map((p) => p.probabilityOfPrecipitation?.value ?? 0)
      .filter((v) => v > 0);
    // NWS 给 PoP 不直接给 inches · 简化用 PoP/100
    forecast_value = probs.length > 0 ? Math.max(...probs) / 100 : 0;
  }

  if (forecast_value === null) return null;

  const days_out = Math.max(0, Math.round(
    (new Date(t.date).getTime() - Date.now()) / 86400_000
  ));
  const { P_yes, sigma } = fairPFromForecast({
    forecast_value,
    threshold: t.threshold,
    type: t.type,
    days_out,
  });

  return { source: "nws", forecast_value, P_yes, sigma, days_out };
}

/// 从 Open-Meteo 拿目标日 forecast (独立第二源)
export async function fairPFromOpenMeteo(t: KalshiWeatherTicker): Promise<WeatherFairResult | null> {
  const city = KALSHI_CITY_MAP[t.city];
  if (!city) return null;
  const days_out = Math.max(0, Math.round(
    (new Date(t.date).getTime() - Date.now()) / 86400_000
  ));
  if (days_out > 14) return null;          // Open-Meteo 默认 14 天上限
  const daily = await fetchOpenMeteoDaily(city.lat, city.lng, Math.min(14, days_out + 2));
  if (!daily) return null;
  const idx = daily.time.indexOf(t.date);
  if (idx < 0) return null;

  let forecast_value: number;
  if (t.type === "high") forecast_value = daily.temperature_2m_max[idx];
  else if (t.type === "low") forecast_value = daily.temperature_2m_min[idx];
  else forecast_value = daily.precipitation_sum[idx] ?? 0;

  const { P_yes, sigma } = fairPFromForecast({
    forecast_value,
    threshold: t.threshold,
    type: t.type,
    days_out,
  });

  return { source: "open-meteo", forecast_value, P_yes, sigma, days_out };
}
