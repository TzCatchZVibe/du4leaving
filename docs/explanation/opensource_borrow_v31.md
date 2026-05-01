# 开源借鉴清单 v31 · catchzvibe.studio MMO 工作台

> 调研时间: 2026-04-24
> 项目栈: Next.js 16 + React 19 + TS + Tailwind 4 + R3F + drei + postprocessing
> 目标: 找到能直接 fork / npm install / paste 的开源组件
>
> 难度评分 1-5: 1=npm install 立刻能用 · 5=需要 fork 后大改
> 价值评分 1-5: 1=锦上添花 · 5=能省大量时间或解锁核心玩法

---

## 1. 角色捏脸 / 捏人 (Character Creator)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **Ready Player Me Visage** | https://github.com/readyplayerme/visage | 90 | 2025-07-30 | 是 | MIT | 1 | 5 | npm `@readyplayerme/visage` · 已经是 R3F+drei 写的 · 直接 import `<Avatar/>` |
| **rpm-react-avatar-creator** | https://github.com/readyplayerme/rpm-react-avatar-creator | 43 | 2024-01-26 | ⚠️ 慢 | MIT | 1 | 5 | iframe 包装的官方 RPM 编辑器 · 拿到 GLB URL 即用 |
| **wass08/r3f-ultimate-character-configurator** | https://github.com/wass08/r3f-ultimate-character-configurator | 127 | 2024-11-02 | ⚠️ 慢 | 待 TZ 验证 | 3 | 5 | Wawa Sensei 写的完整捏人教学项目 · 从 0 自建 · 适合 MUJI 风改造 |
| **pixiv/three-vrm** | https://github.com/pixiv/three-vrm | 1.9k | 2026-04-20 | 是 | MIT | 2 | 4 | VRM 加载器 · 配 VRoid Studio 桌面端导出可用 |
| **VerseEngine/three-avatar** | https://github.com/VerseEngine/three-avatar | 28 | 2023-07-11 | 否 (3年) | MIT | 4 | 3 | VRM+RPM+Mixamo 一站式 · 但年久失修 |
| **wass08/r3f-vrm-final** | https://github.com/wass08/r3f-vrm-final | 33 | 2025-04-24 | 是 | 待 TZ 验证 | 3 | 4 | VRM 接入 R3F 完整示例 + 唇型同步 |
| Avaturn (闭源 SDK) | https://avaturn.me/ | — | — | 是 | 商业 | 2 | 4 | 自拍 → 3D · 闭源但有 Web SDK · 备选 |

**TZ 推荐路径**: RPM Visage 立刻接入 (1 天) → 体验 OK 后用 Ultimate Character Configurator 做 MUJI 风自定义版 (3-5 天)

---

## 2. 第三人称角色控制器 (Third Person Controller)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **pmndrs/ecctrl** | https://github.com/pmndrs/ecctrl | 702 | 2025-07-13 | 是 | MIT | 1 | 5 | 官方推荐 · 浮空胶囊 + Rapier · npm `ecctrl` 直接用 · 支持 idle/walk/run/jump 动画状态机 |
| **wass08/r3f-3rd-person-controller-final** | https://github.com/wass08/r3f-3rd-person-controller-final | 54 | 2024-06-21 | ⚠️ 慢 | 待 TZ 验证 | 2 | 5 | Wawa Sensei 教程产物 · 简洁易改 · 注释清楚 |
| **wass08/r3f-3rd-person-controller-minimap** | https://github.com/wass08/r3f-3rd-person-controller-minimap | 13 | 2025-07-04 | 是 | 待 TZ 验证 | 2 | 5 | 上面那个 + 小地图 · 一石二鸟 |
| **ErdongChen-Andrew/CharacterControl** | https://github.com/ErdongChen-Andrew/CharacterControl | 397 | 2025-07-13 | 是 | MIT | 2 | 4 | ecctrl 作者本人的扩展 demo · 可参考 |
| **icurtis1/character-controller-sample-project** | https://github.com/icurtis1/character-controller-sample-project | 35 | 2025-05-14 | 是 | ⚠️ 无 license | 3 | 4 | R3F + Rapier + 移动端支持 + 后处理 · 集成度高 |
| **mannynotfound/react-three-third-person** | https://github.com/mannynotfound/react-three-third-person | 29 | 2022-10-10 | 否 (3年+) | ⚠️ 无 license | 4 | 2 | 已过时 · 只看思路 |
| pmndrs/BVHEcctrl | https://github.com/pmndrs/BVHEcctrl | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 2 | 4 | ecctrl 的 BVH 加速版 · 性能更好 |

**TZ 推荐路径**: 现有手写 → 直接换 ecctrl (有现成动画状态机) · 比自写跟手 80%

---

## 3. NPC 对话系统 (Dialogue System)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **YarnSpinnerTool/YarnSpinner** | https://github.com/YarnSpinnerTool/YarnSpinner | 2.7k | 2026-04-21 | 是 | MIT | 4 | 5 | 业界标准 · Night in the Woods/A Short Hike 都用它 · 主要 C# 但有 JS 解析器 |
| **mnbroatch/react-dialogue-tree** | https://github.com/mnbroatch/react-dialogue-tree | 11 | 2025-06-26 | 是 | ⚠️ 无 license | 2 | 4 | React 组件 + Yarn 语言解析 + Bondage.js · 直接显示对话框 |
| **IkeB108/Yarn-Spinner-Javascript-Library** | https://github.com/IkeB108/Yarn-Spinner-Javascript-Library | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 3 | 4 | Yarn → 纯 JS 对象 · 自己做 UI |
| **tigerplush/disco_yarn** | https://github.com/tigerplush/disco_yarn | 4 | 2024-10-09 | ⚠️ 慢 | Apache-2.0 | 4 | 3 | 极乐迪斯科风 · 但是 Bevy/Rust 写的 · 只能借鉴视觉 |
| **ssethsara/react-three-npc** | https://github.com/ssethsara/react-three-npc | 12 | 2024-03-01 | ⚠️ 慢 | MIT | 3 | 3 | NPC AI 行为 (yuka.js) · 不是对话 UI 是巡逻/追踪 |
| **RSamaium/RPG-JS** | https://github.com/RSamaium/RPG-JS | 1.6k | 2026-04-06 | 是 | MIT | 5 | 3 | TS 写的 RPG 框架 · 自带对话/HUD · 但 2D 为主 · 不直接配 R3F |

**TZ 推荐路径**: 对话框 UI 用 react-dialogue-tree + 自己加打字机 effect (Framer Motion 项目已有 motion 包) · 内容用 Yarn 语法编写

---

## 4. 3D 城镇 / 室内场景生成器 (Procedural City)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **jstrait/city-tour** | https://github.com/jstrait/city-tour | 84 | 2026-02-18 | 是 | MIT | 4 | 3 | 程序化城市 · WebGL 原生不是 R3F · 算法可以 fork |
| **photonlines/Procedural-City-Generator** | https://github.com/photonlines/Procedural-City-Generator | 46 | 2019-03-23 | 否 (老) | ⚠️ 无 | 4 | 2 | Perlin noise 城市块 · 老但思路清楚 |
| **1391819/interactive-low-poly-environment** | https://github.com/1391819/interactive-low-poly-environment | 13 | 2023-06-12 | ⚠️ 老 | MIT | 4 | 2 | low poly 风格 · 但是个 demo 不是库 |
| **Quaternius (asset 库)** | https://quaternius.com/ | — | 持续 | 是 | CC0 | 1 | 5 | **MUJI 风福音** · 几千个 low-poly 模型 · 角色/家具/建筑/植物 · 免费商用零附加 |
| **Kenney.nl (asset 库)** | https://kenney.nl/ | — | 持续 | 是 | CC0 | 1 | 5 | 4w+ 资产 · 整个游戏可以拼出来 · 必备 |
| **awesome-cc0** | https://github.com/madjin/awesome-cc0 | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 1 | 4 | CC0 资源大全索引 |

**TZ 推荐路径**: 别用程序化生成 (审美难控) · 直接 Quaternius + Kenney 拼搭 · 要 MUJI 暖色把模型材质统一改 toon shader

---

## 5. 任务系统 / Quest

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| (无现成 R3F 任务库) | — | — | — | — | — | 5 | — | 主流方案是 Zustand/Redux 自己存 quest state |
| **YarnSpinner 的 Variable Storage** | https://github.com/YarnSpinnerTool/YarnSpinner | 2.7k | 2026-04-21 | 是 | MIT | 3 | 4 | 用 Yarn 的变量系统当 quest tracker · 一举两得 |
| **wass08/r3f-ai-language-teacher** | https://github.com/wass08/r3f-ai-language-teacher | 134 | 2024-03-12 | ⚠️ 慢 | 待 TZ 验证 | 3 | 3 | 含进度/评分的 R3F 项目 · 借鉴 progression UI |
| Framer Motion (level up 动画) | https://github.com/motiondivision/motion | 待 TZ 验证 | 待 TZ 验证 | 是 | MIT | 1 | 4 | 项目已有 `motion` 包 · 直接拿来做 level up / achievement 弹窗 |

**TZ 推荐路径**: 自己 Zustand store + Framer Motion 弹窗 · 1 天能写完 · 不要找现成 lib

---

## 6. 物品栏 / Inventory

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **pmndrs/uikit** | https://github.com/pmndrs/uikit | 3.1k | 2026-03-11 | 是 | NOASSERTION | 2 | 5 | **重磅** · WebGL 渲染的 UI · 在 3D 场景里直接画 hotbar/inventory · MUJI 风超级合适 |
| **niccolofanton/DraggableRigidBody** | https://github.com/niccolofanton/DraggableRigidBody | 37 | 2024-09-18 | ⚠️ 慢 | ⚠️ 无 license | 2 | 3 | 物理拖拽 · drei + Rapier · 适合 3D 物品交互 |
| **codingwepper/Redm-Inventory-UI** | https://github.com/codingwepper/Redm-Inventory-UI | 0 | 2022-04-29 | 否 | GPL-3.0 | 4 | 2 | RDR 风 inventory · GPL 不友好 · 只看 UI |
| **yalsayid/react-three-drag-controls** | https://github.com/yalsayid/react-three-drag-controls | 1 | 2024-02-19 | 否 | ⚠️ 无 | 3 | 1 | 太冷门不推荐 |
| dnd-kit (HTML 拖拽) | https://github.com/clauderic/dnd-kit | 待 TZ 验证 | 待 TZ 验证 | 是 | MIT | 1 | 4 | 项目已有 cmdk 风格 · 这个搭 dock/hotbar 在 HTML 层面是黄金选择 |

**TZ 推荐路径**: hotbar 用 HTML+dnd-kit (盖在 Canvas 上) · 3D 内 inventory 用 uikit · 两套并行

---

## 7. 多人在线 (Multiplayer)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **PlayroomKit** | https://docs.joinplayroom.com/ + https://github.com/grayhatdevelopers/awesome-playroom | 17 (awesome) | 持续 | 是 | 商业(免费层) | 1 | 5 | **零配置多人** · 上手最快 · 适合 MVP · 已有 R3F 模板 |
| **wass08/r3f-playroom-multiplayer-shooter-game** | https://github.com/wass08/r3f-playroom-multiplayer-shooter-game | 62 | 2024-03-15 | ⚠️ 慢 | 待 TZ 验证 | 2 | 5 | R3F + Playroom 完整 demo · 抄就完事了 |
| **wass08/r3f-sims-online-final** | https://github.com/wass08/r3f-sims-online-final | 43 | 2023-09-22 | ⚠️ 老 | 待 TZ 验证 | 3 | 4 | Sims 风社交 + 多人 · 跟 catchzvibe 思路最近 |
| **colyseus/colyseus** | https://github.com/colyseus/colyseus | 6.9k | 2026-04-24 | 是 | MIT | 4 | 5 | 自托管/可控 · authoritative server · 长期方案 |
| **majidmanzarpour/vibe-coding-starter-pack-3d-multiplayer** | https://github.com/majidmanzarpour/vibe-coding-starter-pack-3d-multiplayer | 288 | 2026-02-25 | 是 | MIT | 2 | 4 | Three.js + React + SpacetimeDB · 比较新 |
| **juniorxsound/THREE.Multiplayer** | https://github.com/juniorxsound/THREE.Multiplayer | 229 | 2023-02-03 | 否 | MIT | 3 | 3 | Socket.io 经典模板 · 老但思路通 |
| Liveblocks (presence only) | https://liveblocks.io/ | — | 持续 | 是 | 商业 | 1 | 3 | 不适合实时 3D 同步 (太贵) · 适合做 cursor/presence |

**TZ 推荐路径**: Phase 1 用 Playroom (今天就能跑) · Phase 2 (>50 同时在线) 迁 Colyseus 自托管

---

## 8. 声音 / SFX

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **goldfire/howler.js** | https://github.com/goldfire/howler.js | 25k | 2025-11-23 | 是 | MIT | 1 | 5 | 业界标准 · 7KB · 支持 sprite/精灵图音频 |
| **joshwcomeau/use-sound** | https://github.com/joshwcomeau/use-sound | 3.1k | 2025-06-10 | 是 | MIT | 1 | 5 | React Hook 包装 howler · 一行代码 `const [play] = useSound(url)` |
| **thangngoc89/react-howler** | https://github.com/thangngoc89/react-howler | 378 | 2024-08-19 | ⚠️ 慢 | MIT | 1 | 4 | 类组件风格 · 不如 use-sound 好 |
| **Kenney UI Audio** | https://kenney.nl/assets/ui-audio | — | 持续 | 是 | CC0 | 1 | 5 | 50+ UI 音效 · 全免费 |
| **Calinou/kenney-ui-audio (打包)** | https://github.com/Calinou/kenney-ui-audio | 19 | 2020-12-06 | 是 | NOASSERTION | 1 | 4 | 已打包好的 Kenney UI · clone 即用 |
| **OpenGameArt CC0 Sounds Library** | https://opengameart.org/content/cc0-sounds-library | — | 持续 | 是 | CC0 | 1 | 4 | 大量 footstep/impact · 免费商用 |
| **Freesound** | https://freesound.org/ | — | 持续 | 是 | CC0/CC-BY | 1 | 4 | 60w 音效库 · 注意 license 过滤 |

**TZ 推荐路径**: `npm i use-sound` + Kenney UI Audio + Freesound 几条 footstep · 半天搞定全套音效

---

## 9. 物理 / 碰撞 (Physics)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **pmndrs/react-three-rapier** | https://github.com/pmndrs/react-three-rapier | 1.4k | 2025-11-03 | 是 | MIT | 2 | 5 | **现代首选** · Rapier WASM · 性能远超 cannon · 与 ecctrl 完美配合 |
| **pmndrs/use-cannon** | https://github.com/pmndrs/use-cannon | 2.9k | 2024-02-25 | ⚠️ 慢 (1年多没更新) | ⚠️ 无 license | 2 | 3 | cannon-es 包装 · 比 rapier 老 · 不推荐新项目 |

**TZ 推荐路径**: 直接 react-three-rapier · 8 栋楼 + 角色碰撞够用

---

## 10. 后处理特效 (Post-processing)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **pmndrs/react-postprocessing** | https://github.com/pmndrs/react-postprocessing | 1.3k | 2025-02-20 | 是 | MIT | 1 | 5 | 项目已经在用 (`@react-three/postprocessing`) · 文档全 |
| **wass08/r3f-scene-transition-starter** | https://github.com/wass08/r3f-scene-transition-starter | 13 | 2023-12-01 | ⚠️ 老 | 待 TZ 验证 | 3 | 4 | Wawa 写的 scene transition · 配套教程在 |
| **wass08/r3f-mesh-portal-material** | https://github.com/wass08/r3f-mesh-portal-material | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 3 | 4 | portal 进入楼内动画 · 适合 8 栋楼切换 |
| **wass08/wawa-vfx** | https://github.com/wass08/wawa-vfx | 132 | 2025-09-23 | 是 | MIT | 2 | 5 | **粒子+VFX 引擎** · GPU 加速 · 命中/技能/收集动画都靠它 |
| **wass08/r3f-godrays** | https://github.com/wass08/r3f-godrays | 10 | 2025-08-22 | 是 | MIT | 2 | 3 | 体积光 · MUJI 风暖色阳光神器 |
| **0beqz/screen-space-reflections** | https://github.com/0beqz/screen-space-reflections | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 待 TZ 验证 | 3 | 3 | SSR 反射 · 实木地板高级感 |

**TZ 推荐路径**: 已有 react-postprocessing → 加 wawa-vfx (粒子) + r3f-godrays (阳光) · MUJI 暖色立刻拉满

---

## 11. 地图 / 迷你地图 (Minimap)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **wass08/r3f-3rd-person-controller-minimap** | https://github.com/wass08/r3f-3rd-person-controller-minimap | 13 | 2025-07-04 | 是 | 待 TZ 验证 | 2 | 5 | **直接 fork** · 角色控制器 + 小地图 · 第二相机俯视 + viewport 渲染 |
| **drei `<View>`** | https://github.com/pmndrs/drei | 9.6k | 2026-03-23 | 是 | MIT | 1 | 4 | 项目已有 drei · 用 `<View>` + `<OrthographicCamera>` 自己拼 minimap |
| RodrigoHamuy/react-three-map | https://github.com/RodrigoHamuy/react-three-map | 314 | 2025-04-23 | 是 | MIT | 3 | 2 | Mapbox 集成 · 真实地理地图 · catchzvibe 用不上 |
| Ascold2017/ThreeJS-Radar | https://github.com/Ascold2017/ThreeJS-Radar | 0 | 2023-02-24 | 否 | ⚠️ 无 | 5 | 1 | 太冷门不推荐 |

**TZ 推荐路径**: fork wass08/r3f-3rd-person-controller-minimap · 抄 minimap 部分 · 改成 8 栋楼俯视图

---

## 12. 天气 / 昼夜 (Weather / Day-Night)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **drei `<Sky/>` + `<Environment/>`** | https://github.com/pmndrs/drei | 9.6k | 2026-03-23 | 是 | MIT | 1 | 5 | 项目已有 · `<Sky distance/sunPosition/>` 直接做昼夜 |
| **rauschermate/react-weather-effects** | https://github.com/rauschermate/react-weather-effects | 34 | 2025-07-08 | 是 | MIT | 2 | 4 | 雨/雪/雾 WebGL · Next.js 兼容 |
| **JiangWeixian/threejs-weather** | https://github.com/JiangWeixian/threejs-weather | 64 | 2023-11-10 | 否 (1年+) | MIT | 2 | 3 | 配 R3F 的 npm 包 `threejs-weather` |
| **jeromeetienne/threex.daynight** | https://github.com/jeromeetienne/threex.daynight | 33 | 2020-02-21 | 否 (老) | MIT | 4 | 2 | 老旧 · 思路可借鉴不要直接用 |

**TZ 推荐路径**: drei `<Sky>` + 自己写 sun rotation animation · 雨雪用 react-weather-effects 单独叠加

---

## 13. 角色动画 / IK

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **drei `useAnimations` + `useGLTF`** | https://github.com/pmndrs/drei | 9.6k | 2026-03-23 | 是 | MIT | 1 | 5 | 项目已有 · 加载 GLTF + 自动注册 actions |
| **pmndrs/gltfjsx** | https://github.com/pmndrs/gltfjsx | 待 TZ 验证 | 待 TZ 验证 | 是 | MIT | 1 | 5 | CLI: `npx gltfjsx model.glb` 自动生成 R3F 组件 + animations |
| **Mixamo (闭源)** | https://www.mixamo.com/ | — | 持续 | 是 | 免费商用 | 1 | 5 | Adobe 出品 · 上传 GLB → 自动绑骨 + 几百个动画 |
| **wass08/threejs-r3f-tutorial-animations** | https://github.com/wass08/threejs-r3f-tutorial-animations | 15 | 2022-11-25 | ⚠️ 老 | 待 TZ 验证 | 2 | 4 | Mixamo → R3F 完整教程项目 |
| **MantieReid/mixamo-animation-combiner** | https://github.com/MantieReid/mixamo-animation-combiner | 24 | 2020-08-30 | 否 (老) | MIT | 2 | 3 | 把多个 Mixamo 动画合并到一个 GLTF · 减小文件 |
| **wass08/wawa-lipsync** | https://github.com/wass08/wawa-lipsync | 167 | 2025-11-07 | 是 | MIT | 2 | 4 | 唇型同步 · 与音频联动 · NPC 说话神器 |
| Mesh2Motion | https://mesh2motion.org/ | — | 持续 | 是 | 免费 | 1 | 3 | 浏览器内自动绑骨 · Mixamo 替代 |

**TZ 推荐路径**: 用 Mixamo 鸡蛋了 · 上传 RPM 角色 → 选 idle/walk/run/jump/wave → gltfjsx 转 R3F 组件 → drei `useAnimations` 播放

---

## 14. UI 工具 (Game UI)

| 名字 | GitHub URL | stars | 最后更新 | maintained | License | 难度 | 价值 | 备注 |
|---|---|---|---|---|---|---|---|---|
| **pmndrs/uikit** | https://github.com/pmndrs/uikit | 3.1k | 2026-03-11 | 是 | NOASSERTION | 2 | 5 | 3D 内 UI 神器 (再次出现) |
| **psychobolt/react-pie-menu** | https://github.com/psychobolt/react-pie-menu | 46 | 2026-04-08 | 是 | MIT | 2 | 4 | 配置化 radial menu · 还在维护 |
| **spaceymonk/react-radial-menu** | https://github.com/spaceymonk/react-radial-menu | 21 | 2025-10-01 | 是 | ⚠️ 无 license | 2 | 3 | 子菜单/动画支持 · 但 license 缺失 |
| **Antho2407/react-radial-menu** | https://github.com/Antho2407/react-radial-menu | 41 | 2023-03-01 | 否 (3年) | MIT | 3 | 2 | 老 · 不推荐 |
| **shadcn/ui (HTML 层)** | https://ui.shadcn.com/ | — | 持续 | 是 | MIT | 1 | 5 | 项目已有 cmdk · shadcn 风格 dock/menu/dialog 都很合适 MUJI 风 |
| **cmdk (项目已有)** | https://github.com/pacocoursey/cmdk | 待 TZ 验证 | 待 TZ 验证 | 是 | MIT | 1 | 4 | 命令面板 · 适合 MMO 快捷指令 (`/help`, `/teleport`) |

**TZ 推荐路径**: dock 用 shadcn · 3D 内菜单用 uikit · radial menu 用 react-pie-menu (5 分钟接入)

---

## 特别关注 · 中文 / 亚洲审美 R3F 资源

| 名字 | GitHub URL / 链接 | stars | 备注 |
|---|---|---|---|
| **Wawa Sensei (法国 + 日系审美)** | https://github.com/wass08 | 个人 ~30+ 仓库 | 30+ R3F 仓库 · 风格干净·色调温暖 · 跟 MUJI 风很搭 |
| **wass08/wawa-coastal-aesthetics** | https://github.com/wass08/wawa-coastal-aesthetics | 11 | 海岸美学 · 暖色调直接抄 |
| **wass08/r3f-sims-online** | https://github.com/wass08/r3f-sims-online | 27 | Sims 风社交 · 跟 catchzvibe 调性最近 |
| Bilibili R3F 中文教学 | https://www.bilibili.com/video/BV1ghxaeAEpi/ | — | 中文字幕 R3F 完整教程 (Wawa 翻译版) |
| **pmndrs/viverse** | https://github.com/pmndrs/viverse | 124 | 2026-01-11 · pmndrs 出品的 VIVERSE 工具包 · HTC 元宇宙生态 |
| (国内原创 R3F 项目) | — | — | **暂未找到亚洲团队主导的 starred R3F 游戏项目** · 待 TZ 验证 |

---

# 最后总结 (200 字内)

## Top 5 立刻拿来用 (今晚就能接入)

1. **pmndrs/ecctrl** (702★) — 替换自写第三人称控制器 · `npm i ecctrl` 30 分钟搞定
2. **drei `<Sky>` + `useAnimations`** (9.6k★) — 已有 drei · 直接调用 · 0 安装成本
3. **joshwcomeau/use-sound + Kenney UI Audio** (3.1k★ + CC0) — 半天上齐音效
4. **Ready Player Me Visage** (90★) — 角色捏脸 1 天接入 (TZ 点名要的)
5. **wass08/r3f-3rd-person-controller-minimap** (13★) — fork 了直接抄 minimap + controller

## Top 5 高价值但难度大 (规划阶段)

1. **pmndrs/uikit** (3.1k★) — 3D 内 UI 神器 · MUJI 风全套 hotbar/inventory · 学习曲线 1 周
2. **YarnSpinner + react-dialogue-tree** — 完整对话/任务/支线引擎 · 但要先学 Yarn 语法
3. **colyseus** (6.9k★) — 自托管多人 · 要 Phase 2 替换 Playroom · 需要 Node 后端
4. **wass08/r3f-ultimate-character-configurator** (127★) — MUJI 风自定义捏人 · 要重写 UI
5. **wawa-vfx + r3f-godrays + react-postprocessing** — 视觉拉满 · 但调参周期长

## Fork 后改改就能用 (3-5 天可上线)

- **wass08/r3f-3rd-person-controller-minimap** — 改美术资产即可
- **wass08/r3f-playroom-multiplayer-shooter-game** — 抄网络层 + Playroom 配置
- **wass08/r3f-sims-online-final** — 改场景为 8 栋楼 · 风格调成 MUJI
- **majidmanzarpour/vibe-coding-starter-pack-3d-multiplayer** — 完整 starter · 改美术
- **Quaternius + Kenney 资产库** — 不用 fork · 直接下载拼搭

---

## 待 TZ 验证 / 注意事项

- ⚠️ pmndrs/uikit · pmndrs/viverse · grayhatdevelopers/awesome-playroom 都标 `NOASSERTION` license — 需要 TZ 看仓库 LICENSE 文件确认是否能商用
- ⚠️ 几个 wass08 仓库没明确 license — 用之前问 Wawa 或贴他署名
- ⚠️ Yarn-Spinner-Javascript-Library / pmndrs/BVHEcctrl / pmndrs/gltfjsx / 0beqz/screen-space-reflections / cmdk 等仓库本次没单独拉 metadata · 标 "待 TZ 验证"
- ⚠️ AGENTS.md 提示 Next.js 16 有 breaking changes — 接 SDK 时要看 `node_modules/next/dist/docs/`
- ⚠️ 中国大陆开发者主导的 R3F 游戏项目本次未找到突出 starred 仓库 · 大部分中文 R3F 内容是教程/翻译 (Bilibili/CSDN) · 需要后续单独走小红书/掘金/微信再调研
