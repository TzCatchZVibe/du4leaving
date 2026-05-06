// 老虾 tool registry · OpenAI / Anthropic 函数式工具定义 + executor
// 每个 tool · 调内部 API · 拿 JSON · 给 LLM 当 narrate 素材

interface ToolDef {
  name: string;
  description: string;
  parameters: any;       // JSON Schema
  exec: (args: any, baseUrl: string) => Promise<any>;
}

async function fetchJson(url: string): Promise<any> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

async function postJson(url: string, body: any): Promise<any> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export const LAOXIA_TOOLS: ToolDef[] = [
  {
    name: "get_jars",
    description: "看 Guilty Pleasure 罐子余额 · 罐子是 TZ 在内疚消费 (Kalshi/外卖/Amazon) 时等额计入 EP/绿卡的虚拟储蓄罐",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/jar`),
  },
  {
    name: "scan_jars",
    description: "手动扫 14 天 SimpleFIN 真交易 · 找匹配规则的花费 · 计入对应罐",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/jar/check?days=14`),
  },
  {
    name: "get_age_of_money",
    description: "钱龄 · 现金 / 日均花 = 缓冲天数 · 签证安全指标 · < 30 天危险",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/age-of-money`),
  },
  {
    name: "get_lumpy",
    description: "大坑提前摊月 · EB-1A 律师费 / EP 装备 / 出差 · 看每月需留多少",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/lumpy`),
  },
  {
    name: "translate_amount",
    description: "把金额翻译成 'HG 干活小时' + 'EP 推迟天数' + '占目标百分比' · 让钱有重量",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "美元金额" },
      },
      required: ["amount"],
    },
    exec: async (args, base) => fetchJson(`${base}/api/wealth/translate?amount=${args.amount}`),
  },
  {
    name: "get_cashflow",
    description: "未来 14 天现金流预测 · 列 bill + 现金 + 缺口",
    parameters: { type: "object", properties: { horizon_days: { type: "number" } }, required: [] },
    exec: async (args, base) => fetchJson(`${base}/api/wealth/cashflow?horizon=${args.horizon_days || 14}`),
  },
  {
    name: "get_anomaly",
    description: "类目支出异常 · 本周 vs 4 周均 · +50% 且 ≥$20 → spike",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/anomaly`),
  },
  {
    name: "get_weekly_report",
    description: "本周复盘 · 收入 + 支出 + 14 天 cashflow + 目标速度 · narrative 由你 (老虾) 重写",
    parameters: { type: "object", properties: { offset: { type: "number", description: "0=本周 -1=上周" } }, required: [] },
    exec: async (args, base) => fetchJson(`${base}/api/wealth/weekly?offset=${args.offset || 0}`),
  },
  {
    name: "get_goals",
    description: "4 大目标进度 (绿卡/EP/房/车) + 月化净攒 + 是否在轨",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/goals`),
  },
  {
    name: "get_burn_rate",
    description: "本月支出 + 类目 + 日均 burn",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/burn`),
  },
  {
    name: "get_income",
    description: "本月 + 上月 收入 (HG / CZV / 其他) · HG 状态判定",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/income`),
  },
  {
    name: "get_networth",
    description: "净值跨账户 1 屏 + 7d / 30d delta",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/networth`),
  },
  {
    name: "create_lockdown",
    description: "用户犹豫买东西时 · 创建 24h 冷静期 · 自动 push 提醒",
    parameters: {
      type: "object",
      properties: {
        amount_usd: { type: "number" },
        description: { type: "string" },
      },
      required: ["amount_usd", "description"],
    },
    exec: async (args, base) => postJson(`${base}/api/wealth/lockdown`, {
      amount_usd: args.amount_usd, description: args.description,
    }),
  },
  {
    name: "get_pending_lockdowns",
    description: "看当前 pending 的 24h 冷静期消费",
    parameters: { type: "object", properties: {}, required: [] },
    exec: async (_args, base) => fetchJson(`${base}/api/wealth/lockdown`),
  },
];

// OpenAI Chat Completion 格式
export function toolsForOpenAI() {
  return LAOXIA_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Anthropic Messages 格式 (DeepSeek V4 Anthropic 兼容用)
export function toolsForAnthropic() {
  return LAOXIA_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

export async function executeTool(name: string, args: any, baseUrl: string): Promise<any> {
  const tool = LAOXIA_TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `unknown tool ${name}` };
  return tool.exec(args, baseUrl);
}
