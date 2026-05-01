<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.2.4) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# CatchZVibe Studio · 12 人 Agent 团队入口

> 本文件 = main agent (Claude Code) 进入此项目的总台。读完它你就知道：派活给谁、找哪个 skill、读哪份文献。

## 1 分钟概览

- **项目**: CatchZVibe 独立站 (catchzvibe.studio)
- **栈**: Next.js 16.2.4 + React 19 + Tailwind 4 + Supabase + Three.js / R3F
- **团队**: 12 个专精 agent (8 核心 + 4 辅助) 在 `.claude/agents/*.md`
- **协调机制**: Anthropic Skills + spec-driven (Kiro) + Plan-Chunk-Test (Devin) + Critic loop ≤3 轮
- **预算**: 月度 ≤ $200 · sonnet 默认 · opus 仅 architect

## 12 人花名册

### 核心 8（常驻）

| Agent | 中文 | trigger 关键词 | model |
|---|---|---|---|
| `architect` | 建筑师虾 | 路由 / 架构 / runtime / RSC 边界 | opus |
| `frontend` | 像素虾 | UI 组件 / 动画 / a11y / Tailwind | sonnet |
| `three-d` | 立体虾 | 3D / hall / earth / R3F / shader | sonnet |
| `backend` | 数据库虾 | API route / migration / RLS / Zod | sonnet |
| `qa` | 抓虫虾 | test / e2e / visual regression / PR | sonnet |
| `security` | 防御虾 | OWASP / 越权 / injection / 上线审 | sonnet |
| `ai-llm` | 喂AI虾 | prompt / eval / OpenAI / cost | sonnet |
| `pm-orchestrator` | 队长虾 | 跨 agent 路由 / spec / checkpoint | sonnet |

### 辅助 4（按需）

| Agent | 中文 | trigger 关键词 |
|---|---|---|
| `designer` | 美学虾 | 视觉 / IA / token / 重设计 |
| `growth-seo` | 引流虾 | metadata / OG / vitals / sitemap |
| `refactor` | 清扫虾 | 死代码 / bundle / Knip / 重构 |
| `docs-dx` | 文献虾 | docs / ADR / runbook / Diátaxis |

## 工作流（spec-driven 主流程）

```
TZ 提需求 / Plaud 录音
    ↓
pm-orchestrator → spec → /docs/specs/<feat>.md
    ↓ (TZ ✅)
architect (若需) → ADR → /docs/decisions/
designer  (若需) → 视觉 spec + tokens
    ↓
frontend / backend / three-d / ai-llm 并行实现
    ↓
qa + security 红蓝对（critic loop ≤ 3）
    ↓
refactor + docs-dx 收尾
    ↓
growth-seo (公开路由) metadata 检查
    ↓ ✅
上线
```

每 3 步 pm-orchestrator 写 checkpoint → `docs/decisions/`，防 compaction 丢决策。

## Slash 命令

| 命令 | 用途 |
|---|---|
| `/czv-feat <name>` | 启动新功能开发（spec-driven） |
| `/czv-bug <issue>` | 修 bug（找根因，不 quick-fix） |
| `/czv-cleanup` | 季度清扫（Knip + Fowler 重构） |
| `/czv-roster` | 列 12 agent 团队花名册 |
| `/czv-ledger` | 今日调用 + 月度预算追踪 |
| `/czv-papers <kw>` | 在 vault 搜文献 |

## 知识源结构

```
.claude/
├── agents/        ← 12 agent 定义 (.md, YAML frontmatter)
├── skills/        ← 12 skill 卡片 (≤500 token/个)
├── knowledge/
│   ├── papers/      ← 12 篇学术 / 标准
│   ├── playbooks/   ← 21 篇工业实战
│   └── INDEX.md     ← 关键词检索表
├── commands/      ← 6 个 slash 命令
└── plans/         ← plan mode 输出
```

## 失败模式护栏

| 失败 | 防御 |
|---|---|
| Context drift | 每 3 步 checkpoint 进 docs/decisions/ |
| Role collapse | 每 agent 决策规则在 prompt 顶部 |
| Agent Tennis | qa↔frontend critic ≤ 3 轮，超 escalate |
| Mock vs real | data 字段带 `provenance: mock\|db\|api` |
| Cost runaway | sonnet 默认 + 单 task ≤ $2 |
| 失去 human-in-loop | spec / ADR 必 TZ ✅ |

## 北极星

> 「所有工作只在相机和独立站完成」— 这次升级让独立站这一端不再被人类瓶颈卡住。

## 项目历史血泪 ⚠️

- v35 物理路线失败 (ecctrl + rapier) — **不要再尝试**
- Sprint 3 重做方向: OrbitControls 顶视 isometric

## 进一步阅读

- `PROJECT_STATUS.md` — 现状报告（reference + explanation）
- `HANDOFF.md` — 新人 onboarding (tutorial)
- `.claude/plans/todolist-8-15-agent-30-agent-happy-wozniak.md` — 12 人团队基建计划 v1.0
- `docs/specs/` — 一次性需求 spec
- `docs/decisions/` — ADR 决策记录

---

**最后更新**: 2026-04-30 · Sprint 0 完成
