// 百川/strategies.ts · 15 策略全注册 · 平等无 tier
// V0.72 W3 Day 10 · TZ 单玩家阶段
//
// 核心 · 给 $400 → allocator 看实时市场 · 自动分配到符合前置条件的策略
// 不是 TZ 选 · 是市场决定

export interface Strategy {
  code: string;                       // 系统代号 · 跟 lessons signals_active 一致
  emoji: string;
  name: string;                       // 故事化中文名
  one_liner: string;                  // 1 句话故事
  story: string;                      // 3-5 句小白能懂
  bucket: "stable" | "convex";        // S 桶 / C 桶
  board: string;                      // btc / eth / sol / weather / nba / fed / fda / mention / cross / contrarian
  good_month_pct: number;             // 好月化 (% / 月)
  bad_month_pct: number;              // 坏月化 (% / 月 · 负数)
  loss_cap_pct: number;               // 单笔最大亏损 (% / total)
  precondition: string;               // 前置条件 (人话)
  pro_term?: { term: string; explain: string }[];   // 专业词解释
  reference_url?: string;             // 想深究的人去这看
}

export const STRATEGIES: Strategy[] = [
  // ─────────────── 跨平台套利 (4) · 数学锁定 ───────────────
  {
    code: "btc-cross-platform",
    emoji: "🐦",
    name: "抓鸟人 · BTC",
    one_liner: "Kalshi 卖 65¢ · Polymarket 卖 72¢ · 你买便宜的",
    story: "比特币要不要破 70k · 这道题 Kalshi 美国人玩 · Polymarket 全球人玩 · 价格不一样。我们买便宜的网站 · 卖贵的网站 · 锁差。不预测明天 · 只占今天的便宜。",
    bucket: "stable",
    board: "btc",
    good_month_pct: 4,
    bad_month_pct: -1,
    loss_cap_pct: 1.4,
    precondition: "Kalshi BTC 二元市场存在 · Polymarket 同事件存在 · 价差 ≥ 4pp",
  },
  {
    code: "eth-cross-platform",
    emoji: "🐦",
    name: "抓鸟人 · ETH",
    one_liner: "ETH 同样的题 · 两网站不同价",
    story: "跟 BTC 抓鸟一样 · 只是换 ETH。",
    bucket: "stable",
    board: "eth",
    good_month_pct: 4,
    bad_month_pct: -1,
    loss_cap_pct: 1.4,
    precondition: "Kalshi ETH 二元市场 · Polymarket 同事件 · 价差 ≥ 4pp",
  },
  {
    code: "sol-cross-platform",
    emoji: "🐦",
    name: "抓鸟人 · SOL",
    one_liner: "SOL 同样的题 · 两网站不同价",
    story: "跟 BTC 抓鸟一样 · 只是换 SOL。",
    bucket: "stable",
    board: "sol",
    good_month_pct: 4,
    bad_month_pct: -1,
    loss_cap_pct: 1.4,
    precondition: "Kalshi SOL 二元市场 · Polymarket 同事件 · 价差 ≥ 4pp",
  },
  {
    code: "fed-cross-platform",
    emoji: "🏛",
    name: "央行对照",
    one_liner: "美联储要不要降息 · 两网站不同价",
    story: "美国央行下个月降息吗 · Kalshi 跟 Polymarket 报价不一样 · 我们做差价。每月 FOMC 议息日前后机会最多。听过\"加息降息\"就行 · 不用懂经济。",
    bucket: "stable",
    board: "fed",
    good_month_pct: 5,
    bad_month_pct: 0,
    loss_cap_pct: 1.4,
    precondition: "FOMC/CPI/Jobs/GDP 类二元市场存在 · 跨平台价差 ≥ 4pp",
  },

  // ─────────────── 同价对照 (3) · 数学锁定 ───────────────
  {
    code: "btc-cross-tenor",
    emoji: "⚖",
    name: "同价对照 · BTC",
    one_liner: "1 周内涨过 70k 应该 ≥ 1 天内涨过 70k · 反了就抓",
    story: "数学定律 · 一打鸡蛋必须 ≥ 一个鸡蛋。BTC 在 1 周内涨过 70k 的概率 · 必须 ≥ 1 天内涨过 70k。市场偶尔定错 · 我们就抓。不靠预测 · 靠数学。",
    bucket: "stable",
    board: "btc",
    good_month_pct: 3,
    bad_month_pct: 0,
    loss_cap_pct: 1.4,
    precondition: "BTC 同 strike 不同到期市场 ≥ 2 个 · 价格违反单调性 ≥ 3pp",
  },
  {
    code: "eth-cross-tenor",
    emoji: "⚖",
    name: "同价对照 · ETH",
    one_liner: "ETH 不同到期 · 价格不一致就抓",
    story: "跟 BTC 同价对照一样 · 换 ETH。",
    bucket: "stable",
    board: "eth",
    good_month_pct: 3,
    bad_month_pct: 0,
    loss_cap_pct: 1.4,
    precondition: "ETH 同 strike 不同到期 ≥ 2 · 违反单调性 ≥ 3pp",
  },
  {
    code: "sol-cross-tenor",
    emoji: "⚖",
    name: "同价对照 · SOL",
    one_liner: "SOL 不同到期 · 价格不一致就抓",
    story: "跟 BTC 同价对照一样 · 换 SOL。",
    bucket: "stable",
    board: "sol",
    good_month_pct: 3,
    bad_month_pct: 0,
    loss_cap_pct: 1.4,
    precondition: "SOL 同 strike 不同到期 ≥ 2 · 违反单调性 ≥ 3pp",
  },

  // ─────────────── 看天爷 (2 信号源 · 1 策略) ───────────────
  {
    code: "weather-nws",
    emoji: "🌤",
    name: "看天爷 · NWS",
    one_liner: "美国天气局预报 · 跟 Kalshi 天气盘对赌",
    story: "美国国家气象局 (NWS) 是政府花几百亿做的预报系统。Kalshi 上有 \"明天纽约会不会超过 75°F\" 这种盘 · 散户瞎押。我们用 NWS 真实预报算公允价 · 跟市场价比 · 偏差大就下注。完全不需要懂市场。",
    bucket: "stable",
    board: "weather",
    good_month_pct: 7,
    bad_month_pct: -2,
    loss_cap_pct: 1.4,
    precondition: "Kalshi KXHIGH/KXLOW/KXPRECIP 9 城市 · NWS API 通 · 公允价偏差 ≥ 4pp",
    pro_term: [{ term: "NWS", explain: "美国国家气象局 · weather.gov" }],
  },
  {
    code: "weather-meteo",
    emoji: "🌤",
    name: "看天爷 · 欧版",
    one_liner: "欧洲气象模型 (ECMWF) · 第二把尺子",
    story: "ECMWF 是欧洲版的天气局 · 公认全球最强预报模型。跟美国 NWS 双源对照 · 两个都说会 · 准确率叠加。两源同向是\"双源 confirm\"信号 · 最强。",
    bucket: "stable",
    board: "weather",
    good_month_pct: 7,
    bad_month_pct: -2,
    loss_cap_pct: 1.4,
    precondition: "Open-Meteo API 通 · 14 天内目标日 · 公允价偏差 ≥ 4pp",
    pro_term: [{ term: "ECMWF", explain: "欧洲中期天气预报中心 · 公认最强模型" }],
  },

  // ─────────────── 反群众 (1) ───────────────
  {
    code: "contrarian",
    emoji: "👥",
    name: "反群众",
    one_liner: "70% 散户押 yes · 那边长期赢率不到 50% · 我们押 no",
    story: "学术研究证明 · 当 Kalshi 上 70% 以上的钱压同一边时 · 那边长期胜率往往低于 50%。原因是散户喜欢押热门 / 跟新闻 · 这种情绪化下注让冷门反而被低估。我们看 Kalshi 公开成交流向 · 反着押。全品类通用 · 任何活跃市场都能用。",
    bucket: "stable",
    board: "all",
    good_month_pct: 5,
    bad_month_pct: -4,
    loss_cap_pct: 1.4,
    precondition: "任何 vol_24 ≥ $50 ticker · 近 100 单买卖比 ≥ 58% 或 ≤ 42%",
    pro_term: [{ term: "反群众/contrarian", explain: "Bill Walters 派 · 70% 群众一致看好的方向 · 长期赢率往往不足" }],
    reference_url: "https://en.wikipedia.org/wiki/Contrarian_investing",
  },

  // ─────────────── 公允算师 (3 · BS 公式 加密) ───────────────
  {
    code: "btc-bs",
    emoji: "🎯",
    name: "公允算师 · BTC",
    one_liner: "1973 年诺贝尔奖公式 · 算 BTC 真实概率",
    story: "Black-Scholes 公式是物理学家算 \"球能不能进球门\" 那套数学 · 1973 年获诺贝尔奖 · 全世界期权市场都在用。我们用现货 BTC 价 + 历史波动率 + 时间 · 算 \"BTC 周五能不能破 70k\" 的真实概率。市场报价偏差大 · 我们动。",
    bucket: "stable",
    board: "btc",
    good_month_pct: 6,
    bad_month_pct: -8,
    loss_cap_pct: 1.4,
    precondition: "BTC daily/weekly/monthly Kalshi 市场存在 · Coinbase 现货可拉 · 公允价偏差 ≥ 5pp",
    pro_term: [{ term: "Black-Scholes 公式", explain: "1973 年发明 · 期权定价基础 · 给定现货+vol+时间算公允价" }],
    reference_url: "https://en.wikipedia.org/wiki/Black%E2%80%93Scholes_model",
  },
  {
    code: "eth-bs",
    emoji: "🎯",
    name: "公允算师 · ETH",
    one_liner: "同 BTC · 换 ETH",
    story: "跟 BTC 公允算师一样 · 用 Black-Scholes 算 ETH 公允价。",
    bucket: "stable",
    board: "eth",
    good_month_pct: 6,
    bad_month_pct: -8,
    loss_cap_pct: 1.4,
    precondition: "ETH 二元市场存在 · Coinbase ETH-USD 现货 · 偏差 ≥ 5pp",
  },
  {
    code: "sol-bs",
    emoji: "🎯",
    name: "公允算师 · SOL",
    one_liner: "同 BTC · 换 SOL",
    story: "跟 BTC 公允算师一样 · 换 SOL。",
    bucket: "stable",
    board: "sol",
    good_month_pct: 6,
    bad_month_pct: -8,
    loss_cap_pct: 1.4,
    precondition: "SOL 二元市场存在 · Coinbase SOL-USD 现货 · 偏差 ≥ 5pp",
  },

  // ─────────────── 篮球 Elo (1) ───────────────
  {
    code: "nba-elo",
    emoji: "🏀",
    name: "篮球评分卡",
    one_liner: "国际棋坛 60 年用的评分系统 · 给 NBA 30 队打分",
    story: "Elo 评分是国际象棋用了 60 年的算法 · 数学家 Arpad Elo 1960 年发明。给每支 NBA 球队一个分数 · 高分赢低分有数学公式可算。538 网站每周更新 NBA Elo · 我们直接用。Kalshi 上 NBA 比赛盘 · 散户凭感觉押 · 我们用 Elo 算公允价比一比。仅赛季内有效。",
    bucket: "stable",
    board: "nba",
    good_month_pct: 5,
    bad_month_pct: -8,
    loss_cap_pct: 1.4,
    precondition: "NBA 赛季内 · 538 数据可拉 · Kalshi NBA 市场 · Elo 公允 vs 市场偏差 ≥ 4pp",
    pro_term: [{ term: "Elo 评分", explain: "Arpad Elo 1960 发明 · 国际象棋用了 60 年的实力评分" }],
    reference_url: "https://en.wikipedia.org/wiki/Elo_rating_system",
  },

  // ─────────────── 委员会投票后 (1 · 凸性) ───────────────
  {
    code: "fda-adcom",
    emoji: "💊",
    name: "委员会投票后",
    one_liner: "FDA 投完票 · Kalshi 还没反应过来",
    story: "FDA (美国食药监) 委员会决定一个药能不能上市。委员投完票 · 35-90 天后 FDA 才正式发批文。历史数据 · FDA 87% 跟随委员会投票方向。但 Kalshi 上的押注 · 投票后头几天反应很慢 · 我们抢这个 gap。一月 1-3 次机会 · 单笔小 · 但击中赔率 +15-30%。",
    bucket: "convex",
    board: "fda",
    good_month_pct: 25,
    bad_month_pct: -100,
    loss_cap_pct: 0.5,
    precondition: "FDA AdCom 日历有事件 · Kalshi 对应 ticker 已开 · 委员投票完成",
    pro_term: [
      { term: "AdCom", explain: "FDA Advisory Committee · 由专家投票推荐" },
      { term: "PDUFA", explain: "FDA 法定决议截止日 · 通常 AdCom 后 60-90 天" },
    ],
    reference_url: "https://www.fda.gov/advisory-committees",
  },

  // ─────────────── 名人嘴瓢 (1 · 凸性) ───────────────
  {
    code: "mention-engine",
    emoji: "🎤",
    name: "名人嘴瓢",
    one_liner: "Trump · Catboy 等说啥 · 市场反应慢 5-15 分钟",
    story: "Kalshi 有一类盘 · 押 \"X 在 Y 事件中会不会说某个词 N 次\"。这些盘对名人发言极敏感 · 推文一发 · 直播一说 · 概率立刻变。但 Kalshi 散户反应慢 5-15 分钟 · 我们用 AI 实时分析名人发言 · 估真实概率 · 抢这个反应窗口。每周 5-10 次机会。",
    bucket: "convex",
    board: "mention",
    good_month_pct: 35,
    bad_month_pct: -100,
    loss_cap_pct: 0.5,
    precondition: "Kalshi mention market 类型存在 (e.g. 巴菲特股东会 / Trump 演讲) · LLM 估错价 ≥ 12pp · 信号 ≤ 30 分钟新鲜",
    pro_term: [
      { term: "mention market", explain: "Kalshi 押 \"X 会不会说某词 N 次\" 的特殊盘" },
      { term: "Catboy", explain: "Kalshi top-100 玩家 · 公开身份 · 主玩 mention market" },
    ],
    reference_url: "https://kalshi.com/category/culture",
  },
];

export function getStrategy(code: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.code === code);
}

export function strategiesByBoard(board: string): Strategy[] {
  return STRATEGIES.filter((s) => s.board === board);
}

export function strategiesByBucket(bucket: "stable" | "convex"): Strategy[] {
  return STRATEGIES.filter((s) => s.bucket === bucket);
}
