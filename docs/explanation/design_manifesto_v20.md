# CatchZVibe 设计宣言 · v20

> **一句话核心** · 让屏幕前的人 · 鸟瞰整个世界 · 用手工的细腻 · 感受人是目的

> **TZ 原话锚点** (2026-04-24)
> - "我希望在操作这个界面能明显让使用者感觉到他是在鸟瞰整个世界的感觉"
> - "必须用 ai 做出非常手工的东西来极端化体现 · 但是可读性非常重要"
> - "人才是目的 · 屏幕前使用的人的需求才是目的"
> - "整个工作系统可以用网游的方式去做 · 动效各方面要和游戏一样等级"

---

## 1 · 三大根基

| 根基 | 关键词 | 反义 |
|------|--------|------|
| **鸟瞰世界** | 飞机/船/海/云/昼夜/卫星 在动 · 一眼看见地球在运转 | 静态死图 / 仪表盘 / 数字面板 |
| **极端手工** | SVG 颤抖边/纸张颗粒/手写 3 层字体/笔触 | 几何方块 / 平面无情感 / Material 默认 |
| **人是目的** | 可读性高于一切 · 信息为人服务 · 不是数据堆砌 | 工具化 / 数据炫技 / 把人当流量 |

> 三者关系 · **鸟瞰提供场景** + **手工提供质感** + **人是目的提供方向** · 缺一不可。

---

## 2 · 设计决策十检 · 每个新功能必问

每加一个组件 / 视觉元素 / 文案 · 走一遍这十问 · 答不上就重做:

```
1.  这是把 TZ 当人还是当工具?
2.  鸟瞰感是被加强还是被破坏?
3.  手工质感是被加强还是被压平?
4.  可读性受影响吗 (任何花哨损害读字 · 砍)
5.  动效服务于体验沉浸 · 还是只为炫技?
6.  情绪是温度的 · 还是冰冷的?
7.  比例 · 间距 · 留白 · 给人呼吸吗?
8.  这是网游级别的精细 · 还是工具软件级别的应付?
9.  视觉层级三层手写体 (OS / 地图 / 新闻) 是否区分清楚?
10. 在 5 米外副屏看 · 一眼能 get 重点吗?
```

---

## 3 · 表达层 (5 个手段 · 都为根基服务)

### 3.1 字体 · 三层手写体系

```
L1 OS 框架   ZCOOL XiaoWei      现代楷书工整     侧栏 · 菜单 · 系统 chip
L2 地图层    LXGW WenKai 霞鹜文楷  手工楷体高可读   国名 · 城名 · 地理标识
L3 新闻表达  Ma Shan Zheng       粗壮毛笔表达     标题 · 引语 · 重要陈述
备用层       Long Cang           大字标识         极少用 · 只做角落 accent
英文配套     Inter / Cormorant   现代衬线         数字 · 拉丁文混排
```

### 3.2 色彩 · 暖纸 + 工艺金 + 警示红 + 鼠尾草绿

```
基底       paper #f1ebdc + paper-bright #f7f2e6   像旧手账本
墨         ink #111111                              清晰但不冰冷黑
工艺金     intel-gold #c9a961                       装饰角条 · 浮雕
警示红     intel-alert #8b2e2e                      MUJI 风暖红 · 不刺眼
鼠尾草绿   intel-up #6a8a6e                         积极指标 · 柔和
钢蓝       intel-data #3c5a7a                       数据/链接 · 冷静
```

### 3.3 动效 · 网游级别 · 服务"鸟瞰"

```
✓ 海洋粒子呼吸          opacity 0→0.85→0 · scale 0.6→1.4 · 2.5-5s loop
✓ 飞机移动              60s SWR + 50ms 线性外推 · 沿 heading 旋转
✓ 卡片浮动入场          AnimatePresence layout · slide+fade 0.4s ease-out
✓ Pin 选中 → 地图 pan   spring · setCenter + zoom 3.2 · 平滑过渡
✓ Sims 圆角 + 浮影      sims-shadow-pop / sims-radius-lg · 不平 · 有重量
✗ 没有硬切                snap cut → 一律 cubic-bezier(.2,.9,.3,1)
✗ 没有商业 BREAKING      所有提示都温和 · 不打扰
```

### 3.4 笔触 · 手工感的物理体现

```
✓ SVG hand-drawn-edge filter   feTurbulence 0.025 + Displacement 1.3 · 国界颤抖
✓ paper-grain filter           rgba grain 9% alpha · 海洋叠纸纹
✓ 手写字体真笔锋
✓ 装饰角条 (FocusCard 金铜角)
✗ 没有几何纯净 (没有 Material flat)
```

### 3.5 声 · BGM + sfx (规划中)

```
🔜 BGM 双入口
   - 灵动岛 (聚焦模式 顶部胶囊)
   - 工作室音乐台 (侧栏底大组件 · Spotify+Apple+网易云融合 · 复古未来)
🔜 曲库 · Nujabes / Re:plus / Chillhop / Lo-Fi 30+ 真实曲
🔜 sfx · click / hover / select · 极轻 · 不打扰
```

---

## 4 · 已落地的实现 (按时间)

| 版本 | 主题 | 落地 |
|------|------|------|
| v15 | Sims 亮色 + 圆角浮影 | sims-radius / sims-shadow / 暖纸基底 |
| v16 | 真世界地图 + 国家中文名 | Equal Earth + LXGW 字体 |
| v17 | OG image + 多源图片 | event-image route 多 fallback |
| v18 | 5W 标题重写 + 上下文 hint | rewrite-title GPT-4o-mini |
| v19 | 3 层手写字体 + 中英双语 + 砍等级 | LanguageProvider / ZCOOL XiaoWei + LXGW + Ma Shan Zheng |
| v20 | 25 RSS 源覆盖 11 topic | rss-batch route + intel-rss-feeds.ts |
| v20.1 | SVG 手绘 filter + 聚焦地名防遮 | hand-drawn-edge + paper-grain · 一国一名 |
| v20.2 | LiveFeed + 海洋呼吸 + 全屏 | live-feed.tsx + ocean sparkles + main flex |
| v20.3 | 飞机实时航班层 | OpenSky API + flight-layer.tsx |

---

## 5 · 路线图 (按"鸟瞰人文"优先级)

### v20.4-v20.7 · 鸟瞰层完善 (1-2 天)

```
[ ] 船只实时 (AIS public · 或起 NOAA mock)
[ ] 晨昏分界线 (sun terminator · 实时太阳照射)
[ ] 云层飘移 (西向东 · 低 opacity)
[ ] 事件墨晕入场 (新 pin SVG radial reveal 不硬弹)
[ ] ISS 卫星轨迹 (NASA open API)
```

### v21 · BGM 双入口 (1 天)

```
[ ] BgmContext 全局状态
[ ] DynamicIsland 顶部胶囊播放器 (聚焦模式)
[ ] StudioStation 侧栏底大音乐台 (复古未来主义)
[ ] YouTube IFrame · Nujabes/Re:plus 曲库
[ ] Beat scheduler 让聚焦切换卡鼓点
```

### v22 · 信息源穷尽 (持续)

```
[ ] research agent 全球新闻平台盘点 doc
[ ] 接 100+ RSS · 50+ 国家 · 每秒新事件
[ ] 多元视角 · 同事件多源汇聚
[ ] embedding 聚类去重
[ ] 个人博主名单 (B 方案 · 后期 TZ 选)
```

### v23 · 网游级精修 (持续)

```
[ ] Pin click 涟漪
[ ] 国家 hover 印章
[ ] 数字 odometer 滚轮
[ ] 进入聚焦模式 · 镜头推远 + 模糊
[ ] 状态机所有过渡都有反馈
[ ] sfx 配套
```

---

## 6 · 禁区 (永不做)

```
✗ Bloomberg 暗色终端                 太冰冷 · 工具化
✗ 几何抽象 hex grid                  离"人"太远
✗ BREAKING flash 弹窗                广告感 · 不温和
✗ 军工 Command Center               军感 · 不人文
✗ 战绩硬指标 ("击杀数" "通关率")     游戏化错方向 · 工具化
✗ 算法茧房推荐                       破坏多元视角
✗ 冷数据列表 (一堆英文链接)           不"知天下事" · 不中文
✗ snap 硬切动效                      没有过渡 · 工具感
✗ flat material design               没有重量 · 不手工
```

---

## 7 · 一图概括

```
                    [ 鸟瞰整个世界 ]
                          |
              飞机 · 船 · 海 · 云 · 卫星
                  在动 · 真实 · 实时
                          |
        [ 极端手工 ] ←─→ [ 人是目的 ]
            |                |
       SVG 颤抖             可读性
       手写 3 层             情感温度
       纸张颗粒              一眼 get
       手绘装饰              不打扰

                    所有动效服务这个感受
                    每个像素都问一遍十检
```

---

## 8 · 维护

- 每加一版 · 在 §4 加一行
- 每砍一个方向 · 在 §6 加一条理由
- 这份 doc 不是 spec · 是**指南针** · 决策时回来看
- TZ 反馈新核心追求 · 在 §1 顶部加一句锚点

> **生效** · v20+ · 一切设计 / code review / agent prompt 都按这个来。
