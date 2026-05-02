// 百川/fda.ts · FDA AdCom + Phase 3 信号库
// V0.72 W2 Day 4 · 凸性桶 (C池) 第一个真信号源
//
// 数据 ·
//   1. AdCom 日历 · FDA.gov 公告 (人工 seed JSON · 月更)
//   2. Phase 3 readout · ClinicalTrials.gov + endpoints.com RSS
//   3. 历史基率 (按疾病类型)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const FDA_DATA_DIR = path.join(HOME, ".du4leaving", "百川", "fda");
const ADCOM_FILE = path.join(FDA_DATA_DIR, "adcom-calendar.json");
const RUNTIME_DIR = path.join(HOME, ".du4leaving", "百川", "fda");

// 历史基率 (FDA approval rate by disease)
export const BASE_RATES: Record<string, number> = {
  oncology: 0.90,
  hematology: 0.88,
  vaccine: 0.92,
  antibiotic: 0.95,
  neurology: 0.75,
  alzheimers: 0.45,
  gene_therapy: 0.70,
  cardiovascular: 0.82,
  endocrine: 0.85,
  rare_disease: 0.88,
  unknown: 0.78,            // 默认 (历史平均)
};

// AdCom 投票 → FDA 后续批准映射 (历史 1990-2024)
export const ADCOM_TO_FDA = {
  yes_unanimous: 0.92,      // 全票赞成
  yes_majority: 0.87,       // 多数赞成 (e.g. 8-2)
  split: 0.55,              // 5-4 等分裂
  no_majority: 0.10,        // 多数反对
  no_unanimous: 0.05,       // 全票反对
} as const;

export interface AdComMeeting {
  date: string;             // YYYY-MM-DD
  drug: string;             // generic name
  brand?: string;           // brand name
  sponsor: string;          // 公司
  indication: string;
  disease_category: keyof typeof BASE_RATES;
  vote_status?: "scheduled" | "yes_unanimous" | "yes_majority" | "split" | "no_majority" | "no_unanimous";
  vote_detail?: string;     // "11-0" "8-2" 等
  pdufa_date?: string;      // FDA 决议截止日
  kalshi_ticker?: string;   // 关联 Kalshi market
}

export interface Phase3Readout {
  ts: string;               // 公布时间
  drug: string;
  sponsor: string;
  primary_endpoint: "hit" | "miss" | "partial";
  p_value?: number;
  detail: string;
  source: string;           // PR url
  kalshi_ticker?: string;
}

function ensureDir() {
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

export function readAdComCalendar(): AdComMeeting[] {
  if (!fs.existsSync(ADCOM_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(ADCOM_FILE, "utf8"));
    if (Array.isArray(data)) return data as AdComMeeting[];
    return [];
  } catch {
    return [];
  }
}

export function writeAdComCalendar(meetings: AdComMeeting[]): void {
  ensureDir();
  fs.writeFileSync(ADCOM_FILE, JSON.stringify(meetings, null, 2), "utf8");
}

/// 给定 AdCom 投票结果 · 算 P(FDA 批) · 加 disease prior 修正
export function fairPFromAdCom(meeting: AdComMeeting): { P: number; reasoning: string } {
  if (!meeting.vote_status || meeting.vote_status === "scheduled") {
    const base = BASE_RATES[meeting.disease_category] ?? BASE_RATES.unknown;
    return { P: base, reasoning: `仅 base rate (${meeting.disease_category})` };
  }
  const adcomP = ADCOM_TO_FDA[meeting.vote_status];
  // 加权 · 70% AdCom · 30% disease base
  const base = BASE_RATES[meeting.disease_category] ?? BASE_RATES.unknown;
  const P = 0.7 * adcomP + 0.3 * base;
  return {
    P,
    reasoning: `AdCom ${meeting.vote_status} (${meeting.vote_detail ?? ""}) ${(adcomP * 100).toFixed(0)}% × 0.7 + base ${meeting.disease_category} ${(base * 100).toFixed(0)}% × 0.3`,
  };
}

/// 给定 Phase 3 结果 · 算 P shift
export function fairPFromPhase3(readout: Phase3Readout): { P_shift: number; reasoning: string } {
  if (readout.primary_endpoint === "hit") {
    if (readout.p_value !== undefined && readout.p_value < 0.001) {
      return { P_shift: +0.30, reasoning: `Phase 3 hit · p<0.001 · 强 +30pp` };
    }
    if (readout.p_value !== undefined && readout.p_value < 0.05) {
      return { P_shift: +0.15, reasoning: `Phase 3 hit · p<0.05 · +15pp` };
    }
    return { P_shift: +0.10, reasoning: `Phase 3 hit · 无 p-value · +10pp` };
  }
  if (readout.primary_endpoint === "miss") {
    return { P_shift: -0.25, reasoning: `Phase 3 miss · -25pp` };
  }
  return { P_shift: 0, reasoning: `Phase 3 partial · 不动` };
}

export const PATHS = { FDA_DATA_DIR, ADCOM_FILE };
