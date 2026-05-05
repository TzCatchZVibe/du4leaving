// 收入透明 · HG 工资 + 奖金 + CZV 营收
// 从 SimpleFIN 真交易识别 + 配置阈值

import { pullSimpleFin } from "./simplefin";

const HG_BASE_USD = 4000;          // HG 月底薪 (税前 · 实际到账可能更少)
const HG_BONUS_RANGE = [500, 1000]; // HG 奖金区间

interface IncomeTx {
  amount: number;
  date: string;
  desc: string;
  source: "hg" | "czv" | "transfer" | "other" | "interest";
}

// 哪些交易是 HG 工资?
function classifyIncome(desc: string): IncomeTx["source"] {
  const d = desc.toLowerCase();
  // 转账内 · 你自己 (HAOYU ZHENG = TZ 中文名) · 不算新收入 · 优先级最高
  if (/haoyu.*zheng|zelle.*from.*haoyu|capital.*one.*ach.*deposit|transfer.*from.*self|own.*account/i.test(d)) return "transfer";
  if (/zelle.*from.*me|paypal.*xfer/i.test(d)) return "transfer";
  // HG-related · 真 payroll · GUSTO 是 HG 工资系统
  if (/gusto.*payroll|happy.*global.*payroll|hg.*payroll|hg.*salary/i.test(d)) return "hg";
  // CZV / TZ 工作室
  if (/catchz|catchzvibe|czv.*invoice|wozniak/i.test(d)) return "czv";
  // 银行利息
  if (/interest/i.test(d)) return "interest";
  return "other";
}

export interface IncomeSummary {
  month_start: string;
  hg_total: number;
  hg_count: number;
  hg_status: "below_base" | "base_only" | "with_bonus" | "above_normal";
  hg_vs_base_pct: number;
  czv_total: number;
  czv_count: number;
  other_total: number;
  transfer_total: number;
  total_real_income: number;     // hg + czv + other (排除 transfer)
  by_tx: Array<{ amount: number; date: string; desc: string; source: string }>;
  hg_target: number;
  hg_bonus_low: number;
  hg_bonus_high: number;
}

export async function summarizeIncome(monthOffset = 0): Promise<IncomeSummary> {
  const { accounts } = await pullSimpleFin(60);     // 拉 60 天涵盖跨月
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);
  const startTs = start.getTime() / 1000;
  const endTs = end.getTime() / 1000;

  let hg = 0, hgCount = 0;
  let czv = 0, czvCount = 0;
  let other = 0;
  let transfer = 0;
  const byTx: IncomeSummary["by_tx"] = [];

  for (const a of accounts) {
    for (const tx of a.transactions || []) {
      if (tx.posted < startTs || tx.posted >= endTs) continue;
      const amt = parseFloat(tx.amount || "0");
      if (amt <= 0) continue;     // 只看进账
      const desc = tx.description || tx.payee || "(no desc)";
      const debugStr = JSON.stringify({ d: tx.description, p: tx.payee, m: tx.memo }).slice(0, 200);
      const src = classifyIncome(desc);
      const date = new Date(tx.posted * 1000).toISOString().slice(0, 10);
      byTx.push({ amount: +amt.toFixed(2), date, desc: desc.slice(0, 50), source: src, _debug: debugStr } as any);
      if (src === "hg") { hg += amt; hgCount++; }
      else if (src === "czv") { czv += amt; czvCount++; }
      else if (src === "transfer") { transfer += amt; }
      else { other += amt; }
    }
  }

  // 状态判断 (HG)
  let hg_status: IncomeSummary["hg_status"];
  if (hg < HG_BASE_USD * 0.95) hg_status = "below_base";
  else if (hg < HG_BASE_USD + HG_BONUS_RANGE[0]) hg_status = "base_only";
  else if (hg <= HG_BASE_USD + HG_BONUS_RANGE[1]) hg_status = "with_bonus";
  else hg_status = "above_normal";

  return {
    month_start: start.toISOString().slice(0, 10),
    hg_total: +hg.toFixed(2),
    hg_count: hgCount,
    hg_status,
    hg_vs_base_pct: +((hg / HG_BASE_USD) * 100).toFixed(0),
    czv_total: +czv.toFixed(2),
    czv_count: czvCount,
    other_total: +other.toFixed(2),
    transfer_total: +transfer.toFixed(2),
    total_real_income: +(hg + czv + other).toFixed(2),
    by_tx: byTx.sort((a, b) => b.amount - a.amount),
    hg_target: HG_BASE_USD,
    hg_bonus_low: HG_BONUS_RANGE[0],
    hg_bonus_high: HG_BONUS_RANGE[1],
  };
}
// force rebuild 1778005032
