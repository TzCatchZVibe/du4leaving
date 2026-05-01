# CatchZVibe · 接续 handoff
> 给新 Claude Code 会话用 · 复制下面那段贴进去就能接上

---

## 一句话粘贴版（Copy 这个就行）

```
继续 CatchZVibe Studio 项目。读 ~/catchzvibe/HANDOFF.md 和 ~/catchzvibe/docs/产品全景图_v1.md 全文，再读相关记忆 (project_catchzvibe_独立站架构 / project_catchzstudio_角色分工 / project_hg_client_detail / feedback_全可视化沟通 / feedback_系统优先 / user_aesthetic_profile / user_tz_cognitive_profile)。然后告诉我现在做到哪一步、下一步该做什么，等我确认。
```

---

## 项目位置

| 项 | 值 |
|---|---|
| 代码 | `~/catchzvibe` |
| 老 Electron 原型（已废）| `~/CatchZStudio` |
| Dev 服务器 | `npm run dev --port 3001` · `localhost:3001` |
| Tech stack | Next.js 16 + Tailwind 4 + Supabase + Lenis + motion |

---

## 已经搞完的（v1 进度 · ~25%）

### 设计 + 战略
- 完整产品全景图 13 章 · 4 类用户 · 6 福利 · 7 HG 账号 · 43 菜谱 · 北极星
- 构成主义 × MUJI 视觉 DNA · 顶级动效（Bebas + 红圆 + 黑条 + 对角条 + Lenis 平滑滚动）

### 已上线页面
- 对外 7 页 · `/` `/about` `/portfolio` `/services` `/booking` `/[member]` `/wholesale`
- 摄影师子站 · `/tz` `/fri` `/hank`
- 登录 · `/login`（真接通 Supabase auth）
- 对内 9 模块 · `/internal/dashboard` `/internal/intel` `/internal/library` `/internal/learn` `/internal/chat` `/internal/tools/recipe` `/internal/tools/import` `/internal/tools/publish` `/internal/tools/monitor`
- 菜谱详情 · `/internal/tools/recipe/[id]` · 真渲染 C-03 / O-01 数据

### Supabase 已就绪
- Project ref · `cguncazbdeiwdjhhtyud`
- 6 表 · profiles · clips · wiki_pages · recipe_runs · wholesale_orders · publish_queue
- RLS 策略已修（用 `current_user_role()` 函数避递归）
- Storage bucket `assets` · 公开 · 50MB · jpg/png/webp/mp4/mov
- Storage RLS · 登录可上传 · 公开可读
- 3 个黄金会员 · `tz/fri/hank @catchzvibe.studio` · 密码 `Tomou5426024!`
- `.env.local` 已有 3 个 key

### 数据资产
- 43 菜谱 + 16 海报变体 JSON · `~/catchzvibe/src/data/recipes/`
- 投流学院 7500 字 · `~/catchzvibe/src/data/docs/`
- 产品全景图 v1 · `~/catchzvibe/docs/产品全景图_v1.md`

---

## 下一步该做什么

### Week 3-4 · `/library` 真功能（最优先）

- 上传后 clips 表已有记录
- 缺：6 字段打标 UI（点 clip → 弹出标签编辑器 → 改 category/sub_category/brand/participant/quality/uses）
- 缺：按字段 filter 查询
- 缺：网格视图（已有 `LibraryGrid` 组件框架，要完善）
- 缺：AI 自动打标接 Qwen3-VL（`~/.openclaw/.env` 有 key）

### Week 5-6 · `/tools/recipe` 接 Supabase
- C-03 详情页已能读 JSON
- 缺：进入 slot 模式 · 从 clips 表筛候选 · 拖入 slot
- 缺：保存为 recipe_run · 导出 EDL

### Week 7-8 · `/learn` 自建 wiki
- TipTap 编辑器
- Meilisearch 搜索
- 迁入投流学院 + 菜谱 playbook

### Week 8-9 · `/intel` 文明 6 dashboard
- 接 Apify 数据
- 世界地图 / 技术树 / 时代时间线 真数据

### Week 9 · 黄金冠名号子站自动化
- `/[slug]` 已有 · 现在写死 tz/fri/hank
- 改成从 profiles 表读 handle 自动生成

### Week 10 · 打磨 + 上线 catchzvibe.studio

---

## 关键约束（务必遵守）

1. **视觉沟通** · 表格/卡片/ASCII 图 · 禁大段文字（TZ 是艺术家 · ADHD）
2. **构成主义 × MUJI** · 暖纸底 + Rodchenko 红 + Bebas Neue · 已锁
3. **北极星** · 工作只在「相机 + 独立站」两处完成
4. **系统优先** · 不是发内容（feedback_系统优先）
5. **预算** · AI 月 $150-200 · Claude Max 已付 $200
6. **Hank 跨境** · 国内访问 · web app 友好

---

## 已知坑

- Next.js 16 · `middleware` 改名 `proxy` · 用 `proxy.ts` + `function proxy(request)`
- React 19 · Tailwind 4 · 别用 v3 思路
- JSON 文件里 Chinese 文本里有 `"..."` 引号要去掉（之前 peel-pop.json 翻车）
- 字体 · `font-display` (Bebas) · `font-serif` (Cormorant italic) · `font-mono` (JetBrains) · `font-cjk` (Noto Sans SC)

---

## TZ 个人偏好（重要）

- ADHD + INFP · 艺术家 · 视觉强 · 文字弱
- ≤3 行段落 · 一决策一消息
- 美学：MUJI 暖纸 × Rodchenko 红 × Notion sidebar × 手绘铅笔质感
- 反感：大段文字 · 套话 · 装文艺 · 鸡汤
- 喜欢：苏格拉底问 1-2 句就动手 · 奥卡姆削复杂

---

## 团队 3 人

| 角色 | 职责 |
|---|---|
| **TZ** | 系统维护 + 策略 + AI · admin 全权 |
| **Frida** | 辅拍 + AI 海报 + 导素材 + 发布 |
| **Hank** | 剪辑 + 素材库（国内） |
