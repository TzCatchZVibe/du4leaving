// 虾盘共享类型 · Sprint 4 重构: 5 个组件原本各自 declare EdgeRow 导致同名 nominal 不兼容
// 全部改 import 此文件 → 单一 source of truth

export type EdgeLevel = "skip" | "watch" | "strong";
export type EdgeDirection = "yes" | "no" | null;

// 完整 EdgeRow · 来自 xiapan-edge service · play-dashboard 用全集
export type EdgeRow = {
  ts: string;
  eventTicker: string;
  marketTicker: string;
  team1: string;
  team2: string;
  name1: string;
  name2: string;
  elo1: number;
  elo2: number;
  yesSubTitle: string;
  noSubTitle: string;
  modelPYes: number;
  impliedP: number | null;
  edgePp: number | null;
  myEdgePp: number | null;
  direction: EdgeDirection;
  buySide: string;
  buyPriceC: number | null;
  yesBidC: number | null;
  yesAskC: number | null;
  spread: number | null;
  vol24: number;
  oi: number;
  status: string;
  kelly: number | null;
  kellySuggestStake: number | null;
  level: EdgeLevel;
};
