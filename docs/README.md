# CatchZVibe Studio · Docs

> **Type**: Reference (本目录的索引)
> 按 [Diátaxis](https://diataxis.fr/) 4 类组织 · Sprint 4 重组

## 目录结构

| 目录 | Diátaxis 类型 | 内容 | 给谁看 |
|---|---|---|---|
| `tutorials/` | Tutorial · 学习导向 | 入门 / 渐进教程 (待建) | 新人 |
| `how-to/` | How-to · 任务导向 | SOP / 配方 / 操作步骤 | 已会的人 |
| `reference/` | Reference · 查阅导向 | API / DB schema / 任务列表 | 任何人按需 |
| `explanation/` | Explanation · 理解 why | 设计宣言 / 研究报告 / 战略 | 所有人 |
| `decisions/` | ADR (explanation 子类) | 架构决策记录 (immutable) | 工程 + 接班 |
| `runbooks/` | How-to 子类 | 应急响应 / 一次性流程 | oncall |
| `specs/` | 一次性需求 | Sprint 内 spec (临时) | pm + impl |
| `ground-truth/` | 客户/项目实况 | KOZED / 5/1 / 5/8 等具体项目 | 项目相关人 |

## 写作规则（per docs-dx agent SKILL.md）

每篇文档**恰为 4 类之一**，不可混：
1. **学习还是工作？** → Tutorial / How-to
2. **行动还是思考？** → How-to / Explanation
3. **学习还是思考？** → Tutorial / Explanation
4. **行动还是查阅？** → How-to / Reference

文档头部加：
```markdown
> **Type**: Tutorial / How-to / Reference / Explanation
> Date: YYYY-MM-DD
```

## 当前现状（Sprint 4 重组后）

- ✅ 22 份原 docs/* 已按 4 类归位
- ⚠️ tutorials/ 暂空（czv 没新人 onboarding，HANDOFF.md 在根目录）
- ⚠️ 部分 explanation 文档实际混 reference 内容（Sprint 5+ 增量分）

## 见 also

- `.claude/skills/diataxis-docs/SKILL.md` — 写作规则
- `.claude/knowledge/papers/diataxis-procida.md` — 框架原文摘要
- `.claude/agents/docs-dx.md` — 文献虾职责
