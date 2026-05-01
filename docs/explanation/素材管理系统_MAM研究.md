---
name: CatchZVibe Studio · HGC 独立站素材管理系统 (MAM) 深度研究
description: 为 HG 客户 + CatchZVibe 工作室 3 人团队设计的 proxy-based 素材管理方案 · 原片不上网 · 只传 proxy + thumb · 购物车一键取原片
type: project
date: 2026-04-23
author: Claude Opus 4.7 (技术架构研究员)
---

# HGC 独立站 · 素材管理系统 (MAM) 深度研究

> TZ 明确需求：原片 2 份 (SSD + Lark) 不上网 · 网站只存 proxy + thumb · 购物车选中后一键取原片
> 团队：3 人 (TZ / Frida / Hank，Hank 在国内) · 预算：$150-200/月
> 规模：历史 100-500 GB · 月增 20-50 GB · 已有 Next.js 16 + Supabase + Vercel 技术栈

---

## Part 1 · 深度研究报告 (7 维度)

### 维度 1 · Proxy Video Workflow 行业标准

**什么是 proxy workflow (offline/online editing)**

这是广电和影视行业的标准做法。Proxy (代理文件) = 原片的低码率低分辨率副本，用于流畅编辑。剪辑师用 proxy 编辑，最终导出时系统自动 re-link 回原片 (online conform)。这个流程叫 **offline editing (用代理剪) → online editing (用原片出)**。Frame.io 2024 指南明确指出：proxy 文件在编辑阶段使用，Premiere Pro 在渲染和导出时自动切回全分辨率源文件 ([Frame.io Guide](https://blog.frame.io/2024/07/29/updated-guide-premiere-pro-proxies-and-proxy-workflows/))。

**Premiere / DaVinci / CapCut 的 proxy 机制**

- **Premiere Pro**：Ingest 时自动创建 proxy (用 Media Encoder 后台跑)，Toggle Proxies 按钮一键切换。推荐 codec: ProRes Proxy / GoPro CineForm / H.264 ([Adobe Docs](https://helpx.adobe.com/premiere-pro/using/ingest-proxy-workflow.html))
- **DaVinci Resolve**：Generate Optimized Media + Proxy Media 两种机制，支持 AAF/EDL/XML 导入回 conform
- **CapCut**：国内主要用户，Hank 用这个剪。CapCut 本身没有专业 proxy 机制，但可以直接用低分辨率文件剪后替换高分辨率（手动 link）
- **通用标准**：proxy 与原片的 **分辨率比例 (aspect ratio)** / **帧率 (frame rate)** / **时长** / **音轨数** 必须一致

**码率 / 分辨率推荐**

业界推荐 ([OWC Blog](https://www.owc.com/blog/online-vs-offline-editing-why-you-still-need-to-consider-proxy-videos), [Frame.io](https://blog.frame.io/2024/07/29/updated-guide-premiere-pro-proxies-and-proxy-workflows/))：

| 原片分辨率 | Proxy 推荐 | 码率推荐 | 用途 |
|---|---|---|---|
| 4K (3840×2160) | 1280×720 | 2-5 Mbps H.264 | 剪辑/审片 |
| 1080p | 960×540 | 1-3 Mbps H.264 | 审片/预览 |
| 720p 以下 | 原尺寸 | 1-2 Mbps | 直接用 |

**对 TZ 的应用**：HG 团队拍摄多用 4K/1080p，推荐 proxy = **720p @ 2 Mbps H.264 (MP4)**。既能看清产品细节，文件又足够小。

**Proxy 文件大小估算**

基于公式 `文件大小 = 码率 × 时长 ÷ 8`：

- 720p @ 2 Mbps × 60s ÷ 8 = **15 MB / 分钟**
- 720p @ 2 Mbps × 1 小时 = **约 900 MB**
- 10 分钟片 = 约 150 MB

**关键洞察**：100 GB 的原片通常 = 约 5-8 GB 的 proxy (压缩比 15-20x)。这是为什么不把原片上网的核心原因。

Sources:
- [Frame.io Video Post-Production Workflow Guide](https://workflow.frame.io/guide/premiere-pro-proxies)
- [Adobe: Ingest and Proxy Workflow in Premiere Pro](https://helpx.adobe.com/premiere-pro/using/ingest-proxy-workflow.html)
- [Frame.io Complete Guide to Premiere Proxies (2024)](https://blog.frame.io/2024/07/29/updated-guide-premiere-pro-proxies-and-proxy-workflows/)
- [OWC: Online vs Offline Editing](https://www.owc.com/blog/online-vs-offline-editing-why-you-still-need-to-consider-proxy-videos)

---

### 维度 2 · 专业 MAM 工具对比 (2026)

逐个拆解主流 MAM 产品：

#### Frame.io (Adobe 旗下)
- **URL**：https://frame.io/pricing
- **定价 (2026)**：
  - Free：2 用户，2 GB 存储
  - Pro：$15/用户/月，5 用户上限，1 TB
  - **Team：$25/用户/月，15 用户上限，3 TB**
  - Enterprise：定制
- **3 人团队成本**：$25 × 3 = **$75/月** = $900/年
- **适合规模**：中小团队，深度 Adobe 用户
- **特色**：Premiere Pro 插件深度集成、时间码评论、审批工作流
- **缺点**：比其他贵、Adobe 生态锁定、原片上云

Source: [Frame.io Pricing](https://frame.io/pricing) · [Capterra Frame.io Pricing 2026](https://www.capterra.com/p/148214/Frame-io/pricing/)

#### Iconik (独立 MAM 新贵)
- **URL**：https://www.iconik.io/pricing
- **定价 (2026)**：
  - Pay-as-you-go：$1/credit，按使用计费
  - Pro Pricing：打包价 (未公开基础价)
  - **起步通常约 $500/月**
- **特色**：分布式存储 (连接你的 AWS/GCS/Azure)，免费 collaborator 用户
- **缺点**：最低门槛对 3 人团队偏高

Source: [Iconik Pricing](https://www.iconik.io/pricing) · [Iconik Blog: 2025 Pricing Update](https://www.iconik.io/blog/pricing-and-tiers-jan-2025)

#### LucidLink
- **URL**：https://www.lucidlink.com/pricing
- **定价 (2026)**：
  - Starter：**$7/用户/月**
  - Business：**$32/用户/月**
  - Wasabi 存储附加：$5/TB
- **3 人 Starter**：$7 × 3 = **$21/月** (但 Starter 功能有限)
- **3 人 Business**：$32 × 3 + 300GB × $5/TB = **$97.5/月**
- **特色**：原片挂载为本地硬盘 (Emmy 奖得主)，直接在 Premiere/Resolve 里用
- **缺点**：不是审片工具，是文件系统 (原片上云反而违反 TZ 规则)

Source: [LucidLink Pricing](https://www.lucidlink.com/pricing)

#### Filestage (轻量审片)
- **URL**：https://filestage.io
- **定价 (2026)**：免费 2 项目 / Basic $109/月 / Pro $299/月
- **缺点**：Basic 对 3 人团队也偏贵

#### Wipster / Dropbox Replay / Hightail
- 轻量级审片工具
- Wipster 定价约 $20/用户/月
- Dropbox Replay 按 Dropbox 订阅走
- Hightail Teams $24/用户/月

Source: [15 Best Frame.io Alternatives 2026](https://filestage.io/blog/frame-io-alternatives/)

#### 开源自建 (ResourceSpace / Razuna / Jellyfin)
- ResourceSpace：免费自托管，付费支持 $643/月 (不值)
- Razuna：Docker 部署
- Jellyfin：开源零成本，但偏消费娱乐 (看电影)，不是专业审片

Source: [10 Best Open Source DAM 2026](https://thedigitalprojectmanager.com/tools/best-open-source-digital-asset-management-software/) · [Plex vs Emby 2026](https://www.servermania.com/kb/articles/plex-vs-emby)

**⭐ 对标 TZ 场景结论**

| 产品 | 3 人月成本 | 原片上云? | 购物车? | 适合度 |
|---|---|---|---|---|
| Frame.io Team | $75 | 是 | 有"Presentation" | ★★★ (贵+违反原则) |
| Iconik | $500+ | 可选 | 有 | ★ (太贵) |
| LucidLink Business | $97.5 | 是 | 不是审片 | ★★ (违反原则) |
| **自建 (Supabase + R2 + FFmpeg)** | **$35-60** | **否** | **自己造** | **★★★★★** |

**TZ 已有 CatchZ Studio 审片工作台** (见记忆 `project_catchz_studio_工作台.md`)，本 MAM 就是把那个工作台的素材管理能力上网站化，所以**自建是最对的路**。

---

### 维度 3 · 云转码服务 (自动 proxy 生成)

这个维度看：如果 TZ 不想本地跑 FFmpeg，云服务能不能自动生成 proxy？

#### Cloudflare Stream
- **URL**：https://developers.cloudflare.com/stream/pricing/
- **定价 (2026)**：
  - 存储：**$5 / 1000 分钟存储 / 月**
  - 传输：**$1 / 1000 分钟分发**
  - 无编码费 (自动转码为 HLS ABR)
- **适合 TZ 吗？**
  - 300 GB 历史素材 → 按分钟算：如果平均 5 分钟/片 × 2000 片 = 10000 分钟 = **$50/月存储**
  - 但 Stream 的设计是"最终交付给观众"，不是给编辑师看 proxy。原片可以上 Stream 但浪费
  - **建议**：只有最终 proxy 上 Stream

Source: [Cloudflare Stream Pricing](https://developers.cloudflare.com/stream/pricing/)

#### Bunny Stream (强烈推荐)
- **URL**：https://bunny.net/pricing/stream/
- **定价 (2026)**：
  - 存储：**$0.005 / GB / 月**
  - CDN 分发：**$0.01 / GB**
  - **转码免费** (自动 HLS ABR)
  - 缩略图 API 免费
- **对 TZ 的成本**：
  - 存 10 GB proxy：$0.05/月 (几乎免费)
  - 存 100 GB proxy：$0.50/月
  - 分发 50 GB/月：$0.50/月
  - **总计 < $2/月** 极度便宜
- **特色**：欧洲公司，API 友好，`thumbnailTime` 参数自动抽缩略图
- **Thumbnail API**：`GET /library/{libraryId}/videos/{videoId}/thumbnail?thumbnailTime=5000`

Source: [Bunny Stream Pricing](https://bunny.net/pricing/stream/) · [Bunny.net Review 2026](https://www.bitdoze.com/bunny-net-review/) · [Bunny API](https://docs.bunny.net/api-reference/stream)

#### Mux (开发友好)
- **URL**：https://www.mux.com/pricing
- **定价 (2026)**：
  - 编码：**$0.07/分钟** (Plus quality) 或免费 (Basic quality)
  - 分发：**$0.025/分钟**
  - 60 天未看自动移到便宜存储
- **3 人团队成本估算**：月增 30 GB (约 300 分钟) × $0.07 = $21/月编码 + 存储+分发 $20-40
- **总计**：约 $40-80/月
- **缺点**：最贵的一个，但开发体验最好

Source: [Mux Video Pricing](https://www.mux.com/docs/pricing/video) · [Video Streaming Pricing Comparison April 2026](https://www.buildmvpfast.com/api-costs/video)

#### AWS MediaConvert
- 自建复杂度高、账单难预测、不推荐 3 人小团队

**对比结论**

| 服务 | 300 GB proxy 总成本 | 支持 thumbnail? | 国内可用? |
|---|---|---|---|
| Cloudflare Stream | ~$50/月 | 是 | 跨境慢 |
| **Bunny Stream** | **<$5/月** | **是** | **跨境中等** |
| Mux | $40-80/月 | 是 | 跨境中等 |
| AWS MediaConvert | $50-100/月 | 是 | 跨境慢 |

**⭐ 推荐**：如果要云转码，选 **Bunny Stream** (便宜 10x + 欧洲中立 + API 好)。

---

### 维度 4 · 自建方案 (FFmpeg + Watch Folder)

这是 TZ 已经走在路上的方案 (CatchZ Studio 工作台已有 FFmpeg 本地脚本)。

**核心架构**

```
Lark 素材库/整体素材/  ←  Frida 上传原片
        ↓
Mac mini (24/7 开机) 跑 chokidar watcher
        ↓
检测到新 .mp4 → ffmpeg 生成 proxy + thumb
        ↓
上传 proxy 到 Cloudflare R2
上传 thumb 到 Supabase
原始路径 + 文件名 → 写入 Supabase DB (assets 表)
        ↓
独立站读 Supabase → 渲染审片 UI
```

**FFmpeg 推荐命令**

```bash
# Proxy: 720p @ 2 Mbps H.264
ffmpeg -i "input.mov" \
  -vf "scale=1280:720" \
  -c:v libx264 -preset fast -b:v 2M \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  "proxy.mp4"

# Thumbnail: 在 10% 处抽一帧，代表性最强
ffmpeg -ss 00:00:05 -i "input.mov" \
  -vframes 1 -vf "scale=480:-1" \
  -q:v 3 "thumb.jpg"

# 或用 thumbnail filter 自动选最佳帧
ffmpeg -i "input.mov" \
  -vf "thumbnail=300,scale=480:-1" \
  -frames:v 1 "thumb_auto.jpg"
```

Sources: [FFmpeg Thumbnail Tutorial](https://davidwalsh.name/create-thumbnail-ffmpeg) · [Stackunderflow: FCP Proxy with FFmpeg](https://stackunderflow.com/post/final-cut-pro-create-proxy-media-in-ffmpeg/)

**Watcher 脚本 (Node.js + chokidar)**

```javascript
// watcher.js - 跑在 Mac mini 上，24/7 开机
import chokidar from 'chokidar';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const watcher = chokidar.watch('/Volumes/LarkSync/素材库/', {
  awaitWriteFinish: {
    stabilityThreshold: 3000,  // 等文件写完 3s
    pollInterval: 500,
  },
  ignored: /(^|[\/\\])\../,  // 忽略隐藏文件
});

watcher.on('add', async (path) => {
  if (!path.match(/\.(mp4|mov|mxf|avi)$/i)) return;

  // 1. 生成 proxy
  const proxyPath = `/tmp/proxy_${Date.now()}.mp4`;
  execSync(`ffmpeg -i "${path}" -vf scale=1280:720 -c:v libx264 -b:v 2M "${proxyPath}"`);

  // 2. 生成 thumb
  const thumbPath = `/tmp/thumb_${Date.now()}.jpg`;
  execSync(`ffmpeg -i "${path}" -vf "thumbnail,scale=480:-1" -frames:v 1 "${thumbPath}"`);

  // 3. 上传到 R2 + Supabase
  // ... (用 AWS S3 SDK 上传到 R2)

  // 4. 写 assets 表，记录原片本地路径
  await supabase.from('assets').insert({
    filename: path,
    original_path: path,  // SSD 本地路径
    lark_file_token: null,  // 可选：Lark token
    proxy_url: proxyR2Url,
    thumb_url: thumbSupabaseUrl,
    duration: getDuration(path),
    size: getSize(path),
  });
});
```

Sources: [Chokidar on GitHub (30M repos)](https://github.com/paulmillr/chokidar) · [Chokidar NPM](https://www.npmjs.com/package/chokidar)

**需要 TZ 电脑常开吗？**

三个选项：
1. **Mac mini / 老 Mac 24/7 开机** (推荐，一次性投入)
2. **Lark Webhook 触发**：Lark 上传后 POST 通知独立站 → Vercel Serverless Function 下载 → 转码 → 上传 (但 Vercel 函数 10s/60s 限制不适合转码)
3. **TZ Mac 开机时跑**：下班关电脑就停 (不推荐，不稳定)

**推荐架构**：方案 1 (Mac mini 闲置的就用，或买个 $600 的 M4 Mac mini 一次投入)。

**开源项目参考**：
- [chokidar](https://github.com/paulmillr/chokidar) - 30M+ repos 使用
- [watchman](https://github.com/facebook/watchman) - Facebook 出品，高性能
- FFmpeg 官方 + [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (如果要在浏览器跑)

---

### 维度 5 · Lark 云盘 API 能力

**tmp_download_url API**

Lark 有官方 `batch_get_tmp_download_url` endpoint，能生成 **24 小时有效的临时下载链接**：

```
POST /open-apis/drive/v1/medias/batch_get_tmp_download_url
Authorization: Bearer {tenant_access_token}

{
  "file_tokens": ["boxbcbLz..."]
}

Response:
{
  "code": 0,
  "data": {
    "tmp_download_urls": [{
      "file_token": "boxbcbLz...",
      "tmp_download_url": "https://internal-api.feishu.cn/open-apis/drive/v1/medias/..."
    }]
  }
}
```

Source: [Feishu Get Temporary Download URL API](https://open.larkoffice.com/document/server-docs/docs/drive-v1/media/batch_get_tmp_download_url)

**对 TZ 购物车的意义**：非常关键。用户在独立站购物车选完素材 → 后端调 Lark API → 批量生成 24h 链接 → 发送给用户 → **原片从 Lark 直接下载，不经过独立站带宽**。

**Webhook 监听文件上传？**

Lark Open Platform 支持事件订阅 (Event Subscription)，但**文件级别的事件需要企业版** (具体要看 TZ 的 Lark 套餐)。常见事件：
- `drive.file.updated_v1` - 文件更新
- `drive.file.title_updated_v1` - 标题改

**备选方案**：不用 webhook，用 **polling** (每 5 分钟查一次 Lark 目录 list)，或者直接监听 Lark 本地同步客户端的文件夹（因为 Lark 桌面端会把云盘同步到 SSD）。

Source: [Feishu/Lark OpenAPI](https://open.larksuite.com) · [Lark Node SDK](https://www.npmjs.com/package/@larksuiteoapi/node-sdk)

**中国大陆 + 美国跨境延迟**

- Lark 本身有国内 (feishu.cn) 和海外 (larksuite.com) 两个 base
- **TZ 如果在美国用 larksuite.com**，Hank 国内访问会走跨境，文件下载可能 100-500 KB/s
- 解决方案：让 Hank 的 Lark 桌面端直接同步到 SSD 本地，取原片不过海外 API

Source: [Cloudflare China Network](https://developers.cloudflare.com/learning-paths/china-network-overview/series/china-network-main-features-1/)

---

### 维度 6 · 购物车 + EDL 导出工作流

**购物车 UX pattern**

Frame.io 用 "Presentation"，Iconik 用 "Collection"。核心思路：
1. 用户在素材库浏览 proxy
2. 点 "Add to Cart" 收集 asset_id
3. 结账时生成 **原片取片清单** (manifest)

**推荐 UX**：
```
独立站 /library → 筛选 + 搜索
  ↓ 点击卡片 "+"
独立站 /cart → 显示已选素材 (proxy 预览)
  ↓ 点击 "导出"
选项 A: 下载 manifest.csv (本地文件路径)
选项 B: 下载 Lark 原片链接 ZIP (24h 有效)
选项 C: 导出 EDL/XML 给 Premiere
```

**EDL 格式规范 (CMX3600)**

EDL 是 1970 年代诞生的标准，现在主流 NLE 都支持 (Premiere / DaVinci / Final Cut / Avid)。CapCut 不原生支持。

基本格式：
```
TITLE: HG_CART_20260423
FCM: NON-DROP FRAME

001  CLIP001   V     C        00:00:05:00 00:00:15:00 00:00:00:00 00:00:10:00
002  CLIP002   V     C        00:00:20:00 00:00:25:00 00:00:10:00 00:00:15:00
```

每行：序号 + 源片名 + 轨道 + Cut/Dissolve + 源入点 + 源出点 + 记录入点 + 记录出点

Source: [What is an EDL (Premiere Pro)](https://www.simonsaysai.com/blog/premiere-pro-edl) · [EDL Converter](https://editingtools.io/edl/) · [Wikipedia EDL](https://en.wikipedia.org/wiki/Edit_decision_list)

**对 TZ 的推荐**：
- **Phase 1**：购物车导出 `manifest.json` (asset_id, 原片路径, Lark token) + `download_links.txt` (Lark 临时链接)
- **Phase 2**：导出 CMX3600 EDL 给 Premiere/Resolve
- **Phase 3**：导出 FCPXML 给 Final Cut / DaVinci (更现代，支持更多元数据)

CapCut 支持有限，但可以导出 **XML + 原片 ZIP** 让 Hank 在 CapCut 里手动 link。

Source: [EDL Conversion Tools](https://editingtools.io/edl/)

**未来："把我的购物车变成 Premiere 项目"**

完全可做。技术路线：
1. 购物车数据 (asset_id list + 原片路径)
2. 模板化 FCPXML/Premiere Project XML
3. 后端生成 `.prproj` 文件，塞入 bin 组织结构
4. 用户下载 ZIP (包含 `.prproj` + 原片 ZIP 或 Lark 链接 manifest)
5. 打开 Premiere → 所有素材已自动导入

这个能力 Frame.io 没有 (Frame.io 只给 link，Premiere 是手动连接)。**这是 TZ 的差异化护城河**。

---

### 维度 7 · 存储方案 · Supabase 够用吗?

**Supabase Pro 限制**

- $25/月
- 8 GB 数据库
- **100 GB 文件存储**
- 250 GB 月流量
- 50 MB 单文件上限 (Free) / 5 GB (Pro，用 resumable uploads)
- 超出：$0.021/GB 存储 + $0.09/GB 流量 (cached 0.03/GB)

Source: [Supabase Pricing 2026](https://supabase.com/pricing) · [Supabase Storage Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)

**proxy + thumb 规模估算 (3 人，历史 300GB + 月增 30GB)**

- 原片 300 GB × 5-7% 压缩比 = **proxy 约 20 GB**
- 每 proxy 平均 15-25 MB (3-5 分钟视频 @ 2 Mbps)
- Thumb 每张 50-100 KB
- **总存储需求**：首年 20-30 GB，3 年 50-100 GB

**Supabase Pro 完全够用！** 100 GB 能存 3-5 年的 proxy。

**但...** 带宽可能是瓶颈：
- 3 人审片，平均 5 分钟视频看 100 个/天 × 15 MB = 1.5 GB/人/天 × 3 人 × 30 天 = **135 GB/月**
- Pro 250 GB 流量应该够，但爆量可能要 $9-12/月附加

**价格对比**

| 服务 | 存储 $/GB/月 | 流量 $/GB | 零出口? | 100GB 存 + 200GB 流量月成本 |
|---|---|---|---|---|
| Supabase Pro | $0.021 | $0.09 (cached 0.03) | 否 | $25 + 已包含 |
| **Cloudflare R2** | **$0.015** | **$0** | **是** | **$1.5 + $0 = $1.5** |
| Backblaze B2 | $0.006 | $0.01 (或走 CDN 免费) | 3x 免费 | $0.6 + $1 = $1.6 |
| AWS S3 | $0.023 | $0.09 | 否 | $2.3 + $18 = $20+ |

Sources: [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) · [Backblaze B2 Pricing](https://www.backblaze.com/cloud-storage/pricing) · [Supabase Storage Pricing](https://supabase.com/docs/guides/storage/pricing)

**⭐ 推荐组合**

- **Supabase Pro $25/月**：auth + DB + 小文件 (thumb，小于 10 GB)
- **Cloudflare R2**：proxy 大文件存储 ($1-3/月)
- **总存储成本**：约 **$26-30/月**，完全在预算内

**为什么不全用 Supabase Storage？**
- Supabase Pro 基础已包含 100GB 但**流量不够**，300GB/月 proxy 审片会爆
- R2 **零出口**完美解决 (3 人随便看不花钱)
- R2 架在 Cloudflare CDN 上，全球加速快

---

## Part 2 · 方案对比矩阵

| 方案 | 初期成本 | 月成本 | 实现时间 | 可行性 | 原片上云? | 国内延迟 | 维护难度 | 扩展性 |
|---|---|---|---|---|---|---|---|---|
| **A. Frame.io Team** | $0 | $75 | 1 天 | ★★★★★ | **是** ❌ | 中 | ★ 低 | ★★★ |
| B. Iconik | $0 | $500+ | 1 周 | ★★ | 可选 | 中 | ★★ | ★★★★ |
| C. LucidLink Business | $0 | $97 | 3 天 | ★★★ | **是** ❌ | 中 | ★ | ★★★ |
| D. 自建 · Supabase + R2 + 本地 FFmpeg | $600 (Mac mini) | **$26-35** | 2 周 | ★★★★ | **否** ✓ | 可控 | ★★★ | ★★★★★ |
| E. 自建 · Supabase + Bunny Stream | $0 | $30-40 | 1 周 | ★★★★★ | 云转码 | 中 | ★★ | ★★★★ |
| F. 自建 · Supabase + Mux | $0 | $55-80 | 1 周 | ★★★★ | 云转码 | 中 | ★★ | ★★★★ |
| G. 开源自建 (ResourceSpace) | $600 | $5 | 4 周 | ★★ | 否 | 可控 | ★★★★★ 高 | ★★★ |

**评分说明**
- 原片上云：TZ 明确不要，所以 A/C 扣分
- 国内延迟：Hank 在国内用，低延迟加分
- 维护难度：3 人小团队不想折腾

---

## Part 3 · 最终推荐 (给 TZ)

### 🎯 推荐方案：**方案 E + D 混合** · Supabase + Cloudflare R2 + Bunny Stream

```
┌─ SSD 蓝色硬盘 ─┐    ┌─ Lark 云盘 ─┐
│  【原片 · 不上网】│    │  【原片 · 备份】│
└────┬──────────┘    └────┬─────────┘
     │  (两份原片 · TZ 规则)
     ↓
┌─ Mac mini watcher (可选阶段 2 加) ─┐
│  chokidar 监听 新文件              │
│  ffmpeg 生成 proxy (720p 2Mbps)   │
│  ffmpeg 抽 thumb (480px jpg)     │
└────┬──────────────────────────────┘
     │
     ├→ Bunny Stream (proxy + 自动 HLS ABR)  $3-5/月
     └→ Supabase Storage (thumb · 小文件)    $25/月 (Pro)
     └→ Supabase DB (metadata + 原片路径 + Lark token)

┌─ HGC 独立站 (Next.js 16) ─┐
│  /library  · 浏览 proxy    │
│  /cart     · 购物车        │
│  /checkout · 导出 manifest │
└────┬──────────────────────┘
     │ 结账 → 调 Lark API 生成 24h 临时链接
     ↓
┌─ 用户 (Frida / Hank) ─┐
│  下载 manifest.zip     │
│  - links.txt (Lark URL)│
│  - edl.cmx             │
│  - project.fcpxml     │
└────────────────────────┘
```

### 🔧 具体选择

| 组件 | 方案 | 原因 |
|---|---|---|
| **原片存储** | SSD + Lark (双份) | TZ 规则 · 不上网 |
| **Proxy 存储 + CDN** | **Bunny Stream** | $0.005/GB · 免费转码 · 欧洲中立 · API 友好 |
| **Thumb 存储** | **Supabase Storage** | 已有 Supabase · 小文件不爆 |
| **原片定位数据库** | **Supabase Postgres** | 已用 · `assets` 表存 `original_path + lark_token` |
| **Proxy 生成触发** | Phase 1: 本地 Mac ffmpeg 脚本 + 手动跑<br>Phase 2: Bunny 上传 API 自动转码 | 先简单再优化 |
| **Proxy 播放器** | HLS.js + Video.js | Bunny Stream 原生 HLS ABR |
| **购物车导出** | manifest.json + CMX EDL + FCPXML | 兼容所有 NLE |
| **Lark 原片取片** | `batch_get_tmp_download_url` API | 24h 临时链接 |

### 🎯 为什么选这个组合

1. **TZ 最核心需求满足**：原片不上网 ✓
2. **成本极低**：$30/月以内 (Supabase $25 + Bunny $3-5)
3. **技术栈匹配**：已有 Next.js + Supabase，学习成本最小
4. **国内可用**：Bunny Stream 欧洲节点，Hank 国内延迟比 Cloudflare 略好
5. **未来可扩展**：EDL 导出 → FCPXML → "一键变 Premiere 项目"
6. **私域友好**：和已有 CatchZ Studio 工作台 (见记忆) 完美打通

### ⚠️ 风险和备选

| 风险 | 缓解 |
|---|---|
| Bunny Stream 国内封? | 备选 Cloudflare Stream · 多 1-2x 成本但稳定 |
| Supabase 流量 250GB/月不够? | R2 零出口兜底 · 迁移成本低 |
| Mac mini 坏了? | 备选 Bunny Stream 直传 · 云转码免本地 |
| Lark API 限流? | Polling + 本地缓存 Lark token · 批量调用 |

---

## Part 4 · 落地技术栈 + 成本清单

### 📋 服务清单

| 服务 | 用途 | 月成本 | 年成本 |
|---|---|---|---|
| Supabase Pro | Auth + DB + Thumb 存储 | $25 | $300 |
| Bunny Stream | Proxy 存储 + 转码 + CDN | $3-5 | $36-60 |
| Cloudflare R2 (备选) | 大文件原片备份可选 | $0-5 | $0-60 |
| Vercel Pro (可选) | 如果超 Hobby 限制 | $0-20 | $0-240 |
| Lark (已有) | 原片云备份 | $0 | $0 |
| Mac mini M4 (一次性) | 24/7 ffmpeg 转码 | - | $599 一次 |
| **合计月度** | | **$28-50** | **$336-600/年** |

**对比 Frame.io Team**：$75/月 × 3 年 = $2700 · 自建 3 年 = **$600 + $1000 = $1600** · **省 40%**

### 📦 代码栈

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "@supabase/supabase-js": "^2.x",
    "@aws-sdk/client-s3": "^3.x",  // 对 R2
    "chokidar": "^5.0.0",  // Mac mini watcher
    "video.js": "^8.x",
    "hls.js": "^1.x",
    "@larksuiteoapi/node-sdk": "^1.x",
    "fluent-ffmpeg": "^2.x"  // 可选 FFmpeg 封装
  }
}
```

### 🗄️ 数据库 Schema (Supabase)

```sql
-- 素材主表
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  original_local_path text,         -- SSD 路径
  lark_file_token text,              -- Lark 云盘 token
  proxy_bunny_video_id text,         -- Bunny Stream videoId
  thumb_supabase_path text,          -- Supabase Storage path
  duration_seconds float,
  size_bytes bigint,
  resolution text,                    -- "1920x1080"
  codec text,                         -- "h264"
  shot_date date,
  brand text,                         -- CandyMaster / Q-Pop / ...
  category text,                      -- 白底/细节/场景/...
  tags text[],
  whisper_transcript text,            -- 从 CatchZ Studio 同步
  status text DEFAULT 'ready',        -- uploading/processing/ready
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_assets_brand ON assets(brand);
CREATE INDEX idx_assets_tags ON assets USING gin(tags);

-- 购物车
CREATE TABLE carts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  name text,
  asset_ids uuid[],
  exported_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### 🔑 环境变量

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=
BUNNY_STREAM_CDN_HOSTNAME=

LARK_APP_ID=
LARK_APP_SECRET=
LARK_TENANT_KEY=
```

---

## Part 5 · 实现分阶段 Roadmap

### 🟢 Phase 1 (Week 1-2) · MVP · "能看"

**目标**：3 人能在独立站看 proxy + 选素材

**Week 1**：
- [ ] Supabase DB schema 建好 (`assets` + `carts`)
- [ ] `/library` 页面：列表 + 筛选 + 搜索 (静态假数据)
- [ ] 本地脚本 `bin/ingest.ts`：手动跑 → 扫描目录 → ffmpeg → 上 Bunny + Supabase
- [ ] 播放器用 HLS.js + Bunny iframe embed

**Week 2**：
- [ ] 手动 ingest 50-100 条测试素材
- [ ] 购物车 UI (selectable cards + 底部 sticky bar)
- [ ] `/cart/export` 下载 manifest.json (asset_id + 原片本地路径)
- [ ] Auth (Supabase) 限制 3 人团队

**成本**：Supabase $25 + Bunny $1 + 已有 Vercel = **$26/月**

### 🟡 Phase 2 (Week 3-4) · 自动化 · "能跑"

**目标**：Frida 上传到 Lark → 网站自动出 proxy

**Week 3**：
- [ ] Mac mini watcher (chokidar → ffmpeg → 上传)
- [ ] Lark API 集成：tenant_access_token 自动刷新 · 获取 file_token
- [ ] 购物车导出 manifest 带 Lark `tmp_download_url` (24h 链接)

**Week 4**：
- [ ] EDL (CMX3600) 导出
- [ ] FCPXML 导出 (DaVinci / FCP 兼容)
- [ ] 3 人真实使用 · 收反馈

**新成本**：Mac mini 一次性 $599 (如果买)

### 🔴 Phase 3 (Week 5-8) · 完美 · "能卖"

**目标**：接入 CatchZ Studio 工作台数据 + "一键变 Premiere 项目"

**Week 5-6**：
- [ ] 对接 CatchZ Studio 工作台 (310 条 YFCon 数据作为种子)
- [ ] Whisper 转写导入 `assets.whisper_transcript`
- [ ] 9 分类 · 4 Pass 元数据同步

**Week 7**：
- [ ] Premiere Project XML 导出 (`.prproj` 模板化)
- [ ] Hank 在国内测试下载速度 · 需要加 CDN 就加

**Week 8**：
- [ ] 私域会员门禁 (对齐 CatchZ Studio 策略)
- [ ] 对 Victor pitch 准备 demo

### 🚀 Phase 4 (Month 3+) · 规模化 (如果需要)

- [ ] AI 自动打标签 (Qwen3-VL 分析 thumb)
- [ ] 全文搜索 Whisper 转写 (Supabase pgvector)
- [ ] 素材复用率统计 (哪些被选最多)
- [ ] HG 以外客户接入 (5 品牌都用)

---

## Part 6 · Q&A · 关键问题必答

### Q1 · 推荐方案

```
存储      → Supabase Pro (DB + thumb) + Cloudflare R2/Bunny Stream (proxy)
处理触发   → Phase 1: 本地 ffmpeg 手跑 · Phase 2: Mac mini chokidar 自动
原片定位   → Supabase assets 表 · 存 original_local_path + lark_file_token
购物车    → 输出 manifest.json + EDL (CMX3600) + FCPXML + Lark 临时链接 ZIP
```

### Q2 · 月度成本 · 细到每项

3 人团队 · 历史 300GB 原片 · 月增 30GB → 约 20GB proxy + 2GB thumb：

| 项目 | 单价 | 用量 | 月成本 |
|---|---|---|---|
| Supabase Pro 基础 | - | - | $25.00 |
| Supabase Storage 超出 | $0.021/GB | 2GB thumb (含 100GB) | $0.00 |
| Supabase 流量超出 | $0.09/GB (cached $0.03) | 估 50GB (含 250) | $0.00 |
| Bunny Stream 存储 | $0.005/GB | 30GB proxy | $0.15 |
| Bunny Stream 流量 | $0.01/GB | 100GB (3 人审片) | $1.00 |
| Vercel Hobby/Pro | - | - | $0 (或 $20) |
| **合计** | | | **$26.15/月** |

**+ 一次性**：Mac mini M4 基础款 $599 (如果买新的)

**对比 Frame.io Team $75/月**：每年省 **$586**。

### Q3 · 实现分阶段

见 Part 5。简要：**第 1-2 周 MVP，第 3-4 周自动化，第 5-8 周 打磨+对接 CatchZ Studio**。

### Q4 · Lark 集成可行性

**完全可行**。核心 API：

1. **获取 tenant_access_token** (每 2 小时过期，程序自动刷新)
   ```
   POST /open-apis/auth/v3/tenant_access_token/internal
   ```

2. **批量生成临时下载链接** (24h 有效)
   ```
   POST /open-apis/drive/v1/medias/batch_get_tmp_download_url
   ```

3. **流程**
   ```
   用户在独立站购物车点"导出"
   → 后端 POST Lark API with file_tokens[]
   → 拿到 tmp_download_urls[]
   → 打包成 links.txt + manifest.zip
   → 前端下载
   → 用户点开每个链接 · 原片从 Lark CDN 直接下载 (不过独立站)
   ```

**关键优势**：TZ 的独立站完全不承担原片带宽压力。Lark 带宽 Lark 出。

**风险**：
- Lark 免费版 API 可能有 QPS 限制 · 批量调用要合理
- `tmp_download_url` 每次生成有用量计费（低）

Source: [Feishu Get Temporary Download URL](https://open.larkoffice.com/document/server-docs/docs/drive-v1/media/batch_get_tmp_download_url)

---

## 附录 A · 完整 Sources 清单

### Proxy Workflow
- [Frame.io Video Post-Production Workflow Guide](https://workflow.frame.io/guide/premiere-pro-proxies)
- [Adobe: Ingest and Proxy Workflow in Premiere Pro](https://helpx.adobe.com/premiere-pro/using/ingest-proxy-workflow.html)
- [Frame.io Complete Guide to Premiere Proxies (2024)](https://blog.frame.io/2024/07/29/updated-guide-premiere-pro-proxies-and-proxy-workflows/)
- [OWC: Online vs Offline Editing](https://www.owc.com/blog/online-vs-offline-editing-why-you-still-need-to-consider-proxy-videos)

### MAM 工具
- [Frame.io Pricing](https://frame.io/pricing)
- [Capterra Frame.io Pricing 2026](https://www.capterra.com/p/148214/Frame-io/pricing/)
- [Iconik Pricing](https://www.iconik.io/pricing) · [Iconik Blog: 2025 Pricing Update](https://www.iconik.io/blog/pricing-and-tiers-jan-2025)
- [LucidLink Pricing](https://www.lucidlink.com/pricing)
- [15 Best Frame.io Alternatives 2026](https://filestage.io/blog/frame-io-alternatives/)
- [10 Best Open Source DAM 2026](https://thedigitalprojectmanager.com/tools/best-open-source-digital-asset-management-software/)

### 云转码
- [Cloudflare Stream Pricing](https://developers.cloudflare.com/stream/pricing/)
- [Bunny Stream Pricing](https://bunny.net/pricing/stream/)
- [Bunny.net Review 2026](https://www.bitdoze.com/bunny-net-review/)
- [Bunny Stream API Reference](https://docs.bunny.net/api-reference/stream)
- [Mux Video Pricing](https://www.mux.com/docs/pricing/video)
- [Video Streaming Pricing Comparison April 2026](https://www.buildmvpfast.com/api-costs/video)

### 存储服务
- [Supabase Pricing 2026](https://supabase.com/pricing)
- [Supabase Storage Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase Storage Pricing](https://supabase.com/docs/guides/storage/pricing)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Backblaze B2 Pricing](https://www.backblaze.com/cloud-storage/pricing)
- [Supabase vs R2 (2026)](https://www.buildmvpfast.com/compare/supabase-vs-r2)

### Lark
- [Feishu Get Temporary Download URL API](https://open.larkoffice.com/document/server-docs/docs/drive-v1/media/batch_get_tmp_download_url)
- [Larksuite OpenAPI CLI](https://github.com/larksuite/cli)
- [@larksuiteoapi/node-sdk npm](https://www.npmjs.com/package/@larksuiteoapi/node-sdk)

### FFmpeg + 自建
- [FFmpeg Thumbnail Tutorial](https://davidwalsh.name/create-thumbnail-ffmpeg)
- [Stackunderflow: FCP Proxy with FFmpeg](https://stackunderflow.com/post/final-cut-pro-create-proxy-media-in-ffmpeg/)
- [Chokidar on GitHub](https://github.com/paulmillr/chokidar)

### EDL + 购物车
- [What is an EDL (Premiere Pro)](https://www.simonsaysai.com/blog/premiere-pro-edl)
- [EDL Converter](https://editingtools.io/edl/)
- [Wikipedia EDL](https://en.wikipedia.org/wiki/Edit_decision_list)

### 中国网络
- [Cloudflare China Network](https://developers.cloudflare.com/learning-paths/china-network-overview/series/china-network-main-features-1/)

### HLS 播放
- [HLS streaming with Video.js + React (imagekit)](https://imagekit.io/blog/videojs-hls-adaptive-streaming-react/)
- [Building HLS Video Player with Next.js](https://medium.com/@dilshanmw717/building-a-modern-hls-video-player-with-next-js-a-complete-guide-19c39c61ae73)

---

## 附录 B · 一页总览 (给 TZ)

```
┌─────────────────────────────────────────────────────────────┐
│  HGC MAM 系统 · 一页总览                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  原片 (不上网)                                               │
│   ├─ SSD 蓝色硬盘 (Master)                                  │
│   └─ Lark 云盘 (Backup)                                     │
│                                                             │
│          ↓  Mac mini watcher (ffmpeg)                       │
│                                                             │
│  Proxy + Thumb (上网)                                        │
│   ├─ Bunny Stream (proxy · $3/月)                          │
│   └─ Supabase Storage (thumb · $25/月)                      │
│                                                             │
│          ↓                                                   │
│                                                             │
│  独立站 catchzvibe.studio/hgc-library                       │
│   ├─ /library    · 审片浏览                                 │
│   ├─ /cart       · 购物车                                   │
│   └─ /checkout   · 导出 manifest / EDL / Lark 链接         │
│                                                             │
│  月成本：$28-30 · 对比 Frame.io 省 $45/月                   │
│  实现：2 周 MVP · 8 周完整                                   │
│  TZ 规则：✓ 原片不上网 ✓ 预算内 ✓ 基于已有栈                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
