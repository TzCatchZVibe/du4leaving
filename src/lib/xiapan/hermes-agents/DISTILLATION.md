# 蒸馏路标 · 16 人 · 用到极致

> v0.59 · 用花叔 [alchaincyf/nuwa-skill](https://github.com/alchaincyf/nuwa-skill) 蒸馏 · 装到 ~/.claude/skills/
> du4 三虾 (老虎/鸭子/算盘) prompt 时按 distill_keywords 自动 inject 相关人物
> 用户 directive · "多几个人 用到极致"

## 第一步 · 装女娲本身

```bash
# 在 Claude Code 终端
npx skills add alchaincyf/nuwa-skill          # 蒸馏机
npx skills add alchaincyf/huashu-design       # 设计 (HG 报刊用)
npx skills add alchaincyf/huashu-skills       # 11 包内容流水线
npx skills add alchaincyf/darwin-skill        # 自评估 (skill 越用越准)
npx skills add anthropics/skill-creator       # 官方 meta
```

或一行 ·
```bash
./scripts/du4-distill.sh install
```

## 16 人物路标

### Phase 1 · 押注 sharp 7 人 (du4 直接用)

| # | 人 | 用在哪个虾 | 给的精神 |
|---|---|---|---|
| 1 | Esoteric Catboy | 老虎 / 鸭子 | mention 词频 · long shot · junk bond 仓位 |
| 2 | Iabvek | 老虎 | NYC mayor + 7 figure · 慢盘耐心 |
| 3 | Annie Duke | 算盘 | Thinking in Bets · 决策框架 |
| 4 | Nate Silver | 算盘 | 538 · 概率思维 · 校准 |
| 5 | Jim Simons | 老虎 | Renaissance · 量化 · 微小持续 edge |
| 6 | Nassim Taleb | 鸭子 / 老虎 | 反脆弱 · 黑天鹅 · 仓位 |
| 7 | Phil Helmuth | 算盘 | tilt 控制 · 情绪 · 复仇标签警 |

### Phase 2 · 创业精神 5 人 (TZ solo founder)

| # | 人 | 用在哪 | 精神 |
|---|---|---|---|
| 8 | CZ (Changpeng Zhao) | sage / 老虎 | 72 原则 · 用户唯一 · 5min 客服 |
| 9 | Jensen Huang | sage | 长期主义 · 工程文化 |
| 10 | Paul Graham | sage | startup 思考 · 短文写作 |
| 11 | Steve Jobs | sage / 美学 | 极简 · 产品至上 |
| 12 | Naval Ravikant | sage | 清晰 · 杠杆 · solo 哲学 |

### Phase 3 · 中文场景 4 人 (HG / 内容)

| # | 人 | 用在哪 | 精神 |
|---|---|---|---|
| 13 | 张一鸣 (ByteDance) | sage | 信息流 · 长期 · 不偏 |
| 14 | 罗永浩 | 内容/虾写 | 表达 · 段子 · 直播节奏 |
| 15 | 何同学 | 内容/虾画 | 产品视频 · 叙事 |
| 16 | 花叔 (Alchain) | sage / 美学 | 中文 AI 工具方法论 |

## 怎么蒸馏 (在 Claude Code 终端)

```
# 一行一个 · 慢慢跑
/nuwa 蒸馏一个 Esoteric-Catboy
/nuwa 蒸馏一个 Annie-Duke
/nuwa 蒸馏一个 Changpeng-Zhao-CZ
...
```

或批量 ·
```bash
./scripts/du4-distill.sh phase1   # 押注 7 人
./scripts/du4-distill.sh phase2   # 创业 5 人
./scripts/du4-distill.sh phase3   # 中文 4 人
./scripts/du4-distill.sh all      # 全 16
```

每蒸馏完 · 写 `~/.claude/skills/<slug>-skill/SKILL.md` ·
du4 三虾下次跑会自动按 distill_keywords 选相关人物 inject prompt。

## 怎么用到极致 (3 层)

### 1 层 · 静态 inject (现在已就绪)
- 老虎跑时 · agent-base.ts 的 relevantDistilledPeople(["catboy", "kelly", "edge"]) 选 3 人
- 拼到 system prompt · 老虎 prompt 里有 Catboy/Annie Duke/Taleb 的精髓

### 2 层 · 动态唤醒 (路标 v0.60)
- 用户问 sage "我该不该平 NBA 第 4 节"
- sage 自动选 panel · {老虎本人 + Annie Duke + Phil Helmuth (tilt) + Catboy (live read)}
- 4 人轮流给意见 · sage 综合

### 3 层 · 反向蒸馏 (路标 v0.61)
- 蒸馏 TZ 自己 · victor / Frida / Hank
- 给虾系当内部顾问 · 比如老虎可能引用"TZ 喜欢什么样的盘"

## Phase 4 · 还能加的 (留给路标)

- Frank Slootman (operating cadence · 给 sage)
- Ben Graham (价值投资 · 给老虎)
- 徐小平 (中文导师 · 给 sage)
- Kanye / Rick Rubin (美学 · 给虾画)
- Jony Ive (产品美学)
- 罗振宇 (中文叙事)

## 兼容性

- 女娲产物 · `~/.claude/skills/<slug>-skill/SKILL.md` (Anthropic Skills 格式)
- du4 三虾 · 直接读这文件夹 · 无需任何转换
- Hermes Agent (NousResearch) · 同格式 · 也能直接用
- 跨 agent 共享 · 一次蒸馏 · 全栈用
