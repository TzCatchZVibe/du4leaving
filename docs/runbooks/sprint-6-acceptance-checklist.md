# Sprint 6.A · TZ 浏览器人工验收清单

> **Type**: How-to / Runbook  
> Date: 2026-04-30  
> Owner: TZ (一次性 · ~30min)

## 前置

```bash
# 启动本地
cd /Users/happyglobal_tk_team/catchzvibe
npm run dev   # localhost:3001
```

## ✅ 验收清单（按 sprint 顺序）

### Sprint 0 · 12 agent 团队基建
- [ ] 在 Claude Code 跑 `/czv-roster` → 列出 12 agent + idle
- [ ] 跑 `/czv-papers RLS` → 看到 3 命中（supabase-rls / makerkit-rls / owasp）
- [ ] 看 `.claude/agents/` 有 12 个 .md 文件
- [ ] 看 `.claude/skills/` 12 子目录
- [ ] 看 `.claude/knowledge/papers/` + `playbooks/` ≥ 33 篇

### Sprint 1.1 · Booking → Inquiries
- [ ] 浏览器开 `http://localhost:3001/booking`
- [ ] 表单 5 字段渲染正常
- [ ] 空表单点 SEND → 4 字段红色错误显示（aria-live alert）
- [ ] 填真值 → 显示 INQUIRY · RECEIVED success card + REF id
- [ ] Supabase Dashboard 查 `inquiries` 表 → 看到刚提交那条 (provenance='db')

### Sprint 1.2-1.5 · 4 Panel 接真表
**前置：** 登录到 `/internal/dashboard`（需 gold/admin profile）

- [ ] 按 **T** 键 → Quest panel 4 列看板（inbox / accepted / in_progress / delivered）
- [ ] 看到 Sprint 1.1 提交的 inquiry 在 inbox 列
- [ ] 点 inquiry 卡 → modal 显示 brief + 状态切换按钮
- [ ] 点 "🤝 → accepted" → 卡片移到 accepted 列（5s 内 SWR refresh）
- [ ] DB `inquiries.assigned_to` 写入当前 user.id

- [ ] 按 **I** 键 → Inventory panel 8×6 grid · 显示 clips 缩略图
- [ ] 上方 filter chips 点 "口播" → 仅显示 category=口播 · 其他空

- [ ] 按 **C** 键 → Character panel 显示 真 level / exp / earned / completed
- [ ] 顶部 5 个 sprint 完成（completed=任务数）

- [ ] 按 **G** 键 → Guild panel 列出全 gold/admin 成员排行 · 收益降序
- [ ] 看 notices 区显示最近 5 条 status 变化

- [ ] 开 `/internal/tools/monitor`
- [ ] 顶部 InternalStatsCard 4 tile（INQUIRIES / EARNED / CLIPS / PUBLISH）显示真数
- [ ] 下方社交 mock 区有红色 banner "MOCK · sprint 5 接 Apify"

### Sprint 2 · Recipe Slot Mode
- [ ] 开 `/internal/tools/recipe/c-01/run` → URL 自动加 `?run=<uuid>`
- [ ] 看到 7 个 slot · 各 slot 显示 FILTER 描述
- [ ] 点 slot 1 "▶ SHOW MATCHING CLIPS" → 看 quality desc 排序
- [ ] 点几个 clip → 顶部 "filled X clip" 计数变
- [ ] 点 SAVE DRAFT → 看 SAVED ✓
- [ ] 点 EXPORT EDL.TXT → 浏览器下载 `czv-c-01-<8char>.edl.txt`
- [ ] 点 AI CAPTION ×5/账号 → 30s 后右侧出现 5 条/账号

### Sprint 3 · Dashboard v37 (顶视)
- [ ] 开 `/internal/dashboard`
- [ ] 摄像机顶视 isometric (不是第三人称坠落)
- [ ] OrbitControls 拖鼠旋转 / 滚轮缩放 / 右键 pan
- [ ] 30s 不操作 → 摄像机自动慢飘 autoRotate
- [ ] 8 房间各显示门 / 招牌 / 路灯 / 暖光窗
- [ ] 草地 4000 草叶 + 浮云远景
- [ ] 1-8 数字键直跳房间路由

### Sprint 4 · 工程清扫
- [ ] 终端 `npm run build` → 通过 (5s + 5s)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] 看 `docs/` 子目录: explanation/how-to/reference/decisions/runbooks/specs

### Sprint 5 · hall-scene 拆分
- [ ] `wc -l src/components/dashboard/hall-scene-3d.tsx` → 387
- [ ] `ls src/components/dashboard/hall/` → 5 子文件
- [ ] dashboard 视觉跟 v36 一致 · 无回归

## 性能（可选 r3f-perf）

```tsx
// 临时给 hall-scene-3d.tsx 加 r3f-perf 看 draw call:
import { Perf } from "r3f-perf";
// <Canvas> 内首行加: <Perf position="top-left" />
```

期望:
- Draw calls < 100
- FPS 60 (mid laptop)
- Memory < 500 MB

## 失败回报模板

```
sprint X.Y 步骤 N 失败:
- 期望: ...
- 实际: ...
- 浏览器 console 截图 / npm run dev 日志:
```
