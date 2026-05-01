# 地图设计研究 v13 · 自然地质 + 建筑文化 + 事件 Pin

> TZ 命题 · "保留自然环境的地质特色以及建筑和文化色彩融入在地图上 但是不要杂乱"
> 研究员 · 信息可视化设计 + 地图学爱好者
> 日期 · 2026-04-24

---

## 1 · TL;DR · 一句话方向

**推荐主方向 · "Apple Maps Sim × Stamen Watercolor × 古卷手绘"三合一**

- 底图 · 低饱和度 hillshade raster (写实地形) + 水彩暖纸纹理 (抗杂乱的视觉胶水)
- 地标 · 分层 emoji/SVG 图标 (不是 3D 建模 · 保持轻量和统一)
- 文化 · 大色块"文化区"以极低透明度铺底 · zoom out 才明显 · zoom in 隐去

**核心判断 · 不杂乱的关键不是"少画"而是"分层"** · 让底图永远是背景墙、地标永远是中景、事件 Pin 永远是主角。

---

## 2 · 8 款最值得借鉴的地图

### 2.1 · Stamen Watercolor · https://maps.stamen.com/watercolor/

**视觉关键词** · 水彩手绘 · 纸质纹理 · 边缘有机晕染 · 暖色主导

**色彩策略** · 全域暖黄 / 浅褐 / 藕粉 / 雾蓝 · 饱和度压到 30-40% · 像老地图被茶渍浸过。

**地形处理** · 不画 hillshade · 用色块分水/陆/绿地 · 靠纸纹和晕染暗示地貌。

**建筑显示** · 全隐。这是纯底图风。

**对 TZ 的借鉴点** · 这是"不杂乱"的极端典范 · 作为 baseline 底图纹理太适合了 · 叠加 pin 时 pin 永远最亮。

---

### 2.2 · Stamen Toner · https://maps.stamen.com/toner/

**视觉关键词** · 黑白高对比 · 极简 · 只剩骨架

**色彩策略** · 纯黑白 · 用于做叠层底图。

**对 TZ 的借鉴点** · 作为"zoom in 到城市"的细节模式 · 地标图标跳出。

---

### 2.3 · Mapbox Standard (2026 新版) · https://www.mapbox.com/mapbox-studio

**视觉关键词** · 3D 建筑 facades · 可调色 · 支持 terrain / hillshade

**色彩策略** · 2026 新增 · 3D 建筑自定义颜色 + 地形 · 城市可定制为粉色、米色、灰蓝。

**地形处理** · dynamic hillshading · 动态光照 · 坡度决定阴影强度。

**建筑显示** · 选中的 35 个国际城市有详细 3D facades · 其他只剩 extrude 白块。

**对 TZ 的借鉴点** · 这是"既写实又不杂乱"的最商业成熟的答案 · 但技术栈重,ReactSimpleMaps 做不到。可作为 v2 迁移目标。

---

### 2.4 · Apple Maps Detailed City Experience · https://www.apple.com/newsroom/2021/09/apple-maps-introduces-new-ways-to-explore-major-cities-in-3d/

**视觉关键词** · 手工定制 3D 地标 · 夜间月光模式 · 35 个城市

**色彩策略** · 白天米白 + 淡绿 + 天空蓝 · 夜间深海军蓝 + 金色光晕 · 月亮在升起。

**地形处理** · 真实 DEM + 软阴影 + 植被纹理 (一棵一棵的树)。

**建筑显示** · 每个城市精选 20-50 个代表性地标做 hyper-accurate 建模 · 其他建筑是简单白色 extrude · 形成强烈视觉分层。

**对 TZ 的借鉴点** · **核心启发 · "选择性详细"** · 不是全世界都画 · 只画标志性的 20-50 个 · 其他留白。

---

### 2.5 · Red Dead Redemption 2 Map · https://blog.mapbox.com/building-a-map-inspired-by-red-dead-redemption-2-66e3ecba4e68

**视觉关键词** · 手绘牛仔 · 虚线边界 · 手写标注 · 老羊皮纸

**色彩策略** · 焦糖棕 + 暗绿 + 米白 · 全域做旧 · 纹理分明。

**地形处理** · 用轮廓线勾山脉 · 不打阴影 · 看起来像"用墨水画的"。

**建筑显示** · 大城镇用小 icon 标记 · 手写地名 · 重点位置有小插图 (酒馆、马厩)。

**对 TZ 的借鉴点** · **用"手写感字体 + 虚线 + 纸纹"三件套瞬间古卷化** · Mapbox 官博有完整复刻教程。

---

### 2.6 · Civilization 6 · https://forums.civfanatics.com/threads/civ-6s-art-style-do-you-like-it.665096/

**视觉关键词** · 六边形地图 · 卡通写实 · 山川连续起伏

**色彩策略** · 高饱和暖色 + 明确文化色带 (法国蓝 / 日本红 / 埃及金)。

**地形处理** · 山脉相邻自动连成山脊 · 河流沿 60 度角自然流动。

**建筑显示** · 文化奇观有独立 3D 建模 · 其他用 emoji 级别小图标。

**对 TZ 的借鉴点** · 文化色带的饱和度太高了 · 对 TZ 需求来说过于游戏化 · 但"奇观独立建模"的思路值得偷。

---

### 2.7 · Crusader Kings 3 · https://eu4.paradoxwikis.com/Map (EU4 姊妹款)

**视觉关键词** · 三层 zoom (政治 / 羊皮纸 / 地形) · 文化/宗教双色模式

**色彩策略** · zoom out = 政治大色块 · zoom mid = 羊皮纸 · zoom in = 真实地形。条纹表示"文化与领主不符"。

**文化显示** · 每个文化独立颜色 · 同文化群用相近色。可自定义 color + hue。

**对 TZ 的借鉴点** · **"三层 zoom 对应三种视觉语言"** · 这是解决"既写实又不杂乱"的终极策略 · 不同 zoom 显示不同维度。

---

### 2.8 · National Geographic Style Map · https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/mapping/meet-the-national-geographic-style-basemap

**视觉关键词** · 经典杂志感 · 多向 hillshade · 生态带土色

**色彩策略** · 饱和的土色系 · 沙漠金 / 森林墨绿 / 苔原灰紫 / 冰川冷白。

**地形处理** · **multi-directional hillshade** · 4 个方向的光同时照 · 细节浮现但不会太戏剧化。

**建筑显示** · 不画建筑 · 纯地理图。

**对 TZ 的借鉴点** · 色板本身就是答案 · 每种生态一个特征色 · 不用文字就能识别区域。

---

### 2.9 · The Pudding · Human Terrain · https://pudding.cool/2018/10/city_3d/

**视觉关键词** · 3D 人口柱 · 暗色底 · 发光柱子像城市

**色彩策略** · 深紫黑底 · 柱子是暖橙到冷蓝的渐变 (基于密度)。

**对 TZ 的借鉴点** · 如果要展示"事件密度" · 这是最美的范本 · 事件数量多处自动"长高"。

---

## 3 · 地质特色融入方案对比 (3 方向)

### 方向 A · 真实 hillshade raster 底图 (写实派)

**实现** · 用 Natural Earth 的 shaded relief raster 作底 · 或 Mapbox Raster Tile API。

**优点** · 一眼就看出山川河流 · 地理老师认可。

**缺点** · 技术栈重 (需要 raster 服务) · 跟 react-simple-maps SVG 不兼容 · 事件 Pin 容易被地形色干扰。

**杂乱风险** · 中高 · 除非饱和度压到 20% 以下。

**适合场景** · 全屏沉浸式地图页 · 作为一级产品页。

---

### 方向 B · 抽象图标 · 关键地标 emoji/SVG (折衷派)

**实现** · 底图保持 react-simple-maps 的 SVG 纯色填充 · 在 50-80 个地标位置散布 emoji 或手绘 SVG。

**优点** · 零技术改动 · 风格可控 · 文化感即时到位 (🗻 富士 · 🏯 长城 · 🗽 自由女神 · 🕌 泰姬陵)。

**缺点** · emoji 风格不统一 (苹果 / 谷歌 / Twemoji 各不同) · 需要统一制作一套 SVG 图标包。

**杂乱风险** · 低 · zoom 分层控制即可。

**适合场景** · **推荐给 TZ 的主方向** · 3 天内可落地。

---

### 方向 C · 文化区分色块 (氛围派)

**实现** · 预定义 6-8 个文化区 GeoJSON (东亚 / 东南亚 / 南亚 / 中东 / 非洲 / 欧洲 / 北美 / 拉美) · 以 5-10% 透明度铺底色。

**优点** · zoom out 一眼看出文化版图 · 符合 TZ 的"文化色彩融入"需求。

**缺点** · 政治敏感 (文化边界怎么画) · 需要精心选色避免刻板印象。

**杂乱风险** · 低 (因为透明度极低)。

**适合场景** · 与方向 B 叠加 · 构成双层。

---

### 最终建议 · **B + C 叠加 · 方向 A 留到 v2**

- 底层 · 文化色块 (C · 8% 透明度) · 给地图一个隐隐的氛围
- 中层 · 低饱和纯色底图 + 河流/海岸线轮廓 (react-simple-maps 原生能力)
- 上层 · 50-80 个地标 SVG (B)
- 最上层 · 事件 Pin (主角 · 始终最高饱和度)

---

## 4 · 建筑+文化地标清单 · 60 个真实坐标

格式 · `名称 | 经度,纬度 | emoji | 文化区`

### 东亚 (10 个)

1. 长城 八达岭 | 116.57, 40.43 | 🏯 | 东亚
2. 故宫 北京 | 116.40, 39.92 | 🏛️ | 东亚
3. 富士山 | 138.73, 35.36 | 🗻 | 东亚
4. 东京塔 | 139.74, 35.66 | 🗼 | 东亚
5. 金阁寺 京都 | 135.73, 35.04 | ⛩️ | 东亚
6. 上海东方明珠 | 121.50, 31.24 | 🏙️ | 东亚
7. 香港维港 | 114.17, 22.30 | 🌆 | 东亚
8. 首尔景福宫 | 126.98, 37.58 | 🏯 | 东亚
9. 台北 101 | 121.56, 25.03 | 🏢 | 东亚
10. 布达拉宫 拉萨 | 91.12, 29.65 | 🛕 | 东亚

### 东南亚 (6 个)

11. 吴哥窟 | 103.86, 13.41 | 🛕 | 东南亚
12. 曼谷大皇宫 | 100.49, 13.75 | 👑 | 东南亚
13. 新加坡滨海湾 | 103.86, 1.28 | 🌴 | 东南亚
14. 巴厘岛乌布 | 115.26, -8.51 | 🌺 | 东南亚
15. 岘港会安 | 108.33, 15.88 | 🏮 | 东南亚
16. 马尼拉大教堂 | 120.97, 14.59 | ⛪ | 东南亚

### 南亚 (5 个)

17. 泰姬陵 | 78.04, 27.17 | 🕌 | 南亚
18. 加尔各答维多利亚 | 88.34, 22.54 | 🏛️ | 南亚
19. 孟买门 | 72.83, 18.92 | 🏛️ | 南亚
20. 尼泊尔珠峰大本营 | 86.93, 28.00 | ⛰️ | 南亚
21. 斯里兰卡狮子岩 | 80.76, 7.96 | 🦁 | 南亚

### 中东 (6 个)

22. 吉萨金字塔 | 31.13, 29.98 | 🔺 | 中东
23. 耶路撒冷圣墓 | 35.23, 31.78 | 🕍 | 中东
24. 迪拜哈利法塔 | 55.27, 25.20 | 🏗️ | 中东
25. 伊斯坦布尔蓝色清真寺 | 28.98, 41.01 | 🕌 | 中东
26. 约旦佩特拉 | 35.44, 30.33 | 🪨 | 中东
27. 麦加天房 | 39.83, 21.42 | 🕋 | 中东

### 非洲 (5 个)

28. 乞力马扎罗 | 37.35, -3.07 | 🏔️ | 非洲
29. 撒哈拉 | 5.0, 23.0 | 🏜️ | 非洲
30. 维多利亚瀑布 | 25.86, -17.92 | 💦 | 非洲
31. 开普敦桌山 | 18.40, -33.96 | ⛰️ | 非洲
32. 马达加斯加猴面包树 | 44.42, -20.25 | 🌳 | 非洲

### 欧洲 (12 个)

33. 埃菲尔铁塔 | 2.29, 48.86 | 🗼 | 欧洲
34. 凯旋门 | 2.29, 48.87 | 🏛️ | 欧洲
35. 大本钟 伦敦 | -0.12, 51.50 | 🕰️ | 欧洲
36. 伦敦眼 | -0.12, 51.50 | 🎡 | 欧洲
37. 罗马斗兽场 | 12.49, 41.89 | 🏟️ | 欧洲
38. 梵蒂冈圣彼得 | 12.45, 41.90 | ⛪ | 欧洲
39. 巴塞罗那圣家堂 | 2.17, 41.40 | ⛪ | 欧洲
40. 圣托里尼 | 25.43, 36.39 | 🏘️ | 欧洲
41. 威尼斯圣马可 | 12.34, 45.43 | 🛶 | 欧洲
42. 阿尔卑斯马特洪峰 | 7.66, 45.98 | 🏔️ | 欧洲
43. 雷克雅未克极光 | -21.94, 64.15 | 🌌 | 欧洲
44. 莫斯科红场 | 37.62, 55.75 | 🏛️ | 欧洲

### 北美 (8 个)

45. 自由女神 | -74.04, 40.69 | 🗽 | 北美
46. 帝国大厦 | -73.99, 40.75 | 🏢 | 北美
47. 金门大桥 | -122.48, 37.82 | 🌉 | 北美
48. 好莱坞标志 | -118.32, 34.13 | 🎬 | 北美
49. 白宫 | -77.04, 38.90 | 🏛️ | 北美
50. 大峡谷 | -112.11, 36.05 | 🏜️ | 北美
51. 尼亚加拉瀑布 | -79.08, 43.08 | 💦 | 北美
52. 西雅图太空针 | -122.35, 47.62 | 🗼 | 北美

### 拉美 (5 个)

53. 耶稣像 里约 | -43.21, -22.95 | ✝️ | 拉美
54. 马丘比丘 | -72.55, -13.16 | 🏔️ | 拉美
55. 亚马逊雨林 | -60.0, -3.0 | 🌳 | 拉美
56. 古巴哈瓦那 | -82.36, 23.13 | 🏛️ | 拉美
57. 加拉帕戈斯 | -90.43, -0.95 | 🐢 | 拉美
58. 乌尤尼盐沼 | -67.48, -20.13 | 🪞 | 拉美

### 大洋洲 (2 个)

59. 悉尼歌剧院 | 151.21, -33.86 | 🎭 | 大洋洲
60. 乌鲁鲁 | 131.04, -25.34 | 🪨 | 大洋洲

---

## 5 · 避免杂乱的 5 条原则 (从研究中提炼)

### 原则 1 · 60-30-10 空间分配律

**出处** · Map Library · Cartographic Visualization

- 60% 是主要地图内容 (底图 + 事件 Pin)
- 30% 是支持元素 (地标 / 标注 / 轮廓)
- 10% 是纯留白 (呼吸空间)

**TZ 可落地** · 确保事件 Pin + 底图占屏幕 60% · 其他地标不超过 30%。

---

### 原则 2 · 最多 4 种字号

**出处** · Map Library · Typography

- 大标题 (国家级) · 14-16pt
- 中标题 (城市级) · 11-12pt
- 地标名 · 9-10pt
- 事件标签 · 8-9pt

**TZ 可落地** · 不要用 5+ 字号 · 中文用 PingFang + 英文用 Inter · 不要混超过 2 个字体家族。

---

### 原则 3 · zoom 分层显示 (Scale-Dependent Rendering)

**出处** · Crusader Kings 3 / Mapbox

- zoom 0-3 (洲级) · 只显示 10 个超级地标 + 文化色块
- zoom 3-6 (国级) · 显示 30-40 个地标 + 轮廓
- zoom 6-10 (城级) · 显示全部地标 + 城市名

**TZ 可落地** · 用 react-simple-maps 的 ZoomableGroup · 根据 zoom 值控制 pin 显示密度。

---

### 原则 4 · 饱和度反向金字塔

**出处** · Stamen / Mapbox Core Styles

- 底图 · 饱和度 20-30% (让主角发光)
- 地标图标 · 饱和度 50-60%
- 事件 Pin · 饱和度 80-100% (永远最亮)

**TZ 可落地** · TZ 的 MUJI 暖米色 + 低饱和 · 天然符合这个原则。

---

### 原则 5 · 标签间距最小 10-12px

**出处** · Map Library · Label Placement

**TZ 可落地** · 实现碰撞检测 · 当 2 个 pin 距离过近时 · 合并为"聚合 pin" (显示数字 · 点击展开)。

---

## 6 · 给 TZ 的 3 个视觉方向对比 · 选一个

### 方向 1 · "温暖古卷" (我最推荐)

```
┌──────────────────────────────────────────┐
│  [浅米 + 淡褐纸纹 底]                    │
│                                          │
│   ╱╲ 🏔️           🗻                   │
│  ╱  ╲          ⛩️ 🏯                   │
│ ⛰️  《东亚》         ~~~~~海~~~~~       │
│      （8% 透明度色块）                  │
│                                          │
│       🕌 《中东》   🔺                  │
│                                          │
│   🗼《欧洲》         ●    ← 事件 pin    │
│   🏛️              ●                     │
│                                          │
└──────────────────────────────────────────┘
色板 · #F5EFE0 底 / #C9A66B 地标 / #D64545 pin
字体 · 衬线 (Noto Serif) + 手写标注
```

**视觉感觉** · 像摊开了一本祖父的世界游记。

**优点** · 温暖 · 独特 · 符合 TZ MUJI 美学。

**缺点** · 事件频繁时氛围被打破。

---

### 方向 2 · "极简线稿"

```
┌──────────────────────────────────────────┐
│                                          │
│       ╱╲      ╱╲                         │
│      ╱  ╲    ╱  ╲                        │
│     ────────────                         │
│      🏯     🗼     🗽                    │
│                                          │
│        ●         ●      ← 事件 pin       │
│                  ●                       │
│                                          │
│     ────────────                         │
│      ╱  ╲     ╱╲                         │
│                                          │
└──────────────────────────────────────────┘
色板 · 纯白底 / 黑色细线 / 红色 pin
字体 · Inter / 等距
```

**视觉感觉** · 像产品概念图 · 设计感强烈。

**优点** · 永不杂乱 · 事件 pin 永远最亮。

**缺点** · 没有"文化色彩"的感觉 · 冷淡。

---

### 方向 3 · "夜空大陆"

```
┌──────────────────────────────────────────┐
│ ★   (深海军蓝 底)              ★        │
│                                          │
│   ∩∩∩∩∩   🏔️            ✦ 事件脉冲      │
│   (山脉轮廓 金色细线)                    │
│                                          │
│      ⛩️        🕌                        │
│   《东亚金带》  《中东紫带》             │
│                  (10% 霓虹带)           │
│                                          │
│   ★      🗽    ✦                         │
│                                          │
│                         ★                │
└──────────────────────────────────────────┘
色板 · #0E1530 底 / #D4AF37 地标 / #FF5A5A pin 发光
字体 · Inter + 荧光样式
```

**视觉感觉** · 像天文馆的全球事件直播。

**优点** · 事件 Pin 超抢眼 (像脉冲星) · 未来感。

**缺点** · 跟 TZ MUJI 风格冲突 · 偏 SciFi。

---

## 7 · 实施建议 · 基于 react-simple-maps 现状

### Step 1 · 先搞定底图色板 (1 小时)

- 打开现有 react-simple-maps 组件
- `<Geography fill="#F5EFE0" stroke="#C9A66B" strokeWidth={0.5} />`
- 一键切到方向 1 的温暖古卷色

### Step 2 · 加地标 SVG 图层 (半天)

- 把上面 60 个坐标做成 JSON 文件 · `public/data/landmarks.json`
- 用 `<Marker coordinates={[lng, lat]}>` 渲染 emoji 或自制 SVG
- 用 zoom 值控制显示 (zoom < 3 时只显示 10 个主要的)

### Step 3 · 加文化色块底 (半天)

- 用 `world-admin.geojson` (Natural Earth) · 给每个国家打 `cultureRegion` tag
- react-simple-maps 的 `<Geographies>` 组件 · 根据 tag 填色 (5-10% 透明度)

### Step 4 · (可选) 水彩纸纹覆盖 (1 小时)

- public/paper-texture.png · 放一张淡水彩纸纹
- 用 CSS `background-image` · `mix-blend-mode: multiply` · 瞬间古卷化

### Step 5 · (v2) 迁移到 MapLibre GL (3-5 天)

- 当需要真实 hillshade 时 · 迁 MapLibre
- 用 MapTiler 的免费 tile · `--terrain-rgb`
- 保留现有地标图层

---

## 8 · 参考资源汇总

### 现成可直接用的 tile 源
- Stamen (via Stadia Maps) · https://docs.stadiamaps.com/map-styles/stamen-watercolor/
- Mapbox Standard · https://www.mapbox.com/mapbox-studio
- MapTiler Outdoor · https://www.maptiler.com/

### 数据源
- Natural Earth · https://www.naturalearthdata.com/ (免费 GeoJSON · 海岸 / 河流 / 边界 / 地名)
- UNESCO 世界遗产 GeoJSON · https://whc.unesco.org/en/interactive-map/
- World Bank World Heritage · https://datacatalog.worldbank.org/dataset/world-heritage-sites

### 设计灵感
- Mapbox Gallery · https://www.mapbox.com/gallery
- Mapbox "18 maps that inspired us" · https://blog.mapbox.com/18-maps-that-inspired-us-this-year-c569de845432
- Lee Martin RDR2 复刻教程 · https://www.leemartin.com/new-western-map/
- Pudding Human Terrain · https://pudding.cool/2018/10/city_3d/

### 开源代码
- react-simple-maps 官方例子 · https://www.react-simple-maps.io/examples/
- d3-geo-projection · https://github.com/d3/d3-geo-projection
- deck.gl IconLayer · https://deck.gl/docs/api-reference/layers/icon-layer
- MapLibre 3D Terrain · https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/

### 设计理论
- Map Library · 11 Minimalist Map Design · https://www.maplibrary.org/1493/exploring-minimalist-map-design-philosophies/
- FT Visual Vocabulary · https://github.com/Financial-Times/chart-doctor
- NatGeo Style Basemap · https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/mapping/meet-the-national-geographic-style-basemap

---

## 9 · 结论 · 给 TZ 的一句话

**"温暖古卷"方向 (B + C 叠加) 是 TZ 需求的最短路径** · 3 天能做完 · 符合 MUJI 美学 · 事件 Pin 永远主角 · 地标有趣不杂乱 · 未来 v2 再升级到真 hillshade 也不亏 · 现有图层直接迁移即可。

**不要做的** · 不要试图把 Apple Maps 的 3D 塞进 react-simple-maps · 技术栈不兼容 · 等迁 MapLibre 再说。

---

*研究完成时间 · 2026-04-24 凌晨 · 研究员 · Claude Opus 4.7 信息可视化设计部*
