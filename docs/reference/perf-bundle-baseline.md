# Bundle Size Baseline · Sprint 4

> **Type**: Reference
> Date: 2026-04-30
> Owner: refactor (清扫虾)

## 当前 (Sprint 4 末)

| 项 | 值 |
|---|---|
| Build compile time | ✅ 4.2s (Turbopack) |
| TypeScript check | ✅ 5.1s 全绿 |
| TS errors | 0 |
| Direct deps | (见 package.json) |
| Removed in Sprint 3 | `ecctrl` + `@react-three/rapier` |
| Removed in Sprint 4 | `src/lib/quests/{mock,types}.ts` (Sprint 1 已替换 inquiries) |

## Knip 报告 (Sprint 4 D3)

| 类别 | 数量 | 处理 |
|---|---|---|
| Unused files | 42 | 仅清 `src/lib/quests/*` (2) · 其余 dashboard/intel 死文件等待 TZ 决定 |
| Unused exports | 67 | 留 Sprint 5 增量清 |
| Unused deps | 3 (`class-variance-authority` / `clsx` / `tailwind-merge`) | 实际可能 child 用 · 不删 |
| Unlisted deps | 6 (`three-stdlib` / `postprocessing` / `server-only` / `postcss`) | 应明示加进 package.json |

## Routes

App Router 已注册 (build output)：

### Public (○ static)
- `/` `/about` `/booking` `/launch` `/login` `/portfolio` `/services` `/wholesale`
- `/xiapan-preview` `/xiapan/overlay`

### Internal (ƒ dynamic, auth required)
- `/internal/dashboard` `/internal/intel` `/internal/library` `/internal/library/triage`
- `/internal/library/split/[id]` `/internal/learn` `/internal/learn/[slug]` `/internal/learn/new`
- `/internal/tools/import` `/internal/tools/monitor` `/internal/tools/publish`
- `/internal/tools/recipe` `/internal/tools/recipe/[id]` `/internal/tools/recipe/[id]/run`
- `/internal/cart` `/internal/chat` `/internal/xiapan`

### API
- Sprint 1 新增: `/api/booking` `/api/inquiries` `/api/inquiries/[id]` `/api/clips/recent` `/api/team/dashboard` `/api/internal/stats`
- Sprint 2 新增: `/api/recipes/runs` `/api/recipes/runs/[id]` `/api/recipes/runs/[id]/edl` `/api/recipes/runs/[id]/caption` `/api/clips/match`
- 旧: 28 个 intel/* + 19 个 xiapan/*

## Sprint 5+ 待办

1. 清 dashboard/* 死文件 (10+ 个 v34 旧版本组件残留)
2. 清 intel/* 死文件 (8 个，需要确认是否仍需要)
3. 拆 hall-scene-3d.tsx 2078 行 → ≤ 500/文件
4. 加 `three-stdlib` `postprocessing` `server-only` `postcss` 进 package.json explicit deps
5. 67 unused exports 增量清

## 跑

```bash
# 跑 knip
npx knip --no-progress

# 跑 prod build
npm run build

# 看 .next/server/app size
ls -lh .next/server/app/*.js
```

## See also

- ADR-0004 (砍 ecctrl/rapier)
- `.claude/skills/fowler-refactor-catalog/SKILL.md`
- `.claude/knowledge/playbooks/r3f-pitfalls.md`
